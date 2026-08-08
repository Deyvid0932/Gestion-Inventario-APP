import { SQLiteDatabase } from 'expo-sqlite';
import { Caja } from '../types';
import { supabase } from '../database/supabase';
import { generateUUID } from '../utils/uuid';
import { SyncScheduler } from '../sync/SyncScheduler';
import { R2Service } from './r2Service';

export const CajaService = {
  create: async (db: SQLiteDatabase, caja: Caja, userId?: string | null) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion, orden, updated_at, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [caja.id, caja.inventarioId, caja.nombre, caja.fechaCreacion || now, caja.orden || 0, now]
    );
    if (userId) {
      SyncScheduler.schedulePush(db, userId);
    }
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string, userId?: string | null) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE cajas SET nombre = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      [nombre, now, id]
    );
    if (userId) {
      SyncScheduler.schedulePush(db, userId);
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      // Eliminar fotos en R2 en cascada para todas las prendas de esta caja
      try {
        const prendas = await db.getAllAsync<{ r2Key?: string; r2Key2?: string }>(
          `SELECT r2Key, r2Key2 FROM prendas WHERE cajaId = ?`,
          [id]
        );
        for (const p of prendas || []) {
          if (p.r2Key) await R2Service.deletePhotoFromR2(p.r2Key).catch(() => {});
          if (p.r2Key2) await R2Service.deletePhotoFromR2(p.r2Key2).catch(() => {});
        }
      } catch (r2Err) {
        console.warn('Advertencia al eliminar fotos de R2 en cascada:', r2Err);
      }

      if (userId) {
        const { error } = await supabase.rpc('hard_delete_box', { p_box_id: id });
        if (error) {
          try { await supabase.from('garments').delete().eq('box_id', id); } catch (_) {}
          const { error: bErr } = await supabase.from('boxes').delete().eq('id', id);
          if (bErr) throw new Error(`Error al eliminar caja en Supabase: ${bErr.message}`);
        }
      }

      await db.runAsync(`DELETE FROM prendas WHERE cajaId = ?`, [id]);
      await db.runAsync(`DELETE FROM cajas WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [id, id]);

      return { success: true };
    } catch (e: any) {
      console.error('Error en hardDelete de caja:', e);
      return { success: false, error: e.message || 'Error al eliminar la caja.' };
    }
  },

  softDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const batchId = generateUUID();

      await db.runAsync(
        `UPDATE cajas SET deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, userId || null, batchId, now, id]
      );
      await db.runAsync(
        `UPDATE prendas SET estado = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE cajaId = ? AND deleted_at IS NULL`,
        [now, userId || null, batchId, now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error en softDelete de caja:', e);
      return { success: false, error: e.message || 'Error al mover caja a la papelera.' };
    }
  },

  restore: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const parentInv = await db.getFirstAsync<{ deleted_at?: string | null }>(
        `SELECT deleted_at FROM inventarios WHERE id = (SELECT inventarioId FROM cajas WHERE id = ?)`,
        [id]
      );
      if (parentInv && parentInv.deleted_at !== null && parentInv.deleted_at !== undefined) {
        return {
          success: false,
          error: 'No se puede restaurar la caja porque su lote está en la papelera.',
        };
      }

      const now = new Date().toISOString();
      const targetCaja = await db.getFirstAsync<{ deletion_batch_id?: string | null }>(
        'SELECT deletion_batch_id FROM cajas WHERE id = ?',
        [id]
      );
      const batchId = targetCaja?.deletion_batch_id;

      await db.runAsync(
        `UPDATE cajas SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, id]
      );

      if (batchId) {
        await db.runAsync(
          `UPDATE prendas SET estado = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE cajaId = ? AND deletion_batch_id = ?`,
          [now, id, batchId]
        );
      } else {
        await db.runAsync(
          `UPDATE prendas SET estado = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE cajaId = ? AND deleted_at IS NOT NULL`,
          [now, id]
        );
      }

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error al restaurar caja:', e);
      return { success: false, error: e.message || 'Error al restaurar la caja.' };
    }
  },

  getAllByInventario: async (db: SQLiteDatabase, inventarioId: string) => {
    return await db.getAllAsync<Caja>(
      `SELECT * FROM cajas WHERE inventarioId = ? AND deleted_at IS NULL ORDER BY orden ASC, fechaCreacion DESC`,
      [inventarioId]
    );
  },

  getSiblingCajas: async (db: SQLiteDatabase, currentCajaId: string) => {
    return await db.getAllAsync<Caja>(
      `SELECT * FROM cajas 
       WHERE inventarioId = (SELECT inventarioId FROM cajas WHERE id = ?) 
       AND id != ? 
       AND deleted_at IS NULL
       ORDER BY orden ASC, fechaCreacion DESC`,
      [currentCajaId, currentCajaId]
    );
  },

  updateCajasOrder: async (db: SQLiteDatabase, orderings: { id: string; orden: number }[], userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      for (const item of orderings) {
        await db.runAsync(
          `UPDATE cajas SET orden = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
          [item.orden, now, item.id]
        );
      }
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }
      return { success: true };
    } catch (e) {
      console.error('Error al reordenar cajas:', e);
      return { success: false, error: 'Error al actualizar el orden de las cajas.' };
    }
  },
};
