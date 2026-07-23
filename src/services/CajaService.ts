import { SQLiteDatabase } from 'expo-sqlite';
import { Caja } from '../types';

export const CajaService = {
  create: async (db: SQLiteDatabase, caja: Caja) => {
    await db.runAsync(
      'INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion, orden) VALUES (?, ?, ?, ?, ?)',
      [caja.id, caja.inventarioId, caja.nombre, caja.fechaCreacion, caja.orden || 0]
    );
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string) => {
    await db.runAsync(
      'UPDATE cajas SET nombre = ? WHERE id = ?',
      [nombre, id]
    );
  },

  getAllByInventario: async (db: SQLiteDatabase, inventarioId: string) => {
    return await db.getAllAsync<Caja>('SELECT * FROM cajas WHERE inventarioId = ? ORDER BY orden ASC, fechaCreacion DESC', [inventarioId]);
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
      await db.withTransactionAsync(async () => {
        for (const item of orderings) {
          await db.runAsync('UPDATE cajas SET orden = ? WHERE id = ?', [item.orden, item.id]);
        }
      });
      return { success: true };
    } catch (e) {
      console.error("Error updating cajas order:", e);
      return { success: false };
    }
  }
};
