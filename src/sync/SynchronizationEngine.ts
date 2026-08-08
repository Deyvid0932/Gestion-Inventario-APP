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
import { R2Service } from '../services/r2Service';

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
      const sql = `
        SELECT (
          (SELECT COUNT(*) FROM inventarios WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM cajas WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM prendas WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM chat_sessions WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM chat_history WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM pending_deletions)
        ) as total
      `;
      const res = await db.getFirstAsync<{ total: number }>(sql);
      return res?.total || 0;
    } catch {
      return 0;
    }
  }

  async recoverStuckSyncing(db: SQLiteDatabase): Promise<void> {
    try {
      await db.execAsync(`
        UPDATE inventarios SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
        UPDATE cajas SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
        UPDATE prendas SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
        UPDATE chat_sessions SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
        UPDATE chat_history SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
      `);
    } catch (e) {}
  }

  async processPendingDeletions(db: SQLiteDatabase): Promise<void> {
    try {
      const pendingDeletions = await db.getAllAsync<{ id: string; tableName: string; recordId: string }>(
        `SELECT * FROM pending_deletions ORDER BY createdAt ASC`
      );

      if (!pendingDeletions || pendingDeletions.length === 0) return;

      const tableMap: Record<string, string> = {
        inventarios: 'inventories',
        cajas: 'boxes',
        prendas: 'garments',
        chat_sessions: 'chat_sessions',
        chat_history: 'chat_messages',
        chat_messages: 'chat_messages',
      };

      const deletedIds: string[] = [];

      for (const item of pendingDeletions) {
        const targetRemoteTable = tableMap[item.tableName] || item.tableName;

        try {
          if (targetRemoteTable === 'inventories') {
            const { data: remoteBoxes } = await supabase
              .from('boxes')
              .select('id')
              .eq('inventory_id', item.recordId);

            if (remoteBoxes && remoteBoxes.length > 0) {
              const boxIds = remoteBoxes.map(b => b.id);
              const { data: garments } = await supabase
                .from('garments')
                .select('r2_key, r2_key_2')
                .in('box_id', boxIds);

              for (const g of garments || []) {
                if (g.r2_key) await R2Service.deletePhotoFromR2(g.r2_key).catch(() => {});
                if (g.r2_key_2) await R2Service.deletePhotoFromR2(g.r2_key_2).catch(() => {});
              }

              await supabase.from('garments').delete().in('box_id', boxIds);
              await supabase.from('boxes').delete().in('id', boxIds);
            }
          } else if (targetRemoteTable === 'boxes') {
            const { data: garments } = await supabase
              .from('garments')
              .select('r2_key, r2_key_2')
              .eq('box_id', item.recordId);

            for (const g of garments || []) {
              if (g.r2_key) await R2Service.deletePhotoFromR2(g.r2_key).catch(() => {});
              if (g.r2_key_2) await R2Service.deletePhotoFromR2(g.r2_key_2).catch(() => {});
            }

            await supabase.from('garments').delete().eq('box_id', item.recordId);
          } else if (targetRemoteTable === 'garments') {
            const { data: garment } = await supabase
              .from('garments')
              .select('r2_key, r2_key_2')
              .eq('id', item.recordId)
              .maybeSingle();

            if (garment) {
              if (garment.r2_key) await R2Service.deletePhotoFromR2(garment.r2_key).catch(() => {});
              if (garment.r2_key_2) await R2Service.deletePhotoFromR2(garment.r2_key_2).catch(() => {});
            }
          }
        } catch (cascadeErr) {
          console.warn(`[SyncEngine] Error en limpieza en cascada para ${item.recordId}:`, cascadeErr);
        }

        const { error } = await supabase.from(targetRemoteTable).delete().eq('id', item.recordId);
        if (!error) {
          deletedIds.push(item.id);
        } else {
          console.warn(`[SyncEngine] Error al eliminar registro ${item.recordId} de ${targetRemoteTable} en Supabase:`, error.message);
        }
      }

      if (deletedIds.length > 0) {
        const placeholders = deletedIds.map(() => '?').join(',');
        await db.runAsync(`DELETE FROM pending_deletions WHERE id IN (${placeholders})`, deletedIds);
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

      if (totalResult.pushedCount > 0 && totalResult.success) {
        await this.setLastSyncTime();
      }
    } catch (e: any) {
      totalResult.success = false;
    }
    return totalResult;
  }

  async pullAll(db: SQLiteDatabase, userId: string, forceFull: boolean = false): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    
    try {
      const syncStartedAt = new Date().toISOString();
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
        await this.setLastSyncTime(syncStartedAt);
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
