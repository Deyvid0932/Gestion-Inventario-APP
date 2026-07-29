import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';
import { R2Service } from '../../services/r2Service';

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

      // Procesar subida de imágenes a Cloudflare R2 si existen en local (file://)
      for (const row of pendingRows) {
        let updatedR2Key = row.r2Key;
        let updatedR2Key2 = row.r2Key2;

        if (row.fotoUri && !row.fotoUri.startsWith('http') && !row.r2Key) {
         // console.log(`📸 Subiendo foto 1 a Cloudflare R2 (Prenda: ${row.id}, URI: ${row.fotoUri})...`);
          const key = await R2Service.uploadPhotoToR2(row.fotoUri, row.id, 1);
          //console.log(`📌 R2 Key 1 resultado:`, key);
          if (key) {
            updatedR2Key = key;
            await db.runAsync(`UPDATE prendas SET r2Key = ? WHERE id = ?`, [key, row.id]);
          }
        }

        if (row.fotoUri2 && !row.fotoUri2.startsWith('http') && !row.r2Key2) {
          //console.log(`📸 Subiendo foto 2 a Cloudflare R2 (Prenda: ${row.id}, URI: ${row.fotoUri2})...`);
          const key2 = await R2Service.uploadPhotoToR2(row.fotoUri2, row.id, 2);
          //console.log(`📌 R2 Key 2 resultado:`, key2);
          if (key2) {
            updatedR2Key2 = key2;
            await db.runAsync(`UPDATE prendas SET r2Key2 = ? WHERE id = ?`, [key2, row.id]);
          }
        }

        row.r2Key = updatedR2Key;
        row.r2Key2 = updatedR2Key2;
      }

      // Construir payload enviando directamente a la tabla garments de Supabase
      const payload = pendingRows.map(row => ({
        id: row.id,
        box_id: row.box_id ?? row.cajaId,
        op: row.op || '',
        style: row.style ?? row.estilo,
        color: row.color,
        status: row.status ?? row.estado,
        created_at: row.created_at ?? row.fechaCreacion ?? new Date().toISOString(),
        alarm_datetime: row.alarm_datetime ?? row.alarmaFechaHora ?? null,
        alarm_notification_id: row.alarm_notification_id ?? row.alarmaNotificationId ?? null,
        r2_key: row.r2_key ?? row.r2Key ?? null,
        r2_key_2: row.r2_key_2 ?? row.r2Key2 ?? null,
        updated_at: row.updated_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('garments').upsert(payload, { onConflict: 'id' });

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
      let query = supabase.from('garments').select('*');
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
          const boxIdVal = r.box_id || r.cajaId;
          const styleVal = r.style || r.estilo || '';
          const colorVal = r.color || '';
          const sizeVal = r.size || r.talla || '';
          const statusVal = r.status ?? r.estado ?? 1;
          const fechaVal = r.created_at || r.fechaCreacion || new Date().toISOString();
          const alarmDateVal = r.alarm_datetime || r.alarmaFechaHora || null;
          const alarmNotifIdVal = r.alarm_notification_id || r.alarmaNotificationId || null;
          const r2KeyVal = r.r2_key || r.r2Key || null;
          const r2Key2Val = r.r2_key_2 || r.r2Key2 || null;

          if (boxIdVal) {
            const parentCaja = await db.getFirstAsync('SELECT id FROM cajas WHERE id = ?', [boxIdVal]);
            if (!parentCaja) {
              await db.runAsync(
                `INSERT OR IGNORE INTO cajas (id, inventarioId, nombre, fechaCreacion, orden, updated_at, sync_status) VALUES (?, '', 'Caja Sincronizada', ?, 0, ?, 'SYNCED')`,
                [boxIdVal, fechaVal, r.updated_at || fechaVal]
              );
            }
          }

          if (!local) {
            await db.runAsync(
              `INSERT INTO prendas (id, cajaId, op, estilo, color, talla, fotoUri, fotoUri2, r2Key, r2Key2, estado, fechaCreacion, alarmaFechaHora, alarmaNotificationId, updated_at, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
              [
                r.id,
                boxIdVal,
                r.op || '',
                styleVal,
                colorVal,
                sizeVal,
                r.fotoUri || null,
                r.fotoUri2 || null,
                r2KeyVal,
                r2Key2Val,
                statusVal,
                fechaVal,
                alarmDateVal,
                alarmNotifIdVal,
                r.updated_at,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

            if (remoteTime >= localTime) {
              await db.runAsync(
                `UPDATE prendas SET cajaId = ?, op = ?, estilo = ?, color = ?, talla = ?, r2Key = ?, r2Key2 = ?, estado = ?, fechaCreacion = ?, alarmaFechaHora = ?, alarmaNotificationId = ?, updated_at = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  boxIdVal,
                  r.op || '',
                  styleVal,
                  colorVal,
                  sizeVal,
                  r2KeyVal || local.r2Key || null,
                  r2Key2Val || local.r2Key2 || null,
                  statusVal,
                  fechaVal,
                  alarmDateVal,
                  alarmNotifIdVal,
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
