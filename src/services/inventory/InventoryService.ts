import { SQLiteDatabase } from 'expo-sqlite';
import { Inventory } from '../../types';
import { supabase } from '../../database/supabase';
import { generateUUID } from '../../utils/uuid';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { R2Service } from '../cloud/r2Service';
import { withSerializedTransaction } from '../../database/serializedTransaction';

export const InventoryService = {
  create: async (db: SQLiteDatabase, inventory: Inventory, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      let orderIndex = inventory.order_index;
      if (orderIndex === undefined || orderIndex === null) {
        const minOrderRow = await db.getFirstAsync<{ min_order: number | null }>(
          'SELECT MIN(order_index) as min_order FROM inventories WHERE deleted_at IS NULL'
        );
        orderIndex = (minOrderRow?.min_order ?? 1) - 1;
      }

      await db.runAsync(
        `INSERT INTO inventories (id, user_id, name, description, created_at, order_index, status, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          inventory.id,
          userId || inventory.user_id || null,
          inventory.name,
          inventory.description || '',
          inventory.created_at || now,
          orderIndex,
          inventory.status ?? 1,
          now,
        ]
      );
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }
      return { success: true };
    } catch (e) {
      console.error('Error creating inventory:', e);
      return { success: false };
    }
  },

  updateInventoriesOrder: async (db: SQLiteDatabase, orderings: { id: string; order_index?: number; orden?: number }[], userId?: string | null) => {
    try {
      if (!orderings || orderings.length === 0) return { success: true };
      const now = new Date().toISOString();

      const updates = orderings.map(item => ({
        id: item.id,
        order_index: item.order_index !== undefined ? item.order_index : (item.orden ?? 0),
        updated_at: now,
      }));

      // Compartir la cola de transacciones con el sincronizador.
      await withSerializedTransaction(db, async () => {
        for (const item of updates) {
          await db.runAsync(
            `UPDATE inventories SET order_index = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
            [item.order_index, item.updated_at, item.id]
          );
        }
      });

      // El sincronizador sube los cambios pendientes en segundo plano.
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e) {
      console.error('Error updating inventories order:', e);
      return { success: false, error: 'Error updating inventories order.' };
    }
  },

  update: async (db: SQLiteDatabase, id: string, name: string, description: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE inventories SET name = ?, description = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [name, description || '', now, id]
      );
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }
      return { success: true };
    } catch (e) {
      console.error('Error updating inventory:', e);
      return { success: false };
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      // Cascaded deletion of R2 images
      try {
        const images = await db.getAllAsync<{ storage_key?: string }>(
          `SELECT storage_key FROM garment_images WHERE garment_id IN (
             SELECT g.id FROM garments g JOIN boxes b ON g.box_id = b.id WHERE b.inventory_id = ?
           )`,
          [id]
        );
        for (const img of images || []) {
          if (img.storage_key) await R2Service.deletePhotoFromR2(img.storage_key).catch(() => {});
        }
      } catch (r2Err) {
        console.warn('Warning deleting cascaded R2 images for inventory:', r2Err);
      }

      if (userId) {
        const { error } = await supabase.rpc('hard_delete_inventory', { p_inventory_id: id });
        if (error) {
          const boxes = await db.getAllAsync<{ id: string }>('SELECT id FROM boxes WHERE inventory_id = ?', [id]);
          const boxIds = boxes.map(b => b.id);
          if (boxIds.length > 0) {
            await supabase.from('garments').delete().in('box_id', boxIds);
            await supabase.from('boxes').delete().in('id', boxIds);
          }
          const { error: invErr } = await supabase.from('inventories').delete().eq('id', id);
          if (invErr) throw new Error(`Error deleting inventory from Supabase: ${invErr.message}`);
        }
      }

      await db.runAsync(
        `DELETE FROM garments WHERE box_id IN (SELECT id FROM boxes WHERE inventory_id = ?)`,
        [id]
      );
      await db.runAsync(`DELETE FROM boxes WHERE inventory_id = ?`, [id]);
      await db.runAsync(`DELETE FROM inventories WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [id, id]);

      return { success: true };
    } catch (e: any) {
      console.error('Error in hardDelete inventory:', e);
      return { success: false, error: e.message || 'Error deleting inventory.' };
    }
  },

  softDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const batchId = generateUUID();

      await withSerializedTransaction(db, async () => {
        await db.runAsync(
          `UPDATE inventories SET status = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
          [now, userId || null, batchId, now, id]
        );

        await db.runAsync(
          `UPDATE boxes SET deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE inventory_id = ? AND deleted_at IS NULL`,
          [now, userId || null, batchId, now, id]
        );

        await db.runAsync(
          `UPDATE garments SET status = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE box_id IN (SELECT id FROM boxes WHERE inventory_id = ?) AND deleted_at IS NULL`,
          [now, userId || null, batchId, now, id]
        );
      });

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error in softDelete inventory:', e);
      return { success: false, error: e.message || 'Error moving inventory to trash.' };
    }
  },

  restore: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const targetInv = await db.getFirstAsync<{ deletion_batch_id?: string | null }>('SELECT deletion_batch_id FROM inventories WHERE id = ?', [id]);
      const batchId = targetInv?.deletion_batch_id;

      await db.runAsync(
        `UPDATE inventories SET status = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, id]
      );

      if (batchId) {
        await db.runAsync(
          `UPDATE boxes SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE inventory_id = ? AND deletion_batch_id = ?`,
          [now, id, batchId]
        );
        await db.runAsync(
          `UPDATE garments SET status = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE box_id IN (SELECT id FROM boxes WHERE inventory_id = ?) AND deletion_batch_id = ?`,
          [now, id, batchId]
        );
      } else {
        await db.runAsync(
          `UPDATE boxes SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE inventory_id = ? AND deleted_at IS NOT NULL`,
          [now, id]
        );
        await db.runAsync(
          `UPDATE garments SET status = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE box_id IN (SELECT id FROM boxes WHERE inventory_id = ?) AND deleted_at IS NOT NULL`,
          [now, id]
        );
      }

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error restoring inventory:', e);
      return { success: false, error: e.message || 'Error restoring inventory.' };
    }
  },

  getAll: async (db: SQLiteDatabase, _userId?: string | null) => {
    const rows = await db.getAllAsync<Inventory & { totalGarments: number; scannedGarments: number }>(
      `SELECT i.*, 
              COUNT(g.id) as totalGarments,
              SUM(CASE WHEN g.status = 1 THEN 1 ELSE 0 END) as scannedGarments
       FROM inventories i 
       LEFT JOIN boxes b ON b.inventory_id = i.id
       LEFT JOIN garments g ON g.box_id = b.id
       WHERE (i.status = 1 OR i.status IS NULL) AND (i.deleted_at IS NULL)
       GROUP BY i.id
       ORDER BY i.created_at DESC`
    );

    return rows;
  },
};

export default InventoryService;
