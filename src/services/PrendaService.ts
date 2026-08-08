import { SQLiteDatabase } from 'expo-sqlite';
import { Prenda } from '../types';
import { supabase } from '../database/supabase';
import { R2Service } from './r2Service';
import { generateUUID } from '../utils/uuid';
import { AuthManager } from './AuthManager';
import { SyncScheduler } from '../sync/SyncScheduler';

export const PrendaService = {
  addPrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    try {
      if (prenda.op && prenda.op.trim() !== '') {
        const existing = await db.getFirstAsync<{ id: string; op: string }>(
          'SELECT id, op FROM prendas WHERE op = ? AND cajaId = ?',
          [prenda.op, prenda.cajaId]
        );

        if (existing) {
          const conflict = `OP: ${existing.op}`;
          return {
            success: false,
            error: `El registro con ${conflict} ya está agregado en esta caja.`,
            duplicateId: existing.id,
          };
        }
      }

      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO prendas (id, cajaId, op, estilo, color, talla, fotoUri, fotoUri2, r2Key, r2Key2, estado, fechaCreacion, alarmaFechaHora, alarmaNotificationId, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          prenda.id,
          prenda.cajaId,
          prenda.op || '',
          prenda.estilo,
          prenda.color,
          prenda.talla || '',
          prenda.fotoUri || null,
          prenda.fotoUri2 || null,
          prenda.r2Key || null,
          prenda.r2Key2 || null,
          prenda.estado ?? 1,
          prenda.fechaCreacion || now,
          prenda.alarmaFechaHora || null,
          prenda.alarmaNotificationId || null,
          now,
        ]
      );

      return { success: true };
    } catch (e) {
      console.error('Error al agregar prenda:', e);
      return { success: false, error: 'Error al guardar en la base de datos.' };
    }
  },

  updatePrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    try {
      if (prenda.op && prenda.op.trim() !== '') {
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM prendas WHERE op = ? AND cajaId = ? AND id != ?',
          [prenda.op, prenda.cajaId, prenda.id]
        );

        if (existing) {
          return {
            success: false,
            error: `La OP: ${prenda.op} ya existe en otra prenda de esta caja.`,
          };
        }
      }

      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE prendas SET op = ?, estilo = ?, color = ?, talla = ?, fotoUri = ?, fotoUri2 = ?, r2Key = ?, r2Key2 = ?, alarmaFechaHora = ?, alarmaNotificationId = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [
          prenda.op || '',
          prenda.estilo,
          prenda.color,
          prenda.talla || '',
          prenda.fotoUri || null,
          prenda.fotoUri2 || null,
          prenda.r2Key || null,
          prenda.r2Key2 || null,
          prenda.alarmaFechaHora || null,
          prenda.alarmaNotificationId || null,
          now,
          prenda.id,
        ]
      );
      return { success: true };
    } catch (e) {
      console.error('Error al actualizar prenda:', e);
      return { success: false, error: 'Error al actualizar la prenda.' };
    }
  },

  updatePrendaStatus: async (db: SQLiteDatabase, id: string, newStatus: number) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE prendas SET estado = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [newStatus, now, id]
      );
      return { success: true };
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return { success: false, error: 'Error al actualizar el estado en la base de datos.' };
    }
  },

  movePrenda: async (db: SQLiteDatabase, prendaId: string, newCajaId: string) => {
    try {
      const now = new Date().toISOString();
      await db.runAsync(
        `UPDATE prendas SET cajaId = ?, fechaCreacion = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [newCajaId, now, now, prendaId]
      );
      await AuthManager.refreshAllAppState(db);
      return { success: true };
    } catch (error) {
      console.error('Error al mover prenda:', error);
      return { success: false, error: 'Error al mover la prenda a la nueva caja.' };
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const prenda = await db.getFirstAsync<{ fotoUri?: string; fotoUri2?: string; r2Key?: string; r2Key2?: string }>(
        `SELECT fotoUri, fotoUri2, r2Key, r2Key2 FROM prendas WHERE id = ?`,
        [id]
      );

      if (userId) {
        const { error } = await supabase.rpc('hard_delete_garment', { p_garment_id: id });
        if (error) {
          const { error: gErr } = await supabase.from('garments').delete().eq('id', id);
          if (gErr) throw new Error(`Error al eliminar prenda en Supabase: ${gErr.message}`);
        }
      }

      if (prenda?.r2Key) {
        await R2Service.deletePhotoFromR2(prenda.r2Key).catch(() => {});
      }
      if (prenda?.r2Key2) {
        await R2Service.deletePhotoFromR2(prenda.r2Key2).catch(() => {});
      }

      await db.runAsync(`DELETE FROM prendas WHERE id = ?`, [id]);
      await db.runAsync(`DELETE FROM pending_deletions WHERE recordId = ? OR id = ?`, [id, id]);

      return { success: true };
    } catch (e: any) {
      console.error('Error en hardDelete de prenda:', e);
      return { success: false, error: e.message || 'Error al eliminar la prenda.' };
    }
  },

  softDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const now = new Date().toISOString();
      const batchId = generateUUID();

      await db.runAsync(
        `UPDATE prendas SET estado = 0, deleted_at = ?, deleted_by = ?, deletion_batch_id = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, userId || null, batchId, now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error en softDelete de prenda:', e);
      return { success: false, error: e.message || 'Error al mover la prenda a la papelera.' };
    }
  },

  restore: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      const parentCaja = await db.getFirstAsync<{ deleted_at?: string | null }>(
        `SELECT deleted_at FROM cajas WHERE id = (SELECT cajaId FROM prendas WHERE id = ?)`,
        [id]
      );
      if (parentCaja && parentCaja.deleted_at !== null && parentCaja.deleted_at !== undefined) {
        return {
          success: false,
          error: 'No se puede restaurar la prenda porque su caja está en la papelera.',
        };
      }

      const now = new Date().toISOString();

      await db.runAsync(
        `UPDATE prendas SET estado = 1, deleted_at = NULL, deleted_by = NULL, deletion_batch_id = NULL, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [now, id]
      );

      if (userId) {
        SyncScheduler.schedulePush(db, userId);
      }

      return { success: true };
    } catch (e: any) {
      console.error('Error al restaurar prenda:', e);
      return { success: false, error: e.message || 'Error al restaurar la prenda.' };
    }
  },

  getAllPrendasByCaja: async (db: SQLiteDatabase, cajaId: string, search: string = '') => {
    try {
      if (search.trim() === '') {
        return await db.getAllAsync<Prenda>(
          'SELECT * FROM prendas WHERE cajaId = ? AND deleted_at IS NULL ORDER BY fechaCreacion DESC',
          [cajaId]
        );
      }

      const startParam = `${search}%`;
      const exactParam = search;
      const searchParam = `%${search}%`;

      return await db.getAllAsync<Prenda>(
        `SELECT * FROM prendas 
         WHERE cajaId = ? AND deleted_at IS NULL AND (op LIKE ? OR estilo LIKE ? OR color LIKE ? OR talla LIKE ?) 
         ORDER BY 
          (CASE 
            WHEN op = ? OR estilo = ? OR color = ? OR talla = ? THEN 0
            WHEN op LIKE ? OR estilo LIKE ? OR color LIKE ? OR talla LIKE ? THEN 1
            ELSE 2
          END), fechaCreacion DESC`,
        [
          cajaId,
          searchParam,
          searchParam,
          searchParam,
          searchParam,
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
    } catch (error) {
      console.error('Error fetching prendas:', error);
      return [];
    }
  },

  bulkAddPrendas: async (db: SQLiteDatabase, prendas: Prenda[]) => {
    try {
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        for (const prenda of prendas) {
          await db.runAsync(
            `INSERT INTO prendas (id, cajaId, op, estilo, color, talla, fotoUri, fotoUri2, estado, fechaCreacion, updated_at, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
              prenda.id,
              prenda.cajaId,
              prenda.op || '',
              prenda.estilo,
              prenda.color,
              prenda.talla || '',
              prenda.fotoUri || null,
              prenda.fotoUri2 || null,
              prenda.estado ?? 1,
              prenda.fechaCreacion || now,
              now,
            ]
          );
        }
      });
      return { success: true };
    } catch (e) {
      console.error('Error in bulkAddPrendas:', e);
      return { success: false, error: 'Error al realizar la carga masiva.' };
    }
  },
};
