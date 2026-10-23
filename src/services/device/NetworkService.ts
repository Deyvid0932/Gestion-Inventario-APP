import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';
import { SynchronizationEngine } from '../../sync/SynchronizationEngine';
import { AuthManager } from '../auth/AuthManager';
import { useAppStore } from '../../store/useAppStore';

class NetworkServiceClass {
  private unsubscribeNetInfo: (() => void) | null = null;
  private unsubscribeAppState: (() => void) | null = null;
  private isReconnectingSync = false;
  private pendingSyncReason: string | null = null;
  private forceFullOnNextSync = false;
  private wasOffline = false;
  private debounceTimer: any = null;
  private activeDb: SQLiteDatabase | null = null;
  private activeUserId: string | null = null;

  /**
   * Inicializa los listeners de conectividad NetInfo y ciclo de vida AppState.
   * Se invoca una única vez al montar la aplicación en useAppInitialization.
   */
  init(db: SQLiteDatabase, userId?: string | null): void {
    this.activeDb = db;
    this.activeUserId = userId || null;

    if (this.unsubscribeNetInfo) {
      return;
    }

    // 1. Listener reactivo a cambios de conexión (WiFi / Datos / Sin señal)
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkChange(state);
    });

    // 2. Listener al volver de segundo plano (desbloqueo de pantalla / foreground)
    const appStateSub = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.scheduleReconnectionSync('app_foreground', 1000);
      }
    });
    this.unsubscribeAppState = () => appStateSub.remove();
  }

  /**
   * Actualiza el contexto de base de datos o usuario autenticado dinámicamente
   */
  updateContext(db: SQLiteDatabase, userId?: string | null): void {
    this.activeDb = db;
    this.activeUserId = userId || null;
  }

  /**
   * Manejador de evento cuando cambia el estado de conexión
   */
  private handleNetworkChange(state: NetInfoState): void {
    const isConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
    useAppStore.getState().setIsOnline(isConnected);

    if (!isConnected) {
      this.wasOffline = true;
      console.log('[NetworkService] 📡 Dispositivo sin conexión. Modo local activo.');
      return;
    }

    if (this.wasOffline) {
      console.log('[NetworkService] 🌐 Conexión a internet restablecida. Programando auto-sincronización...');
      this.wasOffline = false;
      this.scheduleReconnectionSync('network_reconnected', 1500);
    }
  }

  /**
   * Programa una sincronización con debounce para tolerar fluctuaciones de señal
   */
  private scheduleReconnectionSync(reason: string, delayMs = 1500): void {
    if (reason === 'network_reconnected') this.forceFullOnNextSync = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.checkAndTriggerSync(reason);
    }, delayMs);
  }

  /**
   * Ejecuta la auto-sincronización silenciosa en segundo plano
   */
  async checkAndTriggerSync(reason: string): Promise<void> {
    if (this.isReconnectingSync) {
      this.pendingSyncReason = reason;
      return;
    }
    if (!this.activeDb || !this.activeUserId) return;

    const db = this.activeDb;
    const userId = this.activeUserId;
    const forceFullPull = this.forceFullOnNextSync || reason === 'network_reconnected';
    this.forceFullOnNextSync = false;
    this.isReconnectingSync = true;

    try {
      const pendingCount = await SynchronizationEngine.getPendingCount(db);
      //console.log(`[NetworkService] Auto-sync activado (${reason}). Pendientes locales: ${pendingCount}`);
      const res = await SynchronizationEngine.fullSync(db, userId, true, forceFullPull);

      // Algunas tablas pueden haberse aplicado aunque otra parte haya fallado.
      await AuthManager.refreshAllAppState(db);
      if (res.success) {
        console.log('[NetworkService] ✅ Auto-sync completado exitosamente.');
      } else {
        console.warn('[NetworkService] Auto-sync incompleto; se mostraron los cambios locales disponibles.');
      }
    } catch (error) {
      console.warn('[NetworkService] Error durante auto-sincronización:', error);
    } finally {
      this.isReconnectingSync = false;
      if (this.pendingSyncReason) {
        const nextReason = this.pendingSyncReason;
        this.pendingSyncReason = null;
        this.scheduleReconnectionSync(nextReason, 1000);
      }
    }
  }

  /**
   * Desmonta los listeners al cerrar sesión o destruir contexto
   */
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    if (this.unsubscribeAppState) {
      this.unsubscribeAppState();
      this.unsubscribeAppState = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingSyncReason = null;
    this.forceFullOnNextSync = false;
  }
}

export const NetworkService = new NetworkServiceClass();
