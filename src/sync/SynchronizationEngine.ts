import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from './SyncAdapter';
import { InventarioSyncAdapter } from './adapters/InventarioSyncAdapter';
import { CajaSyncAdapter } from './adapters/CajaSyncAdapter';
import { PrendaSyncAdapter } from './adapters/PrendaSyncAdapter';
import { ChatSessionSyncAdapter } from './adapters/ChatSessionSyncAdapter';
import { ChatHistorySyncAdapter } from './adapters/ChatHistorySyncAdapter';
import { supabase } from '../database/supabase';

const LAST_SYNC_KEY = 'last_sync_timestamp';

class SynchronizationEngineClass {
  private adapters: SyncAdapter[] = [];
  private isSyncing = false;

  constructor() {
    // Registrar adapters por defecto en orden de dependencia FK
    this.registerAdapter(new InventarioSyncAdapter());
    this.registerAdapter(new CajaSyncAdapter());
    this.registerAdapter(new PrendaSyncAdapter());
    this.registerAdapter(new ChatSessionSyncAdapter());
    this.registerAdapter(new ChatHistorySyncAdapter());
  }

  registerAdapter(adapter: SyncAdapter) {
    // Evitar registrar duplicados por nombre de tabla
    if (!this.adapters.some(a => a.tableName === adapter.tableName)) {
      this.adapters.push(adapter);
    }
  }

  async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(LAST_SYNC_KEY);
    } catch (e) {
      console.error('Error al obtener fecha de sincronización:', e);
      return null;
    }
  }

  async setLastSyncTime(timestamp?: string): Promise<string> {
    const time = timestamp || new Date().toISOString();
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, time);
    } catch (e) {
      console.error('Error al guardar fecha de sincronización:', e);
    }
    return time;
  }

  // Obtener el total de registros pendientes de sincronización o borrado
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

  // Desatascar registros que quedaron en SYNCING al cerrarse la app repentinamente
  async recoverStuckSyncing(db: SQLiteDatabase): Promise<void> {
    try {
      for (const adapter of this.adapters) {
        await db.runAsync(
          `UPDATE ${adapter.tableName} SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING'`
        ).catch(() => {});
      }
    } catch (e) {
      console.error('Error al recuperar registros atrapados en SYNCING:', e);
    }
  }

  // Procesar borrados pendientes offline
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
    } catch (e) {
      console.error('Error al procesar pending_deletions:', e);
    }
  }

  // Push de todos los registros locales PENDING / FAILED
  async pushAllPending(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    if (this.isSyncing) return totalResult;

    this.isSyncing = true;
    try {
      await this.recoverStuckSyncing(db);
      await this.processPendingDeletions(db);

      for (const adapter of this.adapters) {
        const res = await adapter.pushLocal(db, userId);
        totalResult.pushedCount += res.pushedCount;
        if (!res.success) {
          totalResult.success = false;
          if (res.errors) totalResult.errors?.push(...res.errors);
        }
      }
    } finally {
      this.isSyncing = false;
    }
    return totalResult;
  }

  // Pull de todos los registros remotos (forzado completo si la BD local está vacía)
  async pullAll(db: SQLiteDatabase, userId: string, forceFull: boolean = false): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    if (this.isSyncing) return totalResult;

    this.isSyncing = true;
    try {
      const localCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM inventarios');
      const isEmpty = !localCount || localCount.count === 0;

      // Si la BD local está vacía o forceFull es true, descargar todo (since = null)
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
    } finally {
      this.isSyncing = false;
    }
    return totalResult;
  }

  // Ciclo completo (Push -> Pull)
  async fullSync(db: SQLiteDatabase, userId: string): Promise<{ success: boolean; syncedAt: string }> {
    try {
      const pushRes = await this.pushAllPending(db, userId);
      const pullRes = await this.pullAll(db, userId);
      const syncedAt = await this.setLastSyncTime();

      return {
        success: pushRes.success && pullRes.success,
        syncedAt,
      };
    } catch (e) {
      console.error('Error en fullSync:', e);
      return { success: false, syncedAt: new Date().toISOString() };
    }
  }

  // Limpiar todos los datos locales (al cambiar de usuario o cerrar sesión)
  async cleanLocalData(db: SQLiteDatabase): Promise<void> {
    // Invertir el orden para respetar FK constraints (prendas -> cajas -> inventarios)
    const reversed = [...this.adapters].reverse();
    for (const adapter of reversed) {
      await adapter.cleanForUser(db);
    }
    // Limpiar tablas de chat y cola de eliminaciones
    await db.runAsync('DELETE FROM chat_history').catch(() => {});
    await db.runAsync('DELETE FROM chat_sessions').catch(() => {});
    await db.runAsync('DELETE FROM pending_deletions').catch(() => {});
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
  }

  // Adoptar datos locales de un invitado (asignar user_id)
  async adoptLocalData(db: SQLiteDatabase, userId: string): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.adoptForUser(db, userId);
    }
  }
}

export const SynchronizationEngine = new SynchronizationEngineClass();
