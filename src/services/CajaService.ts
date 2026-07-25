import { SQLiteDatabase } from 'expo-sqlite';
import { Caja } from '../types';
import { supabase } from '../database/supabase';

export const CajaService = {
  create: async (db: SQLiteDatabase, caja: Caja) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion, orden, updated_at, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`,
      [caja.id, caja.inventarioId, caja.nombre, caja.fechaCreacion || now, caja.orden || 0, now]
    );
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE cajas SET nombre = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      [nombre, now, id]
    );
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      if (userId) {
        const { error } = await supabase.from('cajas').delete().eq('id', id);
        if (error) {
          console.error('Error al eliminar caja en Supabase:', error);
          return { success: false, error: 'No se pudo eliminar en la nube. Verifica tu conexión.' };
        }
      }

      await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM prendas WHERE cajaId = ?`, [id]);
        await db.runAsync(`DELETE FROM cajas WHERE id = ?`, [id]);
      });

      return { success: true };
    } catch (e: any) {
      console.error('Error en hardDelete de caja:', e);
      return { success: false, error: e.message || 'Error al eliminar la caja.' };
    }
  },

  getAllByInventario: async (db: SQLiteDatabase, inventarioId: string) => {
    return await db.getAllAsync<Caja>(
      `SELECT * FROM cajas WHERE inventarioId = ? ORDER BY orden ASC, fechaCreacion DESC`,
      [inventarioId]
    );
  },

  getSiblingCajas: async (db: SQLiteDatabase, currentCajaId: string) => {
    return await db.getAllAsync<Caja>(
      `SELECT * FROM cajas 
       WHERE inventarioId = (SELECT inventarioId FROM cajas WHERE id = ?) 
       AND id != ? 
       ORDER BY orden ASC, fechaCreacion DESC`,
      [currentCajaId, currentCajaId]
    );
  },

  updateCajasOrder: async (db: SQLiteDatabase, orderings: { id: string; orden: number }[]) => {
    try {
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        for (const item of orderings) {
          await db.runAsync(
            `UPDATE cajas SET orden = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
            [item.orden, now, item.id]
          );
        }
      });
      return { success: true };
    } catch (e) {
      console.error('Error al reordenar cajas:', e);
      return { success: false, error: 'Error al actualizar el orden de las cajas.' };
    }
  },
};
