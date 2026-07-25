import { SQLiteDatabase } from 'expo-sqlite';
import { Inventario } from '../types';
import { supabase } from '../database/supabase';

export const InventarioService = {
  create: async (db: SQLiteDatabase, inventario: Inventario) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO inventarios (id, user_id, nombre, descripcion, fechaCreacion, estado, updated_at, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        inventario.id,
        inventario.user_id || null,
        inventario.nombre,
        inventario.descripcion || '',
        inventario.fechaCreacion || now,
        inventario.estado,
        now,
      ]
    );
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string, descripcion: string) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE inventarios SET nombre = ?, descripcion = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      [nombre, descripcion, now, id]
    );
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      if (userId) {
        const { error } = await supabase.from('inventarios').delete().eq('id', id);
        if (error) {
          console.error('Error al eliminar inventario en Supabase:', error);
          return { success: false, error: 'No se pudo eliminar en la nube. Verifica tu conexión.' };
        }
      }

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          `DELETE FROM prendas WHERE cajaId IN (SELECT id FROM cajas WHERE inventarioId = ?)`,
          [id]
        );
        await db.runAsync(`DELETE FROM cajas WHERE inventarioId = ?`, [id]);
        await db.runAsync(`DELETE FROM inventarios WHERE id = ?`, [id]);
      });

      return { success: true };
    } catch (e: any) {
      console.error('Error en hardDelete de inventario:', e);
      return { success: false, error: e.message || 'Error al eliminar el inventario.' };
    }
  },

  getAll: async (db: SQLiteDatabase) => {
    return await db.getAllAsync<Inventario>(
      `SELECT * FROM inventarios ORDER BY fechaCreacion DESC`
    );
  },
};
