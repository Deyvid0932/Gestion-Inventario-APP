import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';
import { Inventario } from '../../types';

export class InventarioSyncAdapter implements SyncAdapter {
  tableName = 'inventarios';

  async pushLocal(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<Inventario>(
        `SELECT * FROM inventarios WHERE (sync_status = 'PENDING' OR sync_status = 'FAILED') AND (user_id = ? OR user_id IS NULL OR user_id = '')`,
        [userId]
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const ids = pendingRows.map(r => r.id);
      for (const id of ids) {
        await db.runAsync(`UPDATE inventarios SET sync_status = 'SYNCING', user_id = ? WHERE id = ?`, [userId, id]);
      }

      const payload = pendingRows.map(row => ({
        id: row.id,
        user_id: userId,
        name: (row as any).name ?? row.nombre,
        description: (row as any).description ?? row.descripcion ?? '',
        status: (row as any).active === false || (row as any).estado === 'Inactivo' || (row as any).estado === 0 || (row as any).status === 0 ? 0 : 1,
        created_at: (row as any).created_at ?? row.fechaCreacion ?? new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('inventories').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error al hacer push de inventarios a Supabase:', error);
        for (const id of ids) {
          await db.runAsync(`UPDATE inventarios SET sync_status = 'FAILED' WHERE id = ?`, [id]);
        }
        result.success = false;
        result.errors = [error.message];
      } else {
        for (const id of ids) {
          await db.runAsync(`UPDATE inventarios SET sync_status = 'SYNCED' WHERE id = ?`, [id]);
        }
        result.pushedCount = pendingRows.length;
      }
    } catch (e: any) {
      console.error('Excepción en InventarioSyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      let query = supabase.from('inventories').select('*');
      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        console.error('Error al hacer pull de inventarios desde Supabase:', error);
        result.success = false;
        result.errors = [error.message];
        return result;
      }

      if (!remoteRows) {
        return result;
      }

      await db.withTransactionAsync(async () => {
        // Purgar localmente si fue un pull completo (since === null) y el registro no está en Supabase
        if (since === null) {
          const remoteIds = new Set(remoteRows.map(r => r.id));
          const localRows = await db.getAllAsync<{ id: string }>('SELECT id FROM inventarios');
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM prendas WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?)', [localRow.id]);
              await db.runAsync('DELETE FROM cajas WHERE inventarioId = ?', [localRow.id]);
              await db.runAsync('DELETE FROM inventarios WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const local = await db.getFirstAsync<Inventario>('SELECT * FROM inventarios WHERE id = ?', [r.id]);
          const nombreVal = r.name || r.nombre || '';
          const descVal = r.description || r.descripcion || '';
          const fechaVal = r.created_at || r.fechaCreacion || new Date().toISOString();
          const estadoVal = (r.status === 0 || r.status === 'Inactivo' || r.estado === 'Inactivo') ? 'Inactivo' : 'Activo';

          if (!local) {
            await db.runAsync(
              `INSERT INTO inventarios (id, user_id, nombre, descripcion, fechaCreacion, estado, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                r.user_id,
                nombreVal,
                descVal,
                fechaVal,
                estadoVal,
                r.updated_at,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;
            const isPlaceholder = !local.nombre || local.nombre === 'Lote Sincronizado' || local.nombre.includes('Sincroniz');

            if (remoteTime >= localTime || isPlaceholder) {
              await db.runAsync(
                `UPDATE inventarios SET user_id = ?, nombre = ?, descripcion = ?, fechaCreacion = ?, estado = ?, updated_at = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  r.user_id,
                  nombreVal || local.nombre,
                  descVal,
                  fechaVal,
                  estadoVal,
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
      console.error('Excepción en InventarioSyncAdapter.pullRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM inventarios');
    } catch (e) {
      console.error('Error al limpiar inventarios locales:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE inventarios SET user_id = ?, sync_status = 'PENDING', updated_at = ? WHERE user_id IS NULL OR user_id = ''`,
        [userId, now]
      );
    } catch (e) {
      console.error('Error al adoptar inventarios para el usuario:', e);
    }
  }
}
