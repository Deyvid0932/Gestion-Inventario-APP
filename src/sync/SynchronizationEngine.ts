import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from './SyncAdapter';
import { InventorySyncAdapter } from './adapters/InventorySyncAdapter';
import { BoxSyncAdapter } from './adapters/BoxSyncAdapter';
import { GarmentSyncAdapter } from './adapters/GarmentSyncAdapter';
import { ChatSessionSyncAdapter } from './adapters/ChatSessionSyncAdapter';
import { ChatHistorySyncAdapter } from './adapters/ChatHistorySyncAdapter';
import { supabase } from '../database/supabase';
import { useAppStore } from '../store/useAppStore';
import { R2Service } from '../services/cloud/r2Service';
import { withSerializedTransaction } from '../database/serializedTransaction';
import { applyConfirmedDeletions, DELETION_CURSOR_PREFIX, syncRemoteDeletions } from './deletionTombstones';

const LAST_SYNC_KEY = 'last_sync_timestamp';

const SAFETY_TABLE_COLUMNS: Record<string, string[]> = {
  inventories: ['id', 'user_id', 'name', 'description', 'created_at', 'order_index', 'status', 'updated_at', 'deleted_at', 'sync_status', 'deleted_by', 'deletion_batch_id'],
  boxes: ['id', 'inventory_id', 'name', 'created_at', 'order_index', 'status', 'updated_at', 'deleted_at', 'sync_status', 'deleted_by', 'deletion_batch_id'],
  garments: ['id', 'box_id', 'op', 'style', 'color', 'size', 'status', 'created_at', 'updated_at', 'deleted_at', 'sync_status', 'deleted_by', 'deletion_batch_id'],
  garment_images: ['id', 'garment_id', 'uri', 'storage_key', 'storage', 'order_index', 'is_primary', 'created_at', 'updated_at', 'deleted_at', 'deleted_by', 'deletion_batch_id', 'sync_status'],
  garment_alarms: ['id', 'garment_id', 'alarm_datetime', 'expires_at', 'notification_id', 'status', 'created_at', 'updated_at', 'deleted_at', 'deleted_by', 'deletion_batch_id', 'sync_status'],
  pending_deletions: ['id', 'tableName', 'recordId', 'createdAt'],
};

interface SyncSafetySnapshot {
  inventories: any[];
  boxes: any[];
  garments: any[];
  garment_images: any[];
  garment_alarms: any[];
  pending_deletions: any[];
}

class SynchronizationEngineClass {
  private adapters: SyncAdapter[] = [];
  private isSyncing = false;

  constructor() {
    this.registerAdapter(new InventorySyncAdapter());
    this.registerAdapter(new BoxSyncAdapter());
    this.registerAdapter(new GarmentSyncAdapter());
    this.registerAdapter(new ChatSessionSyncAdapter());
    this.registerAdapter(new ChatHistorySyncAdapter());
  }

  registerAdapter(adapter: SyncAdapter) {
    if (!this.adapters.some(a => a.tableName === adapter.tableName)) {
      this.adapters.push(adapter);
    }
  }

  private getLastSyncKey(userId?: string): string {
    return userId ? `${LAST_SYNC_KEY}:${userId}` : LAST_SYNC_KEY;
  }

