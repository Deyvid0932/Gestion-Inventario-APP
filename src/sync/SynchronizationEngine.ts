import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from './SyncAdapter';
import { InventarioSyncAdapter } from './adapters/InventarioSyncAdapter';
import { CajaSyncAdapter } from './adapters/CajaSyncAdapter';
import { PrendaSyncAdapter } from './adapters/PrendaSyncAdapter';
import { ChatSessionSyncAdapter } from './adapters/ChatSessionSyncAdapter';
import { ChatHistorySyncAdapter } from './adapters/ChatHistorySyncAdapter';
import { supabase } from '../database/supabase';
import { useAppStore } from '../store/useAppStore';

const LAST_SYNC_KEY = 'last_sync_timestamp';

class SynchronizationEngineClass {
  private adapters: SyncAdapter[] = [];
  private isSyncing = false;

  constructor() {
    this.registerAdapter(new InventarioSyncAdapter());
    this.registerAdapter(new CajaSyncAdapter());
    this.registerAdapter(new PrendaSyncAdapter());
    this.registerAdapter(new ChatSessionSyncAdapter());
    this.registerAdapter(new ChatHistorySyncAdapter());
  }

  registerAdapter(adapter: SyncAdapter) {
    if (!this.adapters.some(a => a.tableName === adapter.tableName)) {
      this.adapters.push(adapter);
    }
  }

  async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_SYNC_KEY);
    } catch (e) {
      return null;
    }
  }

  async setLastSyncTime(timestamp?: string): Promise<string> {
    const time = timestamp || new Date().toISOString();
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, time);
      useAppStore.getState().setLastSyncTime(time);
    } catch (e) {}
    return time;
  }

  async getPendingCount(db: SQLiteDatabase): Promise<number> {
    try {
      let count = 0;
      for (const adapter of this.adapters) {
        const res = await db.getFirstAsync<{ total: number }>(
          `SELECT count(*) as total FROM ${adapter.tableName} WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
        );
        count += res?.total || 0;
      }
      const deletionsRes = await db.getFirstAsync<{ total: number }>(
        `SELECT count(*) as total FROM pending_deletions`
      );
      count += deletionsRes?.total || 0;
      return count;
    } catch {
      return 0;
    }
  }

  async recoverStuckSyncing(db: SQLiteDatabase): Promise<void> {
    try {
      for (const adapter of this.adapters) {
        await db.runAsync(
          `UPDATE ${adapter.tableName} SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING'`
        ).catch(() => {});
      }
    } catch (e) {}
  }

  async processPendingDeletions(db: SQLiteDatabase): Promise<void> {
    try {
      const pendingDeletions = await db.getAllAsync<{ id: string; tableName: string; recordId: string }>(
        `SELECT * FROM pending_deletions ORDER BY createdAt ASC`
      );

      if (!pendingDeletions || pendingDeletions.length === 0) return;

      for (const item of pendingDeletions) {
        const { error } = await supabase.from(item.tableName).delete().eq('id', item.recordId);
        if (!error) {
          await db.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [item.id]);
        }
      }
    } catch (e) {}
  }

  async pushAllPending(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    
    try {
      await this.recoverStuckSyncing(db);
      await this.processPendingDeletions(db);

      const pendingCount = await this.getPendingCount(db);
      if (pendingCount === 0) return totalResult;

      for (const adapter of this.adapters) {
        const res = await adapter.pushLocal(db, userId);
        totalResult.pushedCount += res.pushedCount;
        if (!res.success) {
          totalResult.success = false;
          if (res.errors) totalResult.errors?.push(...res.errors);
        }
      }
    } catch (e: any) {
      totalResult.success = false;
    }
    return totalResult;
  }

  async pullAll(db: SQLiteDatabase, userId: string, forceFull: boolean = false): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    
    try {
      const localCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM inventarios');
      const isEmpty = !localCount || localCount.count === 0;
      const since = (forceFull || isEmpty) ? null : await this.getLastSyncTime();

      for (const adapter of this.adapters) {
        const res = await adapter.pullRemote(db, userId, since);
        totalResult.pulledCount += res.pulledCount;
        if (!res.success) {
          totalResult.success = false;
          if (res.errors) totalResult.errors?.push(...res.errors);
        }
      }

      if (totalResult.success) {
        await this.setLastSyncTime();
      }
    } catch (e: any) {
      totalResult.success = false;
    }
    return totalResult;
  }

  // Ciclo completo optimizado con timeout de seguridad máximo (evita que la pantalla se quede cargando si falla la red)
  async fullSync(db: SQLiteDatabase, userId: string): Promise<{ success: boolean; syncedAt: string }> {
    if (this.isSyncing) return { success: true, syncedAt: new Date().toISOString() };
    this.isSyncing = true;

    const syncTask = (async () => {
      const [pushRes, pullRes] = await Promise.all([
        this.pushAllPending(db, userId),
        this.pullAll(db, userId)
      ]);

      const syncedAt = await this.setLastSyncTime();
      return {
        success: pushRes.success && pullRes.success,
        syncedAt,
      };
    })();

    const timeoutTask = new Promise<{ success: boolean; syncedAt: string }>((resolve) => {
      setTimeout(() => {
        resolve({ success: false, syncedAt: new Date().toISOString() });
      }, 8000);
    });

    try {
      useAppStore.getState().setSyncing(true, 'Sincronizando datos...');
      const result = await Promise.race([syncTask, timeoutTask]);
      return result;
    } catch (e) {
      console.error('Error en fullSync:', e);
      return { success: false, syncedAt: new Date().toISOString() };
    } finally {
      this.isSyncing = false;
      useAppStore.getState().setSyncing(false);
    }
  }

  async cleanLocalData(db: SQLiteDatabase): Promise<void> {
    useAppStore.getState().setSyncing(true, 'Limpiando...');
    const reversed = [...this.adapters].reverse();
    for (const adapter of reversed) {
      await adapter.cleanForUser(db);
    }
    await db.runAsync('DELETE FROM chat_history').catch(() => {});
    await db.runAsync('DELETE FROM chat_sessions').catch(() => {});
    await db.runAsync('DELETE FROM pending_deletions').catch(() => {});
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    useAppStore.getState().setSyncing(false);
  }

  async adoptLocalData(db: SQLiteDatabase, userId: string): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.adoptForUser(db, userId);
    }
  }
}

export const SynchronizationEngine = new SynchronizationEngineClass();
