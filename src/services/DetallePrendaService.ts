import { SQLiteDatabase } from 'expo-sqlite';
import { DetallePrenda } from '../types';

export const DetallePrendaService = {
  addDetallePrenda: async (db: SQLiteDatabase, detalle: DetallePrenda) => {
    try {
      const existing = await db.getFirstAsync<{ id: string; op: string; estilo: string }>(
        'SELECT id, op, estilo FROM detalles_prendas WHERE op = ? ',
        [detalle.op]
      );

      if (existing) {
        const conflict = `OP: ${existing.op}`;
        return {
          success: false,
          error: `El registro con ${conflict} ya está agregado.`,
          duplicateId: existing.id,
        };
      }

      await db.runAsync(
        'INSERT INTO detalles_prendas (id, op, estilo, color, estado) VALUES (?, ?, ?, ?, ?)',
        [detalle.id, detalle.op, detalle.estilo, detalle.color, detalle.estado]
      );
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al guardar el detalle.' };
    }
  },

  updateDetallePrendaStatus: async (db: SQLiteDatabase, id: string, newStatus: number) => {
    try {
      await db.runAsync('UPDATE detalles_prendas SET estado = ? WHERE id = ?', [newStatus, id]);
      return { success: true };
    } catch (error) {
      console.error('Error updating status:', error);
      return { success: false, error: 'Error al actualizar el estado.' };
    }
  },

  deleteDetallesPrenda: async (db: SQLiteDatabase, ids: string[]) => {
    try {
      for (const id of ids) {
        await db.runAsync('DELETE FROM detalles_prendas WHERE id = ?', [id]);
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting detalles:', error);
      return { success: false, error: 'Error al eliminar detalles.' };
    }
  },

  getAllDetalles: async (db: SQLiteDatabase) => {
    try {
      return await db.getAllAsync<DetallePrenda>('SELECT * FROM detalles_prendas ORDER BY rowid DESC');
    } catch (error) {
      console.error('Error fetching detalles:', error);
      return [];
    }
  }
};
