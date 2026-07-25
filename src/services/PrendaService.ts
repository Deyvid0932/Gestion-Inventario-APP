import { SQLiteDatabase } from 'expo-sqlite';
import { Prenda } from '../types';
import { supabase } from '../database/supabase';

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
        `INSERT INTO prendas (id, cajaId, op, estilo, color, fotoUri, fotoUri2, estado, fechaCreacion, alarmaFechaHora, alarmaNotificationId, updated_at, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [
          prenda.id,
          prenda.cajaId,
          prenda.op || '',
          prenda.estilo,
          prenda.color,
          prenda.fotoUri || null,
          prenda.fotoUri2 || null,
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
        `UPDATE prendas SET op = ?, estilo = ?, color = ?, fotoUri = ?, fotoUri2 = ?, alarmaFechaHora = ?, alarmaNotificationId = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [
          prenda.op || '',
          prenda.estilo,
          prenda.color,
          prenda.fotoUri || null,
          prenda.fotoUri2 || null,
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
      return { success: true };
    } catch (error) {
      console.error('Error al mover prenda:', error);
      return { success: false, error: 'Error al mover la prenda a la nueva caja.' };
    }
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      if (userId) {
        const { error } = await supabase.from('prendas').delete().eq('id', id);
        if (error) {
          console.error('Error al eliminar prenda en Supabase:', error);
          return { success: false, error: 'No se pudo eliminar en la nube. Verifica tu conexión.' };
        }
      }

      await db.runAsync(`DELETE FROM prendas WHERE id = ?`, [id]);
      return { success: true };
    } catch (e: any) {
      console.error('Error en hardDelete de prenda:', e);
      return { success: false, error: e.message || 'Error al eliminar la prenda.' };
    }
  },

  getAllPrendasByCaja: async (db: SQLiteDatabase, cajaId: string, search: string = '') => {
    try {
      if (search.trim() === '') {
        return await db.getAllAsync<Prenda>(
          'SELECT * FROM prendas WHERE cajaId = ? ORDER BY fechaCreacion DESC',
          [cajaId]
        );
      }

      const startParam = `${search}%`;
      const exactParam = search;
      const searchParam = `%${search}%`;

      return await db.getAllAsync<Prenda>(
        `SELECT * FROM prendas 
         WHERE cajaId = ? AND (op LIKE ? OR estilo LIKE ? OR color LIKE ?) 
         ORDER BY 
          (CASE 
            WHEN op = ? OR estilo = ? OR color = ? THEN 0
            WHEN op LIKE ? OR estilo LIKE ? OR color LIKE ? THEN 1
            ELSE 2
          END), fechaCreacion DESC`,
        [
          cajaId,
          searchParam,
          searchParam,
          searchParam,
          exactParam,
          exactParam,
          exactParam,
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
            `INSERT INTO prendas (id, cajaId, op, estilo, color, fotoUri, fotoUri2, estado, fechaCreacion, updated_at, sync_status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
            [
              prenda.id,
              prenda.cajaId,
              prenda.op || '',
              prenda.estilo,
              prenda.color,
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
