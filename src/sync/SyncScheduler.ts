import { SQLiteDatabase } from 'expo-sqlite';
import { SynchronizationEngine } from './SynchronizationEngine';

class SyncSchedulerClass {
  private isSyncing = false;
  private pendingTimer: any = null;
  private hasPendingSync = false;
  private activeDb: SQLiteDatabase | null = null;
  private activeUserId: string | null = null;
  private retryAttempt = 0;

  /**
   * Encola una solicitud de push diferida (debounce configurable, por defecto 1500ms).
   * Si ya hay una sincronización en curso, registra que hay cambios pendientes
   * y desencadena una nueva ejecución al terminar.
   */
  schedulePush(db: SQLiteDatabase, userId: string, debounceMs = 1500): void {
    if (!db || !userId) return;
    this.activeDb = db;
    this.activeUserId = userId;
    this.hasPendingSync = true;
    this.retryAttempt = 0;

    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }

    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.triggerScheduledPush();
    }, debounceMs);
  }

  /**
   * Ejecuta inmediatamente la sincronización sin debounce (por ejemplo, en gestos manuales),
   * garantizando que nunca se corran dos sincronizaciones concurrentemente.
   */
  async triggerImmediatePush(db: SQLiteDatabase, userId: string): Promise<void> {
    if (!db || !userId) return;
    this.activeDb = db;
    this.activeUserId = userId;
    this.hasPendingSync = true;
    this.retryAttempt = 0;

    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    await this.triggerScheduledPush();
  }

  private async triggerScheduledPush(): Promise<void> {
    if (this.isSyncing) {
      // Ya hay una sincronización activa. Al terminar, reintentará automáticamente.
      return;
    }

    if (!this.hasPendingSync || !this.activeDb || !this.activeUserId) {
      return;
    }

    this.isSyncing = true;
    this.hasPendingSync = false;
    const targetDb = this.activeDb;
    const targetUser = this.activeUserId;

    try {
      const result = await SynchronizationEngine.pushAllPending(targetDb, targetUser);
      if (result.success) {
        this.retryAttempt = 0;
      } else {
        console.warn('[SyncScheduler] Subida incompleta; quedan cambios pendientes:', result.errors);
        this.queueRetry();
      }
    } catch (error) {
      console.error('[SyncScheduler] Error al procesar pushAllPending:', error);
      this.queueRetry();
    } finally {
      this.isSyncing = false;
      // Si se programaron nuevos cambios mientras se ejecutaba la sincronización, procesar siguiente ciclo
      if (this.hasPendingSync && !this.pendingTimer && this.activeDb && this.activeUserId) {
        this.triggerScheduledPush();
      }
    }
  }

  private queueRetry(): void {
    if (this.hasPendingSync || this.retryAttempt >= 3) return;
    const delay = [3000, 10000, 30000][this.retryAttempt++];
    this.hasPendingSync = true;
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.triggerScheduledPush();
    }, delay);
  }
}

export const SyncScheduler = new SyncSchedulerClass();
