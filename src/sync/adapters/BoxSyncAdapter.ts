import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';
import { Box } from '../../types';
import { fetchRemotePages } from '../fetchRemotePages';
import { withSerializedTransaction } from '../../database/serializedTransaction';
import { claimPendingRows, finishClaimedRows } from '../claimedRows';

export class BoxSyncAdapter implements SyncAdapter {
  tableName = 'boxes';

  async pushLocal(db: SQLiteDatabase, _userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<Box>(
        `SELECT * FROM boxes WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const claimedRows = await claimPendingRows(db, 'boxes', pendingRows);
      if (claimedRows.length === 0) return result;

      const payload = claimedRows.map(row => ({
        id: row.id,
        inventory_id: row.inventory_id,
        name: row.name,
        created_at: row.created_at ?? new Date().toISOString(),
        order_index: row.order_index ?? (row as any).orden ?? 0,
        updated_at: row.updated_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
        deleted_by: row.deleted_by || null,
        deletion_batch_id: row.deletion_batch_id || null,
      }));

      let { error } = await supabase.from('boxes').upsert(payload, { onConflict: 'id' });

      if (error && (error.message?.includes('order_index') || error.message?.includes('orden'))) {
        const fallbackPayload = payload.map(item => {
          const { order_index, ...rest } = item as any;
          return { ...rest, orden: order_index };
        });
        const fallbackRes = await supabase.from('boxes').upsert(fallbackPayload, { onConflict: 'id' });
        error = fallbackRes.error;
      }

      if (error) {
        console.error('Error pushing boxes to Supabase:', error);
        await finishClaimedRows(db, 'boxes', claimedRows, 'FAILED');
        result.success = false;
        result.errors = [error.message];
      } else {
        await finishClaimedRows(db, 'boxes', claimedRows, 'SYNCED');
        result.pushedCount = claimedRows.length;
      }
    } catch (e: any) {
      console.error('Exception in BoxSyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  /** Fase 1: Solo HTTP */
  async fetchRemote(_userId: string, since: string | null): Promise<any[] | null> {
    return fetchRemotePages('boxes', query =>
      since ? query.gt('updated_at', since) : query
    );
  }

  /** Fase 2: Solo SQLite */
  async applyRemote(db: SQLiteDatabase, _userId: string, since: string | null, remoteRows: any[]): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      if (!remoteRows) return result;

      await withSerializedTransaction(db, async () => {
        // En pull completo, solo limpiar cajas huérfanas que ya estuvieran en papelera y sincronizadas
        if (since === null && remoteRows.length > 0) {
          const remoteIds = new Set(remoteRows.map(r => r.id));
          const localRows = await db.getAllAsync<{ id: string }>(
            `SELECT id FROM boxes WHERE sync_status = 'SYNCED' AND deleted_at IS NOT NULL`
          );
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM garments WHERE box_id = ?', [localRow.id]);
              await db.runAsync('DELETE FROM boxes WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const nameVal = r.name || '';
          const inventoryIdVal = r.inventory_id;
          const fechaVal = r.created_at || new Date().toISOString();
          const orderIndexVal = r.order_index ?? r.orden ?? 0;
          const deletedAtVal = r.deleted_at || null;
          const deletedByVal = r.deleted_by || null;
          const batchIdVal = r.deletion_batch_id || null;

          await db.runAsync(
            `INSERT INTO boxes (id, inventory_id, name, created_at, order_index, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
             ON CONFLICT(id) DO UPDATE SET 
               inventory_id = excluded.inventory_id,
               name = excluded.name,
               created_at = excluded.created_at,
               order_index = excluded.order_index,
               updated_at = excluded.updated_at,
               deleted_at = excluded.deleted_at,
               deleted_by = excluded.deleted_by,
               deletion_batch_id = excluded.deletion_batch_id,
               sync_status = 'SYNCED'
             WHERE boxes.sync_status = 'SYNCED'
               AND (excluded.updated_at >= boxes.updated_at OR boxes.updated_at IS NULL)`,
            [
              r.id,
              inventoryIdVal,
              nameVal,
              fechaVal,
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
      console.error('Exception in BoxSyncAdapter.applyRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult> {
    const data = await this.fetchRemote(userId, since);
    if (data === null) return { success: false, pushedCount: 0, pulledCount: 0, errors: ['Fetch failed'] };
    return this.applyRemote(db, userId, since, data);
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM boxes');
    } catch (e) {
      console.error('Error cleaning boxes:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, _userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(`UPDATE boxes SET sync_status = 'PENDING', updated_at = ? WHERE sync_status IS NULL OR sync_status = ''`, [now]);
    } catch (e) {
      console.error('Error adopting boxes:', e);
    }
  }
}

export default BoxSyncAdapter;
