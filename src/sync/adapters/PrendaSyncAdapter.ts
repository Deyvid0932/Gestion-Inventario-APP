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

      // Procesar subida de imágenes a Cloudflare R2 si existen en local (file:// o /)
      for (const row of pendingRows) {
        let updatedR2Key = row.r2Key || row.r2_key || null;
        let updatedR2Key2 = row.r2Key2 || row.r2_key_2 || null;

        const isLocalFoto1 = row.fotoUri && (row.fotoUri.startsWith('file://') || row.fotoUri.startsWith('/'));
        if (isLocalFoto1) {
          const key = await R2Service.uploadPhotoToR2(row.fotoUri, row.id, 1);
          if (key) {
            updatedR2Key = key;
            await db.runAsync(`UPDATE prendas SET r2Key = ? WHERE id = ?`, [key, row.id]);
          }
        }

        const isLocalFoto2 = row.fotoUri2 && (row.fotoUri2.startsWith('file://') || row.fotoUri2.startsWith('/'));
        if (isLocalFoto2) {
          const key2 = await R2Service.uploadPhotoToR2(row.fotoUri2, row.id, 2);
          if (key2) {
            updatedR2Key2 = key2;
            await db.runAsync(`UPDATE prendas SET r2Key2 = ? WHERE id = ?`, [key2, row.id]);
          }
        }

        row.r2Key = updatedR2Key;
        row.r2_key = updatedR2Key;
        row.r2Key2 = updatedR2Key2;
        row.r2_key_2 = updatedR2Key2;
      }

      // Construir payload enviando directamente a la tabla garments de Supabase
      const payload = pendingRows.map(row => ({
        id: row.id,
        box_id: row.box_id ?? row.cajaId,
        op: row.op || '',
        style: row.style ?? row.estilo,
        color: row.color,
        status: row.deleted_at ? 0 : (row.status ?? row.estado),
        created_at: row.created_at ?? row.fechaCreacion ?? new Date().toISOString(),
        alarm_datetime: row.alarm_datetime ?? row.alarmaFechaHora ?? null,
        alarm_notification_id: row.alarm_notification_id ?? row.alarmaNotificationId ?? null,
        r2_key: row.r2Key || row.r2_key || null,
        r2_key_2: row.r2Key2 || row.r2_key_2 || null,
        updated_at: row.updated_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
        deleted_by: row.deleted_by || null,
        deletion_batch_id: row.deletion_batch_id || null,
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
      // 1. Descargar tombstones de eliminación física si aplica
      try {
        let tombQuery = supabase.from('deletion_tombstones').select('*').eq('table_name', 'garments');
        if (since) {
          tombQuery = tombQuery.gt('deleted_at', since);
        }
        const { data: tombstones } = await tombQuery;
        if (tombstones && tombstones.length > 0) {
          for (const t of tombstones) {
            await db.runAsync('DELETE FROM prendas WHERE id = ?', [t.record_id]);
          }
        }
      } catch (tErr) {
        console.warn('Advertencia al consultar deletion_tombstones para prendas:', tErr);
      }

      // 2. Descargar prendas de Supabase
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
          const statusVal = r.deleted_at ? 0 : (r.status ?? r.estado ?? 1);
          const fechaVal = r.created_at || r.fechaCreacion || new Date().toISOString();
          const alarmDateVal = r.alarm_datetime || r.alarmaFechaHora || null;
          const alarmNotifIdVal = r.alarm_notification_id || r.alarmaNotificationId || null;
          const r2KeyVal = r.r2_key || r.r2Key || null;
          const r2Key2Val = r.r2_key_2 || r.r2Key2 || null;
          const deletedAtVal = r.deleted_at || null;
          const deletedByVal = r.deleted_by || null;
          const batchIdVal = r.deletion_batch_id || null;

          if (boxIdVal) {
            const parentCaja = await db.getFirstAsync('SELECT id FROM cajas WHERE id = ?', [boxIdVal]);
            if (!parentCaja) {
              const { data: remoteBox } = await supabase.from('boxes').select('*').eq('id', boxIdVal).maybeSingle();
              if (remoteBox) {
                await db.runAsync(
                  `INSERT OR REPLACE INTO cajas (id, inventarioId, nombre, fechaCreacion, orden, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
                  [
                    remoteBox.id,
                    remoteBox.inventory_id || remoteBox.inventarioId || '',
                    remoteBox.name || remoteBox.nombre || 'Caja Sincronizada',
                    remoteBox.created_at || fechaVal,
                    remoteBox.order_index ?? remoteBox.orden ?? 0,
                    remoteBox.updated_at || fechaVal,
                    remoteBox.deleted_at || null,
                    remoteBox.deleted_by || null,
                    remoteBox.deletion_batch_id || null,
                  ]
                );
              }
            }
          }

          if (!local) {
            await db.runAsync(
              `INSERT INTO prendas (id, cajaId, op, estilo, color, talla, fotoUri, fotoUri2, r2Key, r2Key2, estado, fechaCreacion, alarmaFechaHora, alarmaNotificationId, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
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
                deletedAtVal,
                deletedByVal,
                batchIdVal,
              ]
            );
            result.pulledCount++;
          } else {
            const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
            const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

            if (remoteTime >= localTime) {
              const finalFotoUri = r.fotoUri || local.fotoUri || null;
              const finalFotoUri2 = r.fotoUri2 || local.fotoUri2 || null;
              await db.runAsync(
                `UPDATE prendas SET cajaId = ?, op = ?, estilo = ?, color = ?, talla = ?, fotoUri = ?, fotoUri2 = ?, r2Key = ?, r2Key2 = ?, estado = ?, fechaCreacion = ?, alarmaFechaHora = ?, alarmaNotificationId = ?, updated_at = ?, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, sync_status = 'SYNCED' WHERE id = ?`,
                [
                  boxIdVal,
                  r.op || '',
                  styleVal,
                  colorVal,
                  sizeVal,
                  finalFotoUri,
                  finalFotoUri2,
                  r2KeyVal || local.r2Key || null,
                  r2Key2Val || local.r2Key2 || null,
                  statusVal,
                  fechaVal,
                  alarmDateVal,
                  alarmNotifIdVal,
                  r.updated_at,
                  deletedAtVal,
                  deletedByVal,
                  batchIdVal,
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
