import { SQLiteDatabase } from 'expo-sqlite';
import { DetallePrenda } from '../types';

export const DetallePrendaService = {
  addDetallePrenda: async (db: SQLiteDatabase, detalle: DetallePrenda, detalleId: string) => {
    try {
      const finalDetalleId = detalleId || detalle.detalleId;

      if (!finalDetalleId) {
        return { success: false, error: 'ID de inventario faltante.' };
      }

      if (detalle.op && detalle.op.trim() !== '') {
        const existing = await db.getFirstAsync<{ id: string; op: string; estilo: string }>(
          'SELECT op FROM detalles_prendas WHERE op = ? ',
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
      }

      await db.runAsync(
        'INSERT INTO detalles_prendas (id, detalleId, op, estilo, color, estado) VALUES (?, ?, ?, ?, ?, ?)',
        [
          detalle.id, 
          finalDetalleId,
          detalle.op || '', 
          detalle.estilo, 
          detalle.color, 
          detalle.estado
        ]
      );
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al guardar el detalle.' };
    }
  },

  updateDetallePrenda: async (db: SQLiteDatabase, detalle: DetallePrenda) => {
    try {
      if (detalle.op && detalle.op.trim() !== '') {
        // Verificar si la OP ya existe en OTRO registro (diferente id)
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM detalles_prendas WHERE op = ? AND id != ?',
          [detalle.op, detalle.id]
        );

        if (existing) {
          return {
            success: false,
            error: `La OP: ${detalle.op} ya está asignada a otro registro.`,
          };
        }
      }

      await db.runAsync(
        'UPDATE detalles_prendas SET detalleId = ?, op = ?, estilo = ?, color = ?, estado = ? WHERE id = ?',
        [detalle.detalleId, detalle.op || '', detalle.estilo, detalle.color, detalle.estado, detalle.id]
      );
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al actualizar el detalle.' };
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
      if (ids.length === 0) return { success: true };
      const placeholders = ids.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM detalles_prendas WHERE id IN (${placeholders})`, ids);
      return { success: true };
    } catch (error) {
      console.error('Error deleting detalles:', error);
      return { success: false, error: 'Error al eliminar detalles.' };
    }
  },

  bulkAddDetallesPrenda: async (db: SQLiteDatabase, detalles: DetallePrenda[]) => {
    try {
      await db.withTransactionAsync(async () => {
        for (const detalle of detalles) {
          await db.runAsync(
            'INSERT INTO detalles_prendas (id, detalleId, op, estilo, color, estado) VALUES (?, ?, ?, ?, ?, ?)',
            [detalle.id, detalle.detalleId, detalle.op || '', detalle.estilo, detalle.color, detalle.estado]
          );
        }
      });
      return { success: true };
    } catch (e) {
      console.error('Error in bulkAddDetallesPrenda:', e);
      return { success: false, error: 'Error al realizar la carga masiva.' };
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
