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
        try {
          const { error } = await supabase.from('inventories').delete().eq('id', id);
          if (!error) {
            remoteDeleted = true;
          }
        } catch (netErr) {
          console.warn('Fallo eliminación remota de inventario:', netErr);
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

  getAll: async (db: SQLiteDatabase, _userId?: string | null) => {
    const rows = await db.getAllAsync<Inventario>(
      `SELECT i.*, 
              COUNT(p.id) as totalPrendas,
              SUM(CASE WHEN p.estado = 1 THEN 1 ELSE 0 END) as prendasEscaneadas
       FROM inventarios i 
       LEFT JOIN cajas c ON c.inventarioId = i.id
       LEFT JOIN prendas p ON p.cajaId = c.id
       GROUP BY i.id
       ORDER BY i.fechaCreacion DESC`
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
