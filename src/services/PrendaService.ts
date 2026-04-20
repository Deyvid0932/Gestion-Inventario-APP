import { SQLiteDatabase } from 'expo-sqlite';
import { Prenda } from '../types';

export const PrendaService = {
  addPrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    try {
      const existing = await db.getFirstAsync<{ id: string; op: string; estilo: string }>(
        'SELECT id, op, estilo FROM prendas WHERE (op = ? OR estilo = ?) AND cajaId = ?',
        [prenda.op, prenda.estilo, prenda.cajaId]
      );

      if (existing) {
        const conflict = existing.op === prenda.op ? `OP: ${existing.op}` : `Estilo: ${existing.estilo}`;
        return {
          success: false,
          error: `El registro con ${conflict} ya está agregado en esta caja.`,
          duplicateId: existing.id,
        };
      }

      await db.runAsync(
        'INSERT INTO prendas (id, cajaId, op, estilo, color) VALUES (?, ?, ?, ?, ?)',
        [prenda.id, prenda.cajaId, prenda.op, prenda.estilo, prenda.color]
      );

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al guardar en la base de datos.' };
    }
  },

  updatePrendaStatus: async (db: SQLiteDatabase, id: string, newStatus: number) => {
    try {
      await db.runAsync('UPDATE prendas SET estado = ? WHERE id = ?', [newStatus, id]);
      return { success: true };
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      return { success: false, error: 'Error al actualizar el estado en la base de datos.' };
    }
  },

  getAllPrendasByCaja: async (db: SQLiteDatabase, cajaId: string) => {
    try {
      return await db.getAllAsync<Prenda>('SELECT * FROM prendas WHERE cajaId = ? ORDER BY rowid DESC', [cajaId]);
    } catch (error) {
      console.error('Error fetching prendas:', error);
      return [];
    }
  }
};
