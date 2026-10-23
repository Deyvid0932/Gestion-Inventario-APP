import { SQLiteDatabase } from 'expo-sqlite';
import { Box } from '../../types';
import { supabase } from '../../database/supabase';
import { generateUUID } from '../../utils/uuid';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { R2Service } from '../cloud/r2Service';
import { withSerializedTransaction } from '../../database/serializedTransaction';

export const BoxService = {
  create: async (db: SQLiteDatabase, box: Box, userId?: string | null) => {
    const now = new Date().toISOString();
    let orderIndex = box.order_index;
    if (orderIndex === undefined || orderIndex === null) {
      const minOrderRow = await db.getFirstAsync<{ min_order: number | null }>(
        'SELECT MIN(order_index) as min_order FROM boxes WHERE inventory_id = ? AND deleted_at IS NULL',
        [box.inventory_id]
      );
      orderIndex = (minOrderRow?.min_order ?? 1) - 1;
    }

    await db.runAsync(
      `INSERT INTO boxes (id, inventory_id, name, created_at, order_index, updated_at, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [box.id, box.inventory_id, box.name, box.created_at || now, orderIndex, now]
    );
    if (userId) {
      SyncScheduler.schedulePush(db, userId);
    }
  },

  update: async (db: SQLiteDatabase, id: string, name: string, userId?: string | null) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE boxes SET name = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      [name, now, id]
    );
    if (userId) {
      SyncScheduler.schedulePush(db, userId);
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      try {
        const images = await db.getAllAsync<{ storage_key?: string }>(
          `SELECT storage_key FROM garment_images WHERE garment_id IN (
             SELECT id FROM garments WHERE box_id = ?
           )`,
          [id]
        );
        for (const img of images || []) {
          if (img.storage_key) await R2Service.deletePhotoFromR2(img.storage_key).catch(() => {});
        }
      } catch (r2Err) {
        console.warn('Warning deleting cascaded R2 images for box:', r2Err);
      }

      if (userId) {
        const { error } = await supabase.rpc('hard_delete_box', { p_box_id: id });
        if (error) {
          try { await supabase.from('garments').delete().eq('box_id', id); } catch (_) {}
          const { error: bErr } = await supabase.from('boxes').delete().eq('id', id);
          if (bErr) throw new Error(`Error deleting box from Supabase: ${bErr.message}`);
        }
      }

      await db.runAsync(`DELETE FROM garments WHERE box_id = ?`, [id]);
      await db.runAsync(`DELETE FROM boxes WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [id, id]);

      return { success: true };
    } catch (e: any) {
      console.error('Error in hardDelete box:', e);
      return { success: false, error: e.message || 'Error deleting box.' };
    }
  },

  softDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const batchId = generateUUID();

      await db.runAsync(
        `UPDATE boxes SET deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, userId || null, batchId, now, id]
      );
      await db.runAsync(
        `UPDATE garments SET status = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE box_id = ? AND deleted_at IS NULL`,
        [now, userId || null, batchId, now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error in softDelete box:', e);
      return { success: false, error: e.message || 'Error moving box to trash.' };
    }
  },

  restore: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const parentInv = await db.getFirstAsync<{ deleted_at?: string | null }>(
        `SELECT deleted_at FROM inventories WHERE id = (SELECT inventory_id FROM boxes WHERE id = ?)`,
        [id]
      );
      if (parentInv && parentInv.deleted_at !== null && parentInv.deleted_at !== undefined) {
        return {
          success: false,
          error: 'No se puede restaurar la caja porque su lote está en la papelera.',
        };
      }

      const now = new Date().toISOString();
      const targetBox = await db.getFirstAsync<{ deletion_batch_id?: string | null }>(
        'SELECT deletion_batch_id FROM boxes WHERE id = ?',
        [id]
      );
      const batchId = targetBox?.deletion_batch_id;

      await db.runAsync(
        `UPDATE boxes SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, id]
      );

      if (batchId) {
        await db.runAsync(
          `UPDATE garments SET status = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE box_id = ? AND deletion_batch_id = ?`,
          [now, id, batchId]
        );
      } else {
        await db.runAsync(
          `UPDATE garments SET status = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE box_id = ? AND deleted_at IS NOT NULL`,
          [now, id]
        );
      }

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error restoring box:', e);
      return { success: false, error: e.message || 'Error restoring box.' };
    }
  },

  getAllByInventory: async (db: SQLiteDatabase, inventoryId: string) => {
    return await db.getAllAsync<Box>(
      `SELECT * FROM boxes WHERE inventory_id = ? AND deleted_at IS NULL ORDER BY COALESCE(order_index, 0) ASC, created_at DESC`,
      [inventoryId]
    );
  },

  getSiblingBoxes: async (db: SQLiteDatabase, currentBoxId: string) => {
    return await db.getAllAsync<Box>(
      `SELECT * FROM boxes 
       WHERE inventory_id = (SELECT inventory_id FROM boxes WHERE id = ?) 
       AND id != ? 
       AND deleted_at IS NULL
       ORDER BY COALESCE(order_index, 0) ASC, created_at DESC`,
      [currentBoxId, currentBoxId]
    );
  },

  updateBoxesOrder: async (db: SQLiteDatabase, orderings: { id: string; order_index?: number; orden?: number }[], userId?: string | null) => {
    try {
      if (!orderings || orderings.length === 0) return { success: true };
      const now = new Date().toISOString();

      const updates = orderings.map(item => ({
        id: item.id,
        order_index: item.order_index !== undefined ? item.order_index : (item.orden ?? 0),
        updated_at: now,
      }));

      // 1. Guardar atómicamente en SQLite primero (Offline-First)
      await withSerializedTransaction(db, async () => {
        for (const item of updates) {
          await db.runAsync(
            `UPDATE boxes SET order_index = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
            [item.order_index, item.updated_at, item.id]
          );
        }
      });

      // 2. Programar push en segundo plano para garantizar sincronización eventual
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      // 3. Intentar actualización directa e inmediata en Supabase
      if (userId) {
        try {
          const responses = await Promise.all(
            updates.map(item =>
              supabase
                .from('boxes')
                .update({ order_index: item.order_index, updated_at: item.updated_at })
                .eq('id', item.id)
            )
          );

          const hasError = responses.some(res => res.error);
          if (!hasError) {
            await withSerializedTransaction(db, async () => {
              for (const item of updates) {
                await db.runAsync(
                  `UPDATE boxes SET sync_status = 'SYNCED' WHERE id = ? AND updated_at = ?`,
                  [item.id, item.updated_at]
                );
              }
            });
          } else {
            console.warn('Direct box order update in Supabase notice (queued for sync):', responses.map(r => r.error).filter(Boolean));
          }
        } catch (cloudErr) {
          console.warn('Network offline or error during direct Supabase box order update, SyncScheduler will retry:', cloudErr);
        }
      }

      return { success: true };
    } catch (e) {
      console.error('Error reordering boxes:', e);
      return { success: false, error: 'Error updating boxes order.' };
    }
  },
};

export default BoxService;
