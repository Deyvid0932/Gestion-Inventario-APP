import { SQLiteDatabase } from 'expo-sqlite';
import { Inventario } from '../types';
import { supabase } from '../database/supabase';
import { generateUUID } from '../utils/uuid';
import { SyncScheduler } from '../sync/SyncScheduler';
import { R2Service } from './r2Service';

export const InventarioService = {
  create: async (db: SQLiteDatabase, inventario: Inventario, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO inventarios (id, user_id, nombre, descripcion, fechaCreacion, estado, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          inventario.id,
          userId || inventario.user_id || null,
          inventario.nombre,
          inventario.descripcion || '',
          inventario.fechaCreacion || now,
          inventario.estado ?? 1,
          now,
        ]
      );
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }
      return { success: true };
    } catch (e) {
      console.error('Error creando inventario:', e);
      return { success: false };
    }
  },

  updateInventariosOrder: async (db: SQLiteDatabase, orderings: { id: string; orden: number }[], userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      for (const item of orderings) {
        await db.runAsync(`UPDATE inventarios SET orden = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [item.orden, now, item.id]);
      }
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }
      return { success: true };
    } catch (e) {
      console.error('Error actualizando orden de inventarios:', e);
      return { success: false };
    }
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string, descripcion: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE inventarios SET nombre = ?, descripcion = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [nombre, descripcion || '', now, id]
      );
      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }
      return { success: true };
    } catch (e) {
      console.error('Error actualizando inventario:', e);
      return { success: false };
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      // Eliminar fotos en R2 en cascada para todas las prendas pertenecientes a este lote/inventario
      try {
        const prendas = await db.getAllAsync<{ r2Key?: string; r2Key2?: string }>(
          `SELECT r2Key, r2Key2 FROM prendas WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?)`,
          [id]
        );
        for (const p of prendas || []) {
          if (p.r2Key) await R2Service.deletePhotoFromR2(p.r2Key).catch(() => {});
          if (p.r2Key2) await R2Service.deletePhotoFromR2(p.r2Key2).catch(() => {});
        }
      } catch (r2Err) {
        console.warn('Advertencia al eliminar fotos de R2 en cascada para inventario:', r2Err);
      }

      if (userId) {
        // Llamar a la función RPC transaccional en Supabase
        const { error } = await supabase.rpc('hard_delete_inventory', { p_inventory_id: id });
        if (error) {
          // Si el RPC no existe aún en Supabase, realizar borrado directo con fallback
          const cajas = await db.getAllAsync<{ id: string }>('SELECT id FROM cajas WHERE inventarioId = ?', [id]);
          const cajaIds = cajas.map(c => c.id);
          if (cajaIds.length > 0) {
            await supabase.from('garments').delete().in('box_id', cajaIds);
            await supabase.from('boxes').delete().in('id', cajaIds);
          }
          const { error: invErr } = await supabase.from('inventories').delete().eq('id', id);
          if (invErr) throw new Error(`Error al eliminar inventario en Supabase: ${invErr.message}`);
        }
      }

      await db.runAsync(
        `DELETE FROM prendas WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?)`,
        [id]
      );
      await db.runAsync(`DELETE FROM cajas WHERE inventarioId = ?`, [id]);
      await db.runAsync(`DELETE FROM inventarios WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [id, id]);

      return { success: true };
    } catch (e: any) {
      console.error('Error en hardDelete de inventario:', e);
      return { success: false, error: e.message || 'Error al eliminar el inventario.' };
    }
  },

  softDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const batchId = generateUUID();

      // 1. Marcar inventario como inactivo
      await db.runAsync(
        `UPDATE inventarios SET estado = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, userId || null, batchId, now, id]
      );

      // 2. Marcar solo cajas hijas ACTIVAS (deleted_at IS NULL) para preservar batches individuales previos
      await db.runAsync(
        `UPDATE cajas SET deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE inventarioId = ? AND deleted_at IS NULL`,
        [now, userId || null, batchId, now, id]
      );

      // 3. Marcar solo prendas hijas ACTIVAS (deleted_at IS NULL)
      await db.runAsync(
        `UPDATE prendas SET estado = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?) AND deleted_at IS NULL`,
        [now, userId || null, batchId, now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error en softDelete de inventario:', e);
      return { success: false, error: e.message || 'Error al mover inventario a la papelera.' };
    }
  },

  restore: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const targetInv = await db.getFirstAsync<{ deletion_batch_id?: string | null }>('SELECT deletion_batch_id FROM inventarios WHERE id = ?', [id]);
      const batchId = targetInv?.deletion_batch_id;

      // 1. Restaurar inventario
      await db.runAsync(
        `UPDATE inventarios SET estado = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, id]
      );

      // 2. Restaurar únicamente cajas que compartan el mismo deletion_batch_id (evita restaurar cajas borradas individualmente antes)
      if (batchId) {
        await db.runAsync(
          `UPDATE cajas SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE inventarioId = ? AND deletion_batch_id = ?`,
          [now, id, batchId]
        );
        await db.runAsync(
          `UPDATE prendas SET estado = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?) AND deletion_batch_id = ?`,
          [now, id, batchId]
        );
      } else {
        await db.runAsync(
          `UPDATE cajas SET deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE inventarioId = ? AND deleted_at IS NOT NULL`,
          [now, id]
        );
        await db.runAsync(
          `UPDATE prendas SET estado = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?) AND deleted_at IS NOT NULL`,
          [now, id]
        );
      }

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error al restaurar inventario:', e);
      return { success: false, error: e.message || 'Error al restaurar inventario.' };
    }
  },

  getAll: async (db: SQLiteDatabase, _userId?: string | null) => {
    const rows = await db.getAllAsync<Inventario>(
      `SELECT i.*, 
              COUNT(p.id) as totalPrendas,
              SUM(CASE WHEN p.estado = 1 THEN 1 ELSE 0 END) as prendasEscaneadas
       FROM inventarios i 
       LEFT JOIN cajas c ON c.inventarioId = i.id
       LEFT JOIN prendas p ON p.cajaId = c.id
       WHERE (i.estado = 1 OR i.estado IS NULL) AND (i.deleted_at IS NULL)
       GROUP BY i.id
       ORDER BY CASE WHEN i.orden IS NULL THEN 999999 ELSE i.orden END ASC, i.fechaCreacion DESC`
    );

    // Corregir de forma asíncrona cualquier inventario con nombre genérico si se trajo de Supabase
    const placeholderItems = rows.filter(r => r.nombre === 'Lote Sincronizado' || r.nombre === 'Nuevo Lote');
    if (placeholderItems.length > 0) {
      (async () => {
        try {
          const { data } = await supabase
            .from('inventories')
            .select('id, name, nombre')
            .in('id', placeholderItems.map(p => p.id));

          if (data && data.length > 0) {
            for (const r of data as any[]) {
              const realName = r.name || r.nombre;
              if (realName) {
                await db.runAsync('UPDATE inventarios SET nombre = ? WHERE id = ?', [realName, r.id]);
              }
            }
          }
        } catch (_) {}
      })();
    }

    return rows;
  },
};
