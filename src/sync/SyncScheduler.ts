import { SQLiteDatabase } from 'expo-sqlite';
import { SynchronizationEngine } from './SynchronizationEngine';

class SyncSchedulerClass {
  private isSyncing = false;
  private pendingTimer: any = null;
  private hasPendingSync = false;
  private activeDb: SQLiteDatabase | null = null;
  private activeUserId: string | null = null;

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
      await SynchronizationEngine.pushAllPending(targetDb, targetUser);
    } catch (error) {
      console.error('[SyncScheduler] Error al procesar pushAllPending:', error);
    } finally {
      this.isSyncing = false;
      // Si se programaron nuevos cambios mientras se ejecutaba la sincronización, procesar siguiente ciclo
      if (this.hasPendingSync && this.activeDb && this.activeUserId) {
        this.triggerScheduledPush();
      }
    }
  }
}

export const SyncScheduler = new SyncSchedulerClass();
