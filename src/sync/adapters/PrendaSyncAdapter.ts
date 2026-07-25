import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';

export class PrendaSyncAdapter implements SyncAdapter {
  tableName = 'prendas';

  async pushLocal(db: SQLiteDatabase, _userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<any>(
        `SELECT * FROM prendas WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
      );

      if (!pendingRows || pendingRows.length === 0) {
        return result;
      }

      const ids = pendingRows.map(r => r.id);
      for (const id of ids) {
        await db.runAsync(`UPDATE prendas SET sync_status = 'SYNCING' WHERE id = ?`, [id]);
      }

      const payload = pendingRows.map(row => ({
        id: row.id,
        "cajaId": row.cajaId,
        op: row.op || '',
        estilo: row.estilo,
        color: row.color,
        talla: row.talla || '',
        "fotoUri": row.fotoUri || null,
        "fotoUri2": row.fotoUri2 || null,
        estado: row.estado,
        "fechaCreacion": row.fechaCreacion || new Date().toISOString(),
        "alarmaFechaHora": row.alarmaFechaHora || null,
        "alarmaNotificationId": row.alarmaNotificationId || null,
        updated_at: row.updated_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('prendas').upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Error al hacer push de prendas a Supabase:', error);
        for (const id of ids) {
          await db.runAsync(`UPDATE prendas SET sync_status = 'FAILED' WHERE id = ?`, [id]);
        }
        result.success = false;
        result.errors = [error.message];
      } else {
        for (const id of ids) {
          await db.runAsync(`UPDATE prendas SET sync_status = 'SYNCED' WHERE id = ?`, [id]);
        }
        result.pushedCount = pendingRows.length;
      }
    } catch (e: any) {
      console.error('Excepción en PrendaSyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, _userId: string, since: string | null): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      let query = supabase.from('prendas').select('*');
      if (since) {
        query = query.gt('updated_at', since);
      }

      const { data: remoteRows, error } = await query;
      if (error) {
        console.error('Error al hacer pull de prendas desde Supabase:', error);
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
          const localRows = await db.getAllAsync<{ id: string }>('SELECT id FROM prendas');
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM prendas WHERE id = ?', [localRow.id]);
            }
          }
        }

        for (const r of remoteRows) {
          const local = await db.getFirstAsync<any>('SELECT * FROM prendas WHERE id = ?', [r.id]);

          if (!local) {
            await db.runAsync(
              `INSERT INTO prendas (id, cajaId, op, estilo, color, talla, fotoUri, fotoUri2, estado, fechaCreacion, alarmaFechaHora, alarmaNotificationId, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                r.cajaId,
                r.op || '',
                r.estilo,
                r.color,
                r.talla || '',
                r.fotoUri || null,
                r.fotoUri2 || null,
                r.estado,
                r.fechaCreacion,
                r.alarmaFechaHora || null,
                r.alarmaNotificationId || null,
                r.updated_at,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

            if (remoteTime >= localTime) {
              await db.runAsync(
                `UPDATE prendas SET cajaId = ?, op = ?, estilo = ?, color = ?, talla = ?, fotoUri = ?, fotoUri2 = ?, estado = ?, fechaCreacion = ?, alarmaFechaHora = ?, alarmaNotificationId = ?, updated_at = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  r.cajaId,
                  r.op || '',
                  r.estilo,
                  r.color,
                  r.talla || '',
                  r.fotoUri || null,
                  r.fotoUri2 || null,
                  r.estado,
                  r.fechaCreacion,
                  r.alarmaFechaHora || null,
                  r.alarmaNotificationId || null,
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
      console.error('Excepción en PrendaSyncAdapter.pullRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM prendas');
    } catch (e) {
      console.error('Error al limpiar prendas locales:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, _userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(`UPDATE prendas SET sync_status = 'PENDING', updated_at = ? WHERE sync_status IS NULL OR sync_status = ''`, [now]);
    } catch (e) {
      console.error('Error al adoptar prendas:', e);
    }
  }
}
