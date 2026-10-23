import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';
import { Inventory } from '../../types';
import { fetchRemotePages } from '../fetchRemotePages';
import { withSerializedTransaction } from '../../database/serializedTransaction';
import { claimPendingRows, finishClaimedRows } from '../claimedRows';

export class InventorySyncAdapter implements SyncAdapter {
  tableName = 'inventories';

  async pushLocal(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<Inventory>(
        // El inventario es compartido: Admin/Editor también modifica lotes de otra cuenta.
        // Supabase sigue validando el permiso mediante RLS.
        `SELECT * FROM inventories WHERE sync_status IN ('PENDING', 'FAILED')`
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const claimedRows = await claimPendingRows(db, 'inventories', pendingRows, userId);
      if (claimedRows.length === 0) return result;

      const payload = claimedRows.map(row => ({
        id: row.id,
        user_id: row.user_id || userId,
        name: row.name,
        description: row.description ?? '',
        status: row.deleted_at ? 0 : (row.status === 0 ? 0 : 1),
        order_index: row.order_index ?? (row as any).orden ?? 0,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
        deleted_by: row.deleted_by || null,
        deletion_batch_id: row.deletion_batch_id || null,
      }));

      let { error } = await supabase.from('inventories').upsert(payload, { onConflict: 'id' });

      if (error && (error.message?.includes('order_index') || error.message?.includes('orden'))) {
        const fallbackPayload = payload.map(item => {
          const { order_index, ...rest } = item as any;
          return { ...rest, orden: order_index };
        });
        const fallbackRes = await supabase.from('inventories').upsert(fallbackPayload, { onConflict: 'id' });
        error = fallbackRes.error;
      }

      if (error) {
        console.error('Error pushing inventories to Supabase:', error);
        await finishClaimedRows(db, 'inventories', claimedRows, 'FAILED');
        result.success = false;
        result.errors = [error.message];
      } else {
        await finishClaimedRows(db, 'inventories', claimedRows, 'SYNCED');
        result.pushedCount = claimedRows.length;
      }
    } catch (e: any) {
      console.error('Exception in InventorySyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  /** Fase 1: Solo HTTP - Descarga inventarios de Supabase */
  async fetchRemote(_userId: string, since: string | null): Promise<any[] | null> {
    return fetchRemotePages('inventories', query =>
      since ? query.gt('updated_at', since) : query
    );
  }

  /** Fase 2: Solo SQLite - Escribe datos pre-descargados */
  async applyRemote(db: SQLiteDatabase, _userId: string, since: string | null, remoteRows: any[]): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      if (!remoteRows) return result;

      await withSerializedTransaction(db, async () => {
        // En pull completo, solo limpiar lotes huérfanos que ya estuvieran en papelera y sincronizados
        if (since === null && remoteRows.length > 0) {
          const remoteIds = new Set(remoteRows.map(r => r.id));
          const localRows = await db.getAllAsync<{ id: string }>(
            `SELECT id FROM inventories WHERE sync_status = 'SYNCED' AND deleted_at IS NOT NULL`
          );
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM garments WHERE box_id IN (SELECT id FROM boxes WHERE inventory_id = ?)', [localRow.id]);
              await db.runAsync('DELETE FROM boxes WHERE inventory_id = ?', [localRow.id]);
              await db.runAsync('DELETE FROM inventories WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const nameVal = r.name || '';
          const descVal = r.description || '';
          const createdVal = r.created_at || new Date().toISOString();
          const statusVal = (r.deleted_at || r.status === 0 || r.status === 'Inactivo') ? 0 : 1;
          const orderIndexVal = r.order_index ?? r.orden ?? 0;
          const deletedAtVal = r.deleted_at || null;
          const deletedByVal = r.deleted_by || null;
          const batchIdVal = r.deletion_batch_id || null;

          await db.runAsync(
            `INSERT INTO inventories (id, user_id, name, description, created_at, status, order_index, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
             ON CONFLICT(id) DO UPDATE SET 
               name = excluded.name,
               description = excluded.description,
               created_at = excluded.created_at,
               status = excluded.status,
               order_index = excluded.order_index,
               updated_at = excluded.updated_at,
               deleted_at = excluded.deleted_at,
               deleted_by = excluded.deleted_by,
               deletion_batch_id = excluded.deletion_batch_id,
               sync_status = 'SYNCED'
             WHERE inventories.sync_status = 'SYNCED'
               AND (excluded.updated_at >= inventories.updated_at OR inventories.updated_at IS NULL)`,
            [
              r.id,
              r.user_id,
              nameVal,
              descVal,
              createdVal,
              statusVal,
              orderIndexVal,
              r.updated_at,
              deletedAtVal,
              deletedByVal,
              batchIdVal,
            ]
          );
          result.pulledCount++;
        }
      });
    } catch (e: any) {
      console.error('Exception in InventorySyncAdapter.applyRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  /** Método legacy que hace HTTP + SQLite junto (usado como fallback) */
  async pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult> {
    const data = await this.fetchRemote(userId, since);
    if (data === null) return { success: false, pushedCount: 0, pulledCount: 0, errors: ['Fetch failed'] };
    return this.applyRemote(db, userId, since, data);
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM inventories');
    } catch (e) {
      console.error('Error cleaning inventories:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(`UPDATE inventories SET user_id = ?, sync_status = 'PENDING', updated_at = ? WHERE user_id IS NULL OR user_id = ''`, [userId, now]);
    } catch (e) {
      console.error('Error adopting inventories:', e);
    }
  }
}

export default InventorySyncAdapter;
