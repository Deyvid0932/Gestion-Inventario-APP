import { SQLiteDatabase } from 'expo-sqlite';
import { Garment, GarmentImage, GarmentAlarm } from '../../types';
import { supabase } from '../../database/supabase';
import { R2Service } from '../cloud/r2Service';
import { generateUUID } from '../../utils/uuid';
import { AuthManager } from '../auth/AuthManager';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { withSerializedTransaction } from '../../database/serializedTransaction';

export const GarmentService = {
  addGarment: async (db: SQLiteDatabase, garment: Garment) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO garments (id, box_id, op, style, color, size, shipping_at, status, created_at, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          garment.id,
          garment.box_id,
          garment.op || '',
          garment.style,
          garment.color,
          garment.size || null,
          garment.shipping_at || null,
          garment.status ?? 1,
          garment.created_at || now,
          now,
        ]
      );

      // Sincronizar hacia garment_images
      if (garment.images && garment.images.length > 0) {
        for (const img of garment.images) {
          await db.runAsync(
            `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [img.id || generateUUID(), garment.id, img.uri || null, img.storage_key || null, img.storage || 'LOCAL', img.order_index ?? 0, img.is_primary ? 1 : 0, img.created_at || now, now]
          );
        }
      } else {
        const photo1 = garment.photo_uri;
        if (photo1) {
          const img1Id = `img_${garment.id}_1`;
          const storage1 = photo1.startsWith('http') ? 'CLOUD' : 'LOCAL';
          await db.runAsync(
            `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
             VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, 'PENDING')`,
            [img1Id, garment.id, photo1, null, storage1, now, now]
          );
        }
        const photo2 = garment.photo_uri_2;
        if (photo2) {
          const img2Id = `img_${garment.id}_2`;
          const storage2 = photo2.startsWith('http') ? 'CLOUD' : 'LOCAL';
          await db.runAsync(
            `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
             VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, 'PENDING')`,
            [img2Id, garment.id, photo2, null, storage2, now, now]
          );
        }
      }

      // Sincronizar hacia garment_alarms
      const alarmDate = garment.alarm_datetime;
      const notifId = garment.alarm_notification_id;
      if (alarmDate) {
        const almId = `alm_${garment.id}`;
        const expiresAt = new Date(new Date(alarmDate).getTime() + 24 * 60 * 60 * 1000).toISOString();
        await db.runAsync(
          `INSERT OR REPLACE INTO garment_alarms (id, garment_id, alarm_datetime, expires_at, notification_id, status, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, 'PENDING')`,
          [almId, garment.id, alarmDate, expiresAt, notifId || null, now, now]
        );
      }

      return { success: true };
    } catch (e) {
      console.error('Error adding garment:', e);
      return { success: false, error: 'Error al guardar en la base de datos.' };
    }
  },

  updateGarment: async (db: SQLiteDatabase, garment: Garment) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE garments SET op = ?, style = ?, color = ?, size = ?, shipping_at = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [
          garment.op || '',
          garment.style,
          garment.color,
          garment.size || null,
          garment.shipping_at || null,
          now,
          garment.id,
        ]
      );

      const photo1 = garment.photo_uri;
      if (photo1) {
        const img1Id = `img_${garment.id}_1`;
        const storage1 = photo1.startsWith('http') ? 'CLOUD' : 'LOCAL';
        await db.runAsync(
          `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, 'PENDING')`,
          [img1Id, garment.id, photo1, null, storage1, now, now]
        );
      } else {
        await db.runAsync(
          `UPDATE garment_images SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING'
           WHERE garment_id = ? AND order_index = 0 AND deleted_at IS NULL`,
          [now, now, garment.id]
        );
      }

      const photo2 = garment.photo_uri_2;
      if (photo2) {
        const img2Id = `img_${garment.id}_2`;
        const storage2 = photo2.startsWith('http') ? 'CLOUD' : 'LOCAL';
        await db.runAsync(
          `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, 'PENDING')`,
          [img2Id, garment.id, photo2, null, storage2, now, now]
        );
      } else {
        await db.runAsync(
          `UPDATE garment_images SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING'
           WHERE garment_id = ? AND order_index = 1 AND deleted_at IS NULL`,
          [now, now, garment.id]
        );
      }

      const alarmDate = garment.alarm_datetime;
      const notifId = garment.alarm_notification_id;
      if (alarmDate) {
        const almId = `alm_${garment.id}`;
        const expiresAt = new Date(new Date(alarmDate).getTime() + 24 * 60 * 60 * 1000).toISOString();
        await db.runAsync(
          `INSERT OR REPLACE INTO garment_alarms (id, garment_id, alarm_datetime, expires_at, notification_id, status, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, 'PENDING')`,
          [almId, garment.id, alarmDate, expiresAt, notifId || null, now, now]
        );
      } else {
        await db.runAsync(
          `UPDATE garment_alarms SET deleted_at = ?, updated_at = ?, sync_status = 'PENDING'
           WHERE garment_id = ? AND deleted_at IS NULL`,
          [now, now, garment.id]
        );
      }

      return { success: true };
    } catch (e) {
      console.error('Error updating garment:', e);
      return { success: false, error: 'Error al actualizar la prenda.' };
    }
  },

  updateGarmentStatus: async (db: SQLiteDatabase, id: string, newStatus: number) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE garments SET status = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [newStatus, now, id]
      );
      return { success: true };
    } catch (error) {
      console.error('Error updating garment status:', error);
      return { success: false, error: 'Error al actualizar el estado en la base de datos.' };
    }
  },

  moveGarment: async (db: SQLiteDatabase, garmentId: string, newBoxId: string) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE garments SET box_id = ?, created_at = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [newBoxId, now, now, garmentId]
      );
      await AuthManager.refreshAllAppState(db);
      return { success: true };
    } catch (error) {
      console.error('Error moving garment:', error);
      return { success: false, error: 'Error al mover la prenda a la nueva caja.' };
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const images = await db.getAllAsync<{ storage_key?: string }>(
        `SELECT storage_key FROM garment_images WHERE garment_id = ?`,
        [id]
      );

      if (userId) {
        const { error } = await supabase.rpc('hard_delete_garment', { p_garment_id: id });
        if (error) {
          const { error: gErr } = await supabase.from('garments').delete().eq('id', id);
          if (gErr) throw new Error(`Error deleting garment from Supabase: ${gErr.message}`);
        }
      }

      for (const img of images || []) {
        if (img.storage_key) {
          await R2Service.deletePhotoFromR2(img.storage_key).catch(() => {});
        }
      }

      await db.runAsync(`DELETE FROM garments WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [id, id]);

      return { success: true };
    } catch (e: any) {
      console.error('Error in hardDelete garment:', e);
      return { success: false, error: e.message || 'Error al eliminar la prenda.' };
    }
  },

  softDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const batchId = generateUUID();

      await db.runAsync(
        `UPDATE garments SET status = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, userId || null, batchId, now, id]
      );
      await db.runAsync(
        `UPDATE garment_images SET deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE garment_id = ?`,
        [now, userId || null, batchId, now, id]
      );
      await db.runAsync(
        `UPDATE garment_alarms SET deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE garment_id = ?`,
        [now, userId || null, batchId, now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error in softDelete garment:', e);
      return { success: false, error: e.message || 'Error al mover la prenda a la papelera.' };
    }
  },

  restore: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const parentBox = await db.getFirstAsync<{ deleted_at?: string | null }>(
        `SELECT deleted_at FROM boxes WHERE id = (SELECT box_id FROM garments WHERE id = ?)`,
        [id]
      );
      if (parentBox && parentBox.deleted_at !== null && parentBox.deleted_at !== undefined) {
        return {
          success: false,
          error: 'No se puede restaurar la prenda porque su caja está en la papelera.',
        };
      }

      const now = new Date().toISOString();

      await db.runAsync(
        `UPDATE garments SET status = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, id]
      );
      await db.runAsync(
        `UPDATE garment_images SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE garment_id = ?`,
        [now, id]
      );
      await db.runAsync(
        `UPDATE garment_alarms SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE garment_id = ?`,
        [now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error restoring garment:', e);
      return { success: false, error: e.message || 'Error al restaurar la prenda.' };
    }
  },

  getAllGarmentsByBox: async (db: SQLiteDatabase, boxId: string, search: string = '') => {
    try {
      let rows: any[] = [];
      if (search.trim() === '') {
        rows = await db.getAllAsync<any>(
          `SELECT 
            g.*,
            (SELECT uri FROM garment_images WHERE garment_id = g.id AND order_index = 0 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as primary_uri,
            (SELECT storage_key FROM garment_images WHERE garment_id = g.id AND order_index = 0 AND deleted_at IS NULL AND storage_key IS NOT NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as primary_storage_key,
            (SELECT uri FROM garment_images WHERE garment_id = g.id AND order_index = 1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as secondary_uri,
            (SELECT storage_key FROM garment_images WHERE garment_id = g.id AND order_index = 1 AND deleted_at IS NULL AND storage_key IS NOT NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as secondary_storage_key,
            (SELECT alarm_datetime FROM garment_alarms WHERE garment_id = g.id AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as ga_alarm_datetime,
            (SELECT notification_id FROM garment_alarms WHERE garment_id = g.id AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as ga_notification_id
           FROM garments g
           WHERE g.box_id = ? AND g.deleted_at IS NULL 
           ORDER BY g.created_at DESC`,
          [boxId]
        );
      } else {
        const cleanSearch = search.trim();
        const startParam = `${cleanSearch}%`;
        const exactParam = cleanSearch;
        const searchParam = `%${cleanSearch}%`;
        const compactParam = `%${cleanSearch.replace(/[\s._-]+/g, '').toUpperCase()}%`;

        rows = await db.getAllAsync<any>(
          `SELECT 
            g.*,
            (SELECT uri FROM garment_images WHERE garment_id = g.id AND order_index = 0 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as primary_uri,
            (SELECT storage_key FROM garment_images WHERE garment_id = g.id AND order_index = 0 AND deleted_at IS NULL AND storage_key IS NOT NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as primary_storage_key,
            (SELECT uri FROM garment_images WHERE garment_id = g.id AND order_index = 1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as secondary_uri,
            (SELECT storage_key FROM garment_images WHERE garment_id = g.id AND order_index = 1 AND deleted_at IS NULL AND storage_key IS NOT NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as secondary_storage_key,
            (SELECT alarm_datetime FROM garment_alarms WHERE garment_id = g.id AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as ga_alarm_datetime,
            (SELECT notification_id FROM garment_alarms WHERE garment_id = g.id AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC LIMIT 1) as ga_notification_id
           FROM garments g
           WHERE g.box_id = ? AND g.deleted_at IS NULL AND (
             g.op LIKE ? OR g.style LIKE ? OR g.color LIKE ? OR g.size LIKE ? OR
             REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(g.op, '')), ' ', ''), '-', ''), '.', ''), '_', '') LIKE ? OR
             REPLACE(REPLACE(REPLACE(REPLACE(UPPER(COALESCE(g.style, '')), ' ', ''), '-', ''), '.', ''), '_', '') LIKE ?
           )
           ORDER BY 
            (CASE 
              WHEN g.op = ? OR g.style = ? OR g.color = ? OR g.size = ? THEN 0
              WHEN g.op LIKE ? OR g.style LIKE ? OR g.color LIKE ? OR g.size LIKE ? THEN 1
              ELSE 2
            END), g.created_at DESC`,
          [
            boxId,
            searchParam,
            searchParam,
            searchParam,
            searchParam,
            compactParam,
            compactParam,
            exactParam,
            exactParam,
            exactParam,
            exactParam,
            startParam,
            startParam,
            startParam,
            startParam,
          ]
        );
      }

      return rows.map(r => ({
        ...r,
        photo_uri: r.primary_uri || r.primary_storage_key || r.photo_uri || null,
        photo_uri_2: r.secondary_uri || r.secondary_storage_key || r.photo_uri_2 || null,
        primary_uri: r.primary_uri || null,
        primary_storage_key: r.primary_storage_key || null,
        secondary_uri: r.secondary_uri || null,
        secondary_storage_key: r.secondary_storage_key || null,
        r2Key: r.primary_storage_key || null,
        r2Key2: r.secondary_storage_key || null,
        fotoUri: r.primary_uri || r.primary_storage_key || null,
        fotoUri2: r.secondary_uri || r.secondary_storage_key || null,
        alarm_datetime: r.ga_alarm_datetime || r.alarm_datetime || null,
        alarm_notification_id: r.ga_notification_id || r.alarm_notification_id || null,
        alarmaFechaHora: r.ga_alarm_datetime || r.alarm_datetime || null,
      }));
    } catch (error) {
      console.error('Error fetching garments:', error);
      return [];
    }
  },

  getGarmentImages: async (db: SQLiteDatabase, garmentId: string) => {
    try {
      return await db.getAllAsync<GarmentImage>(
        `SELECT * FROM garment_images WHERE garment_id = ? AND deleted_at IS NULL ORDER BY order_index ASC`,
        [garmentId]
      );
    } catch (e) {
      console.error('Error getting garment images:', e);
      return [];
    }
  },

  getGarmentAlarms: async (db: SQLiteDatabase, garmentId: string) => {
    try {
      return await db.getAllAsync<GarmentAlarm>(
        `SELECT * FROM garment_alarms WHERE garment_id = ? AND deleted_at IS NULL ORDER BY alarm_datetime ASC`,
        [garmentId]
      );
    } catch (e) {
      console.error('Error getting garment alarms:', e);
      return [];
    }
  },

  bulkAddGarments: async (db: SQLiteDatabase, garments: Garment[]) => {
    try {
      const now = new Date().toISOString();
      await withSerializedTransaction(db, async () => {
        for (const garment of garments) {
          await db.runAsync(
            `INSERT INTO garments (id, box_id, op, style, color, size, status, created_at, updated_at, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
              garment.id,
              garment.box_id,
              garment.op || '',
              garment.style,
              garment.color,
              garment.size || null,
              garment.status ?? 1,
              garment.created_at || now,
              now,
            ]
          );

          const photo1 = garment.photo_uri;
          if (photo1) {
            const img1Id = `img_${garment.id}_1`;
            const storage1 = photo1.startsWith('http') ? 'CLOUD' : 'LOCAL';
            await db.runAsync(
              `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, 'PENDING')`,
              [img1Id, garment.id, photo1, null, storage1, now, now]
            );
          }
          const photo2 = garment.photo_uri_2;
          if (photo2) {
            const img2Id = `img_${garment.id}_2`;
            const storage2 = photo2.startsWith('http') ? 'CLOUD' : 'LOCAL';
            await db.runAsync(
              `INSERT OR REPLACE INTO garment_images (id, garment_id, uri, storage_key, storage, order_index, is_primary, created_at, updated_at, sync_status)
               VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, 'PENDING')`,
              [img2Id, garment.id, photo2, null, storage2, now, now]
            );
          }
        }
      });
      return { success: true };
    } catch (e) {
      console.error('Error in bulkAddGarments:', e);
      return { success: false, error: 'Error al realizar la carga masiva.' };
    }
  },
};

export default GarmentService;
