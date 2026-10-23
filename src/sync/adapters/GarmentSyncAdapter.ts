import { SQLiteDatabase } from 'expo-sqlite';
import { SyncAdapter, SyncResult } from '../SyncAdapter';
import { supabase } from '../../database/supabase';
import { R2Service } from '../../services/cloud/r2Service';
import { Garment } from '../../types';
import { fetchRemotePages } from '../fetchRemotePages';
import { withSerializedTransaction } from '../../database/serializedTransaction';
import { claimPendingRows, finishClaimedRows } from '../claimedRows';

interface GarmentFetchResult {
  garments: any[] | null;
  images: any[] | null;
  alarms: any[] | null;
}

async function batchUpdateSyncStatus(
  db: SQLiteDatabase,
  tableName: string,
  ids: string[],
  status: string
): Promise<void> {
  if (!ids || ids.length === 0) return;
  const BATCH_SIZE = 400;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE ${tableName} SET sync_status = '${status}' WHERE id IN (${placeholders})`,
      chunk
    );
  }
}

export class GarmentSyncAdapter implements SyncAdapter {
  tableName = 'garments';

  async pushLocal(db: SQLiteDatabase, _userId: string): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const pendingRows = await db.getAllAsync<Garment>(
        `SELECT * FROM garments WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
      );

      const claimedRows = await claimPendingRows(db, 'garments', pendingRows);

      // Check for local images needing R2 upload (subida controlada en lotes de 3 para no saturar red)
      const pendingImages = await db.getAllAsync<{ id: string; garment_id: string; uri?: string; order_index: number; storage_key?: string }>(
        `SELECT id, garment_id, uri, order_index, storage_key FROM garment_images
         WHERE (sync_status = 'PENDING' OR sync_status = 'FAILED') AND deleted_at IS NULL`
      );

      if (pendingImages && pendingImages.length > 0) {
        const CHUNK_SIZE = 3;
        for (let i = 0; i < pendingImages.length; i += CHUNK_SIZE) {
          const chunk = pendingImages.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (img) => {
              if (img.uri && (img.uri.startsWith('file://') || img.uri.startsWith('/')) && !img.storage_key) {
                const slot = ((img.order_index ?? 0) >= 1 ? 2 : 1) as (1 | 2);
                const key = await R2Service.uploadPhotoToR2(img.uri, img.garment_id, slot);
                if (key) {
                  await db.runAsync(`UPDATE garment_images SET storage_key = ?, storage = 'BOTH' WHERE id = ?`, [key, img.id]);
                }
              }
            })
          );
        }
      }

      const payload = claimedRows.map(row => ({
        id: row.id,
        box_id: row.box_id,
        op: row.op || '',
        style: row.style,
        color: row.color,
        shipping_at: row.shipping_at || null,
        status: row.deleted_at ? 0 : (row.status ?? 1),
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
        deleted_by: row.deleted_by || null,
        deletion_batch_id: row.deletion_batch_id || null,
      }));

      const CHUNK_SIZE = 100;
      let totalPushed = 0;

      for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
        const chunk = payload.slice(i, i + CHUNK_SIZE);
        const chunkRows = claimedRows.slice(i, i + CHUNK_SIZE);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de red al sincronizar lote de prendas')), 12000)
        );

        const upsertPromise = supabase.from('garments').upsert(chunk, { onConflict: 'id' });
        const { error }: any = await Promise.race([upsertPromise, timeoutPromise]).catch(err => ({ error: err }));

        if (error) {
          console.error('Error pushing garments chunk to Supabase:', error);
          await finishClaimedRows(db, 'garments', chunkRows, 'FAILED');
          result.success = false;
          if (!result.errors) result.errors = [];
          result.errors.push(error.message || String(error));
        } else {
          await finishClaimedRows(db, 'garments', chunkRows, 'SYNCED');
          totalPushed += chunk.length;
        }
      }

      result.pushedCount = totalPushed;

      // Sincronizar garment_images a Supabase (actualización en masa)
      try {
        const imagesToSync = await db.getAllAsync<any>(
          `SELECT * FROM garment_images WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
        );
        if (imagesToSync && imagesToSync.length > 0) {
          const imagesWithoutUpload = imagesToSync.filter(img => !img.deleted_at && !img.storage_key);
          if (imagesWithoutUpload.length > 0) {
            await batchUpdateSyncStatus(db, 'garment_images', imagesWithoutUpload.map(img => img.id), 'FAILED');
            result.success = false;
            result.errors = [...(result.errors || []), `${imagesWithoutUpload.length} foto(s) pendientes de subir a R2`];
          }

          const readyImages = imagesToSync.filter(img => img.deleted_at || img.storage_key);
          const imagePayload = readyImages.map(img => ({
            id: img.id,
            garment_id: img.garment_id,
            storage_key: img.storage_key,
            storage: img.storage || 'CLOUD',
            order_index: img.order_index ?? 0,
            is_primary: !!img.is_primary,
            created_at: img.created_at,
            updated_at: img.updated_at || new Date().toISOString(),
            deleted_at: img.deleted_at || null,
            deleted_by: img.deleted_by || null,
            deletion_batch_id: img.deletion_batch_id || null,
          }));
          if (imagePayload.length > 0) {
            const { error: imgErr } = await supabase.from('garment_images').upsert(imagePayload, { onConflict: 'id' });
            if (!imgErr) {
              await batchUpdateSyncStatus(db, 'garment_images', readyImages.map(img => img.id), 'SYNCED');
            } else {
              result.success = false;
              result.errors = [...(result.errors || []), imgErr.message];
            }
          }
        }
      } catch (imgErr) {
        console.warn('Garment images sync warning:', imgErr);
        result.success = false;
        result.errors = [...(result.errors || []), imgErr instanceof Error ? imgErr.message : String(imgErr)];
      }

      // Sincronizar garment_alarms a Supabase (actualización en masa)
      try {
        const alarmsToSync = await db.getAllAsync<any>(
          `SELECT * FROM garment_alarms WHERE sync_status = 'PENDING' OR sync_status = 'FAILED'`
        );
        if (alarmsToSync && alarmsToSync.length > 0) {
          const alarmPayload = alarmsToSync.map(alm => ({
            id: alm.id,
            garment_id: alm.garment_id,
            alarm_datetime: alm.alarm_datetime,
            expires_at: alm.expires_at || null,
            notification_id: alm.notification_id || null,
            status: alm.status || 'PENDING',
            created_at: alm.created_at,
            updated_at: alm.updated_at || new Date().toISOString(),
            deleted_at: alm.deleted_at || null,
            deleted_by: alm.deleted_by || null,
            deletion_batch_id: alm.deletion_batch_id || null,
          }));
          const { error: almErr } = await supabase.from('garment_alarms').upsert(alarmPayload, { onConflict: 'id' });
          if (!almErr) {
            const almIds = alarmsToSync.map(alm => alm.id);
            await batchUpdateSyncStatus(db, 'garment_alarms', almIds, 'SYNCED');
          } else {
            result.success = false;
            result.errors = [...(result.errors || []), almErr.message];
          }
        }
      } catch (almErr) {
        console.warn('Garment alarms sync warning:', almErr);
        result.success = false;
        result.errors = [...(result.errors || []), almErr instanceof Error ? almErr.message : String(almErr)];
      }
    } catch (e: any) {
      console.error('Exception in GarmentSyncAdapter.pushLocal:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  /** Fase 1: Solo HTTP - Descarga prendas + imágenes + alarmas en paralelo */
  async fetchRemote(_userId: string, since: string | null): Promise<GarmentFetchResult> {
    try {
      const configure = (query: any) => since ? query.gt('updated_at', since) : query;
      const [garments, images, alarms] = await Promise.all([
        fetchRemotePages('garments', configure),
        fetchRemotePages('garment_images', configure),
        fetchRemotePages('garment_alarms', configure),
      ]);

      return {
        garments,
        images,
        alarms,
      };
    } catch (e) {
      console.error('Exception in GarmentSyncAdapter.fetchRemote:', e);
      return { garments: null, images: null, alarms: null };
    }
  }

  /** Fase 2: Solo SQLite - Escribe prendas + imágenes + alarmas pre-descargadas */
  async applyRemote(db: SQLiteDatabase, _userId: string, since: string | null, fetchResult: GarmentFetchResult): Promise<SyncResult> {
    const result: SyncResult = { success: true, pushedCount: 0, pulledCount: 0 };
    try {
      const remoteRows = fetchResult.garments;
      if (!remoteRows || !fetchResult.images || !fetchResult.alarms) {
        return { success: false, pushedCount: 0, pulledCount: 0, errors: ['Descarga incompleta de prendas, imágenes o alarmas'] };
      }
      if (remoteRows.length === 0 && fetchResult.images.length === 0 && fetchResult.alarms.length === 0) return result;

      await withSerializedTransaction(db, async () => {
        // En pull completo, solo limpiar prendas huérfanas que ya estuvieran en papelera y sincronizadas
        if (since === null && remoteRows.length > 0) {
          const remoteIds = new Set(remoteRows.map(r => r.id));
          const localRows = await db.getAllAsync<{ id: string }>(
            `SELECT id FROM garments WHERE sync_status = 'SYNCED' AND deleted_at IS NOT NULL`
          );
          for (const localRow of localRows) {
            if (!remoteIds.has(localRow.id)) {
              await db.runAsync('DELETE FROM garments WHERE id = ?', [localRow.id]);
            }
          }
        }

        // 1. Asegurar cajas padres faltantes en una sola consulta por lote
        const localBoxRows = await db.getAllAsync<{ id: string }>('SELECT id FROM boxes');
        const localBoxIds = new Set(localBoxRows.map(b => b.id));
        const missingBoxIds = Array.from(new Set(remoteRows.map(r => r.box_id).filter(bId => bId && !localBoxIds.has(bId))));

        if (missingBoxIds.length > 0) {
          try {
            const { data: remoteBoxes } = await supabase.from('boxes').select('*').in('id', missingBoxIds);
            if (remoteBoxes && remoteBoxes.length > 0) {
              for (const rb of remoteBoxes) {
                await db.runAsync(
                  `INSERT OR REPLACE INTO boxes (id, inventory_id, name, created_at, order_index, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')`,
                  [
                    rb.id,
                    rb.inventory_id,
                    rb.name || 'Caja Sincronizada',
                    rb.created_at || new Date().toISOString(),
                    rb.order_index ?? 0,
                    rb.updated_at || new Date().toISOString(),
                    rb.deleted_at || null,
                    rb.deleted_by || null,
                    rb.deletion_batch_id || null,
                  ]
                );
              }
            }
          } catch (boxFetchErr) {
            console.warn('Warning pre-fetching missing boxes for garments:', boxFetchErr);
          }
        }

        // 2. Upsert masivo de prendas
        for (const r of remoteRows) {
          const boxIdVal = r.box_id;
          const styleVal = r.style || '';
          const colorVal = r.color || '';
          const sizeVal = r.size || null;
          const statusVal = r.deleted_at ? 0 : (r.status ?? 1);
          const createdVal = r.created_at || new Date().toISOString();
          const deletedAtVal = r.deleted_at || null;
          const deletedByVal = r.deleted_by || null;
          const batchIdVal = r.deletion_batch_id || null;

          await db.runAsync(
            `INSERT INTO garments (id, box_id, op, style, color, size, shipping_at, status, created_at, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
             ON CONFLICT(id) DO UPDATE SET
               box_id = excluded.box_id,
               op = excluded.op,
               style = excluded.style,
               color = excluded.color,
               size = excluded.size,
               shipping_at = excluded.shipping_at,
               status = excluded.status,
               created_at = excluded.created_at,
               updated_at = excluded.updated_at,
               deleted_at = excluded.deleted_at,
               deleted_by = excluded.deleted_by,
               deletion_batch_id = excluded.deletion_batch_id,
               sync_status = 'SYNCED'
             WHERE garments.sync_status = 'SYNCED'
               AND (excluded.updated_at >= garments.updated_at OR garments.updated_at IS NULL)`,
            [
              r.id,
              boxIdVal,
              r.op || '',
              styleVal,
              colorVal,
              sizeVal,
              r.shipping_at || null,
              statusVal,
              createdVal,
              r.updated_at,
              deletedAtVal,
              deletedByVal,
              batchIdVal,
            ]
          );
          result.pulledCount++;
        }

        // 3. Aplicar garment_images pre-descargadas
        const remoteImages = fetchResult.images;
        if (remoteImages && remoteImages.length > 0) {
          for (const img of remoteImages) {
            const orderIdx = img.order_index ?? 0;
            const isPrimary = img.is_primary ? 1 : (orderIdx === 0 ? 1 : 0);
            const storageVal = img.storage || 'CLOUD';

            await db.runAsync(
              `INSERT INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
               ON CONFLICT(id) DO UPDATE SET
                 garment_id = excluded.garment_id,
                 uri = CASE WHEN garment_images.storage_key IS NOT excluded.storage_key THEN NULL ELSE garment_images.uri END,
                 storage_key = excluded.storage_key,
                 storage = excluded.storage,
                 order_index = excluded.order_index,
                 is_primary = excluded.is_primary,
                 updated_at = excluded.updated_at,
                 deleted_at = excluded.deleted_at,
                 deleted_by = excluded.deleted_by,
                 deletion_batch_id = excluded.deletion_batch_id,
                 sync_status = 'SYNCED'
               WHERE excluded.updated_at >= garment_images.updated_at OR garment_images.updated_at IS NULL`,
              [
                img.id,
                img.garment_id,
                null,
                img.storage_key || null,
                storageVal,
                orderIdx,
                isPrimary,
                img.created_at || new Date().toISOString(),
                img.updated_at || img.created_at || new Date().toISOString(),
                img.deleted_at || null,
                img.deleted_by || null,
                img.deletion_batch_id || null,
              ]
            );
            result.pulledCount++;
          }
        }

        // 4. Aplicar garment_alarms pre-descargadas
        const remoteAlarms = fetchResult.alarms;
        if (remoteAlarms && remoteAlarms.length > 0) {
          for (const alm of remoteAlarms) {
            await db.runAsync(
              `INSERT INTO garment_alarms (id, garment_id, alarm_datetime, expires_at, notification_id, status, created_at, updated_at, deleted_at, deleted_by, deletion_batch_id, sync_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED')
               ON CONFLICT(id) DO UPDATE SET
                 garment_id = excluded.garment_id,
                 alarm_datetime = excluded.alarm_datetime,
                 expires_at = excluded.expires_at,
                 notification_id = excluded.notification_id,
                 status = excluded.status,
                 updated_at = excluded.updated_at,
                 deleted_at = excluded.deleted_at,
                 deleted_by = excluded.deleted_by,
                 deletion_batch_id = excluded.deletion_batch_id,
                 sync_status = 'SYNCED'
               WHERE excluded.updated_at >= garment_alarms.updated_at OR garment_alarms.updated_at IS NULL`,
              [
                alm.id,
                alm.garment_id,
                alm.alarm_datetime,
                alm.expires_at || null,
                alm.notification_id || null,
                alm.status || 'PENDING',
                alm.created_at || new Date().toISOString(),
                alm.updated_at || alm.created_at || new Date().toISOString(),
                alm.deleted_at || null,
                alm.deleted_by || null,
                alm.deletion_batch_id || null,
              ]
            );
            result.pulledCount++;
          }
        }
      });
    } catch (e: any) {
      console.error('Exception in GarmentSyncAdapter.applyRemote:', e);
      result.success = false;
      result.errors = [e.message || String(e)];
    }
    return result;
  }

  async pullRemote(db: SQLiteDatabase, userId: string, since: string | null): Promise<SyncResult> {
    const data = await this.fetchRemote(userId, since);
    if (!data.garments) return { success: false, pushedCount: 0, pulledCount: 0, errors: ['Fetch failed'] };
    return this.applyRemote(db, userId, since, data);
  }

  async cleanForUser(db: SQLiteDatabase): Promise<void> {
    try {
      await db.runAsync('DELETE FROM garment_alarms');
      await db.runAsync('DELETE FROM garment_images');
      await db.runAsync('DELETE FROM garments');
    } catch (e) {
      console.error('Error cleaning garments:', e);
    }
  }

  async adoptForUser(db: SQLiteDatabase, _userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await db.runAsync(`UPDATE garments SET sync_status = 'PENDING', updated_at = ? WHERE sync_status IS NULL OR sync_status = ''`, [now]);
    } catch (e) {
      console.error('Error adopting garments:', e);
    }
  }
}

export default GarmentSyncAdapter;