  async getLastSyncTime(userId?: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.getLastSyncKey(userId));
    } catch (e) {
      return null;
    }
  }

  async setLastSyncTime(timestamp?: string, userId?: string): Promise<string> {
    const time = timestamp || new Date().toISOString();
    try {
      await AsyncStorage.setItem(this.getLastSyncKey(userId), time);
      useAppStore.getState().setLastSyncTime(time);
    } catch (e) {}
    return time;
  }

  async getPendingCount(db: SQLiteDatabase): Promise<number> {
    try {
      const sql = `
        SELECT (
          (SELECT COUNT(*) FROM inventories WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM boxes WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
          (SELECT COUNT(*) FROM garments WHERE sync_status = 'PENDING' OR sync_status = 'FAILED') +
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

  /** Cuenta los cambios de inventario que todavía no están respaldados. */
  async getInventoryPendingCount(db: SQLiteDatabase): Promise<number> {
    try {
      const result = await db.getFirstAsync<{ total: number }>(`
        SELECT (
          (SELECT COUNT(*) FROM inventories WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING')) +
          (SELECT COUNT(*) FROM boxes WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING')) +
          (SELECT COUNT(*) FROM garments WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING')) +
          (SELECT COUNT(*) FROM garment_images WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING')) +
          (SELECT COUNT(*) FROM garment_alarms WHERE sync_status IN ('PENDING', 'FAILED', 'SYNCING')) +
          (SELECT COUNT(*) FROM pending_deletions
             WHERE tableName IN ('inventories', 'boxes', 'garments', 'garment_images', 'garment_alarms'))
        ) AS total
      `);
      return result?.total || 0;
    } catch (e) {
      console.error('[SYNC_SAFETY] No se pudieron contar los cambios pendientes:', e);
      return 0;
    }
  }

  /** Conserva los cambios pendientes antes de vaciar la caché al cerrar sesión. */
  async preservePendingInventory(db: SQLiteDatabase, userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;

    const pendingCount = await this.getInventoryPendingCount(db);
    if (pendingCount === 0) return false;

    try {
      const [inventories, boxes, garments, garmentImages, garmentAlarms, pendingDeletions] = await Promise.all([
        db.getAllAsync<any>('SELECT * FROM inventories'),
        db.getAllAsync<any>('SELECT * FROM boxes'),
        db.getAllAsync<any>('SELECT * FROM garments'),
        db.getAllAsync<any>('SELECT * FROM garment_images'),
        db.getAllAsync<any>('SELECT * FROM garment_alarms'),
        db.getAllAsync<any>(
          `SELECT * FROM pending_deletions
           WHERE tableName IN ('inventories', 'boxes', 'garments', 'garment_images', 'garment_alarms')`
        ),
      ]);

      const payload: SyncSafetySnapshot = {
        inventories,
        boxes,
        garments,
        garment_images: garmentImages,
        garment_alarms: garmentAlarms,
        pending_deletions: pendingDeletions,
      };

      await db.runAsync(
        `INSERT INTO sync_safety_snapshots (user_id, payload, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at`,
        [userId, JSON.stringify(payload), new Date().toISOString()]
      );
      console.warn(`[SYNC_SAFETY] Se conservaron ${pendingCount} cambios pendientes para ${userId}.`);
      return true;
    } catch (e) {
      console.error('[SYNC_SAFETY] No se pudo crear el respaldo local:', e);
      throw e;
    }
  }

  /** Restaura el respaldo únicamente cuando la caché del inventario está vacía. */
  async restorePendingInventory(db: SQLiteDatabase, userId: string): Promise<boolean> {
    try {
      const localCount = await db.getFirstAsync<{ total: number }>(
        'SELECT COUNT(*) AS total FROM inventories'
      );
      if ((localCount?.total || 0) > 0) return false;

      const saved = await db.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM sync_safety_snapshots WHERE user_id = ?',
        [userId]
      );
      if (!saved?.payload) return false;

      const snapshot = JSON.parse(saved.payload) as SyncSafetySnapshot;
      const restoreOrder: Array<keyof SyncSafetySnapshot> = [
        'inventories',
        'boxes',
        'garments',
        'garment_images',
        'garment_alarms',
        'pending_deletions',
      ];

      await withSerializedTransaction(db, async () => {
        for (const tableName of restoreOrder) {
          const rows = Array.isArray(snapshot[tableName]) ? snapshot[tableName] : [];
          const columns = SAFETY_TABLE_COLUMNS[tableName];
          for (const row of rows) {
            const placeholders = columns.map(() => '?').join(', ');
            await db.runAsync(
              `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
              columns.map(column => row[column] ?? null)
            );
          }
        }
      });

      console.warn(`[SYNC_SAFETY] Se restauró el respaldo pendiente de ${userId}.`);
      return true;
    } catch (e) {
      console.error('[SYNC_SAFETY] No se pudo restaurar el respaldo local:', e);
      return false;
    }
  }

  async clearSafetySnapshotIfSynced(db: SQLiteDatabase, userId: string): Promise<void> {
    if (await this.getInventoryPendingCount(db) > 0) return;
    await db.runAsync('DELETE FROM sync_safety_snapshots WHERE user_id = ?', [userId]).catch(() => {});
  }

  async recoverStuckSyncing(db: SQLiteDatabase): Promise<void> {
    try {
      await db.execAsync(`
        UPDATE inventories SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
        UPDATE boxes SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
        UPDATE garments SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING';
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
        inventories: 'inventories',
        boxes: 'boxes',
        garments: 'garments',
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
                .select('id')
                .in('box_id', boxIds);

              if (garments && garments.length > 0) {
                const garmentIds = garments.map(g => g.id);
                const { data: images } = await supabase
                  .from('garment_images')
                  .select('storage_key')
                  .in('garment_id', garmentIds);

                for (const img of images || []) {
                  if (img.storage_key) await R2Service.deletePhotoFromR2(img.storage_key).catch(() => {});
                }
              }

              await supabase.from('garments').delete().in('box_id', boxIds);
              await supabase.from('boxes').delete().in('id', boxIds);
            }
          } else if (targetRemoteTable === 'boxes') {
            const { data: garments } = await supabase
              .from('garments')
              .select('id')
              .eq('box_id', item.recordId);

            if (garments && garments.length > 0) {
              const garmentIds = garments.map(g => g.id);
              const { data: images } = await supabase
                .from('garment_images')
                .select('storage_key')
                .in('garment_id', garmentIds);

              for (const img of images || []) {
                if (img.storage_key) await R2Service.deletePhotoFromR2(img.storage_key).catch(() => {});
              }
            }

            await supabase.from('garments').delete().eq('box_id', item.recordId);
          } else if (targetRemoteTable === 'garments') {
            const { data: images } = await supabase
              .from('garment_images')
              .select('storage_key')
              .eq('garment_id', item.recordId);

            for (const img of images || []) {
              if (img.storage_key) await R2Service.deletePhotoFromR2(img.storage_key).catch(() => {});
            }
          } else if (targetRemoteTable === 'chat_sessions') {
            try {
              await supabase.from('chat_messages').delete().eq('session_id', item.recordId);
            } catch (_) {}
          }

          const { error } = await supabase
            .from(targetRemoteTable)
            .delete()
            .eq('id', item.recordId);

          if (!error) {
            deletedIds.push(item.id);
          }
        } catch (delErr) {
          console.warn(`Error deleting ${targetRemoteTable} ${item.recordId}:`, delErr);
        }
      }

      if (deletedIds.length > 0) {
        for (const did of deletedIds) {
          await db.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [did]);
        }
      }
    } catch (e) {
      console.error('Error processing pending_deletions:', e);
    }
  }

  private syncMutex: Promise<any> = Promise.resolve();

  private async acquireLock<T>(fn: () => Promise<T>): Promise<T> {
    const nextLock = this.syncMutex.then(
      async () => await fn(),
      async () => await fn()
    );
    this.syncMutex = nextLock.catch(() => {});
    return nextLock;
  }

  async pushAllPending(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    return this.acquireLock(() => this.executePushAllPending(db, userId));
  }

  async applyRealtimeDeletion(db: SQLiteDatabase, table: string, id: string): Promise<number> {
    // Esperar a que termine cualquier descarga en curso: no debe reinsertar el ID borrado.
    return this.acquireLock(() => applyConfirmedDeletions(db, [{ table_name: table, record_id: id }]));
  }

  private async executePushAllPending(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    
    try {
      await this.recoverStuckSyncing(db);
      await this.processPendingDeletions(db);

      const remainingDeletions = await db.getFirstAsync<{ total: number }>(
        'SELECT COUNT(*) AS total FROM pending_deletions'
      );
      if ((remainingDeletions?.total || 0) > 0) {
        totalResult.success = false;
        totalResult.errors?.push('Quedaron eliminaciones pendientes de respaldar');
      }

      // Ejecutar secuencialmente para respetar dependencias y evitar colisión de transacciones en SQLite
      for (const adapter of this.adapters) {
        try {
          const res = await adapter.pushLocal(db, userId);
          totalResult.pushedCount += res.pushedCount;
          if (!res.success) {
            totalResult.success = false;
            if (res.errors) totalResult.errors?.push(...res.errors);
          }
        } catch (adapterErr: any) {
          totalResult.success = false;
          totalResult.errors?.push(adapterErr.message || String(adapterErr));
        }
      }

      // El cursor pertenece al pull remoto. Una subida nunca debe adelantarlo:
      // hacerlo aquí podría ocultar cambios remotos todavía no descargados.
    } catch (e: any) {
      totalResult.success = false;
    }
    return totalResult;
  }

  async pullAll(db: SQLiteDatabase, userId: string, forceFull: boolean = false): Promise<SyncResult> {
    return this.acquireLock(() => this.executePullAll(db, userId, forceFull));
  }

  private async executePullAll(db: SQLiteDatabase, userId: string, forceFull: boolean = false): Promise<SyncResult> {
    const totalResult: SyncResult = { success: true, pushedCount: 0, pulledCount: 0, errors: [] };
    
    try {
      const syncStartedAt = new Date().toISOString();
      const localCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM inventories');
      const isEmpty = !localCount || localCount.count === 0;
      const since = (forceFull || isEmpty) ? null : await this.getLastSyncTime(userId);

      // === FASE 1: Pre-fetch HTTP en PARALELO (todas las tablas al mismo tiempo) ===
      const [invAdapter, boxAdapter, garmentAdapter, chatSessionAdapter, chatHistoryAdapter] = this.adapters;

      // Lanzar consultas HTTP de inventarios, cajas, prendas y sesiones de chat
      const [invData, boxData, garmentData, chatSessionData] = await Promise.all([
        invAdapter.fetchRemote?.(userId, since) ?? invAdapter.pullRemote(db, userId, since).then(() => null),
        boxAdapter.fetchRemote?.(userId, since) ?? boxAdapter.pullRemote(db, userId, since).then(() => null),
        garmentAdapter.fetchRemote?.(userId, since) ?? garmentAdapter.pullRemote(db, userId, since).then(() => null),
        chatSessionAdapter.fetchRemote?.(userId, since) ?? chatSessionAdapter.pullRemote(db, userId, since).then(() => null),
      ]);

      // Combinar los IDs de sesiones remotas recibidas de Supabase + los IDs locales de SQLite
      const remoteSessionIds: string[] = Array.isArray(chatSessionData) ? chatSessionData.map((s: any) => String(s.id)) : [];
      const userSessionRows = await db.getAllAsync<{ id: string }>(
        `SELECT id FROM chat_sessions WHERE (user_id = ? OR user_id IS NULL OR user_id = '') AND deleted_at IS NULL`,
        [userId]
      );
      const localSessionIds: string[] = userSessionRows?.map(s => String(s.id)) || [];
      const allSessionIds = Array.from(new Set([...remoteSessionIds, ...localSessionIds]));

      // Determinar si debemos hacer pull completo de mensajes si chat_history local está vacío
      const localMsgCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM chat_history');
      const messagesSince = (!localMsgCount || localMsgCount.count === 0) ? null : since;

      // Ahora sí, descargar los mensajes de TODAS las sesiones pertenecientes al usuario
      const chatMessageData = allSessionIds.length > 0
        ? await ((chatHistoryAdapter as any).fetchRemote?.(userId, messagesSince, allSessionIds) ?? chatHistoryAdapter.pullRemote(db, userId, messagesSince).then(() => null))
        : [];

      // === FASE 2: Escribir a SQLite SECUENCIALMENTE (una transacción a la vez) ===
      // Orden: Inventarios → Cajas → Prendas → Sesiones → Mensajes (respeta claves foráneas)
      const applyTasks: Array<{ adapter: any; data: any }> = [
        { adapter: invAdapter, data: invData },
        { adapter: boxAdapter, data: boxData },
        { adapter: garmentAdapter, data: garmentData },
        { adapter: chatSessionAdapter, data: chatSessionData },
        { adapter: chatHistoryAdapter, data: chatMessageData },
      ];

      for (const { adapter, data } of applyTasks) {
        if (data === null || data === undefined) {
          totalResult.success = false;
          totalResult.errors?.push(`Falló la descarga de ${adapter.tableName}`);
          continue;
        }
        try {
          if (adapter.applyRemote) {
            const res = await adapter.applyRemote(db, userId, since, data);
            totalResult.pulledCount += res.pulledCount;
            if (!res.success) {
              totalResult.success = false;
              if (res.errors) totalResult.errors?.push(...res.errors);
            }
          }
        } catch (adapterErr: any) {
          totalResult.success = false;
          totalResult.errors?.push(adapterErr.message || String(adapterErr));
        }
      }

      // Los DELETE físicos no aparecen en SELECT updated_at > cursor.
      // Aplicarlos al final evita reinsertarlos desde una descarga que empezó antes del borrado.
      const deletions = await syncRemoteDeletions(db, userId, forceFull);
      totalResult.pulledCount += deletions.pulledCount;
      if (!deletions.success) {
        totalResult.success = false;
        totalResult.errors?.push(...(deletions.errors || []));
      }
      if (totalResult.success) {
        await this.setLastSyncTime(syncStartedAt, userId);
      }
    } catch (e: any) {
      totalResult.success = false;
    }
    return totalResult;
  }

  async fullSync(
    db: SQLiteDatabase,
    userId: string,
    silent: boolean = false,
    forceFullPull: boolean = false
  ): Promise<{ success: boolean; syncedAt: string }> {
    return this.acquireLock(async () => {
      try {
        if (!silent) {
          useAppStore.getState().setSyncing(true, 'Sincronizando datos...');
        }

        // Secuencial: primero subir, después descargar usando los métodos internos para no bloquearse en el mutex
        const pushRes = await this.executePushAllPending(db, userId);
        const pullRes = await this.executePullAll(db, userId, forceFullPull);

        const success = pushRes.success && pullRes.success;
        if (success) {
          await this.clearSafetySnapshotIfSynced(db, userId);
        }
        const syncedAt = (await this.getLastSyncTime(userId)) || new Date().toISOString();
        return {
          success,
          syncedAt,
        };
      } catch (e) {
        console.error('Error in fullSync:', e);
        return { success: false, syncedAt: new Date().toISOString() };
      } finally {
        if (!silent) {
          useAppStore.getState().setSyncing(false);
        }
      }
    });
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
    await db.runAsync('DELETE FROM app_settings WHERE key LIKE ?', [`${DELETION_CURSOR_PREFIX}%`]);
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
