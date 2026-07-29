import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';

export class CajaSyncAdapter implements SyncAdapter {
  tableName = 'cajas';

  async pushLocal(db: SQLiteDatabase, _userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<any>(
        `SELECT * FROM cajas WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const ids = pendingRows.map(r => r.id);
      for (const id of ids) {
        await db.runAsync(`UPDATE cajas SET sync_status = 'SYNCING' WHERE id = ?`, [id]);
      }

      const payload = pendingRows.map(row => ({
        id: row.id,
        inventory_id: row.inventory_id ?? row.inventarioId,
        name: row.name ?? row.nombre,
        created_at: row.created_at ?? row.fechaCreacion ?? new Date().toISOString(),
        order_index: row.order_index ?? row.orden ?? 0,
        updated_at: row.updated_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('boxes').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error al hacer push de cajas a Supabase:', error);
        for (const id of ids) {
          await db.runAsync(`UPDATE cajas SET sync_status = 'FAILED' WHERE id = ?`, [id]);
        }
        result.success = false;
        result.errors = [error.message];
      } else {
        for (const id of ids) {
          await db.runAsync(`UPDATE cajas SET sync_status = 'SYNCED' WHERE id = ?`, [id]);
        }
        result.pushedCount = pendingRows.length;
      }
    } catch (e: any) {
      console.error('Excepción en CajaSyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, _userId: string, since: string | null): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      let query = supabase.from('boxes').select('*');
      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        console.error('Error al hacer pull de cajas desde Supabase:', error);
        result.success = false;
        result.errors = [error.message];
        return result;
      }

      if (!remoteRows) {
        return result;
      }

      await db.withTransactionAsync(async () => {
        if (since === null) {
          const remoteIds = new Set(remoteRows.map(r => r.id));
          const localRows = await db.getAllAsync<{ id: string }>('SELECT id FROM cajas');
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM prendas WHERE cajaId = ?', [localRow.id]);
              await db.runAsync('DELETE FROM cajas WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const local = await db.getFirstAsync<any>('SELECT * FROM cajas WHERE id = ?', [r.id]);
          const invIdVal = r.inventory_id || r.inventarioId;
          const nombreVal = r.name || r.nombre || '';
          const fechaVal = r.created_at || r.fechaCreacion || new Date().toISOString();
          const ordenVal = r.order_index ?? r.orden ?? 0;

          if (invIdVal) {
            const parentInv = await db.getFirstAsync('SELECT id FROM inventarios WHERE id = ?', [invIdVal]);
            if (!parentInv) {
              await db.runAsync(
                `INSERT OR IGNORE INTO inventarios (id, nombre, descripcion, fechaCreacion, estado, updated_at, sync_status) VALUES (?, 'Nuevo Lote', '', ?, 'Activo', ?, 'SYNCED')`,
                [invIdVal, fechaVal, r.updated_at || fechaVal]
              );
            }
          }

          if (!local) {
            await db.runAsync(
              `INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion, orden, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                invIdVal,
                nombreVal,
                fechaVal,
                ordenVal,
                r.updated_at,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

            if (remoteTime >= localTime) {
              await db.runAsync(
                `UPDATE cajas SET inventarioId = ?, nombre = ?, fechaCreacion = ?, orden = ?, updated_at = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  invIdVal,
                  nombreVal,
                  fechaVal,
                  ordenVal,
                  r.updated_at,
                  r.id,
                ]
              );
              result.pulledCount++;
            }
          }
        }
      });
    } catch (e: any) {
      console.error('Excepción en CajaSyncAdapter.pullRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM cajas');
    } catch (e) {
      console.error('Error al limpiar cajas locales:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, _userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE cajas SET sync_status = 'PENDING', updated_at = ? WHERE sync_status IS NULL OR sync_status = ''`,
        [now]
      );
    } catch (e) {
      console.error('Error al adoptar cajas:', e);
    }
  }
}
