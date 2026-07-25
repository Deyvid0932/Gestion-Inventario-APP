import { SQLiteDatabase } from 'expo-sqlite';
import { Inventario } from '../types';
import { supabase } from '../database/supabase';

export const InventarioService = {
  create: async (db: SQLiteDatabase, inventario: Inventario, userId?: string | null) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO inventarios (id, user_id, nombre, descripcion, fechaCreacion, estado, updated_at, sync_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        inventario.id,
        userId || null,
        inventario.nombre,
        inventario.descripcion || '',
        inventario.fechaCreacion || now,
        inventario.estado ?? 1,
        now,
      ]
    );
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string, descripcion?: string) => {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE inventarios SET nombre = ?, descripcion = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      [nombre, descripcion || '', now, id]
    );
  },

  hardDelete: async (db: SQLiteDatabase, id: string, userId?: string | null) => {
    try {
      let remoteDeleted = false;

      if (userId) {
        const { error } = await supabase.from('inventarios').delete().eq('id', id);
        if (!error) {
          remoteDeleted = true;
        }
      }

      await db.withTransactionAsync(async () => {
        if (userId && !remoteDeleted) {
          const deletionId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await db.runAsync(
            `INSERT INTO pending_deletions (id, tableName, recordId, createdAt) VALUES (?, 'inventarios', ?, ?)`,
            [deletionId, id, new Date().toISOString()]
          );
        }

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

  getAll: async (db: SQLiteDatabase, userId?: string | null) => {
    if (userId) {
      return await db.getAllAsync<Inventario>(
        `SELECT i.*, 
                COUNT(p.id) as totalPrendas,
                SUM(CASE WHEN p.estado = 1 THEN 1 ELSE 0 END) as prendasEscaneadas
         FROM inventarios i 
         LEFT JOIN cajas c ON c.inventarioId = i.id
         LEFT JOIN prendas p ON p.cajaId = c.id
         WHERE (i.user_id = ? OR i.user_id IS NULL OR i.user_id = '')
         GROUP BY i.id
         ORDER BY i.fechaCreacion DESC`,
        [userId]
      );
    } else {
      return await db.getAllAsync<Inventario>(
        `SELECT i.*, 
                COUNT(p.id) as totalPrendas,
                SUM(CASE WHEN p.estado = 1 THEN 1 ELSE 0 END) as prendasEscaneadas
         FROM inventarios i 
         LEFT JOIN cajas c ON c.inventarioId = i.id
         LEFT JOIN prendas p ON p.cajaId = c.id
         WHERE (i.user_id IS NULL OR i.user_id = '')
         GROUP BY i.id
         ORDER BY i.fechaCreacion DESC`
      );
    }
  },
};
