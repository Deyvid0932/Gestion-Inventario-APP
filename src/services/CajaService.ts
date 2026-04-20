import { SQLiteDatabase } from 'expo-sqlite';
import { Caja } from '../types';

export const CajaService = {
  create: async (db: SQLiteDatabase, caja: Caja) => {
    await db.runAsync(
      'INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion) VALUES (?, ?, ?, ?)',
      [caja.id, caja.inventarioId, caja.nombre, caja.fechaCreacion]
    );
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string) => {
    await db.runAsync(
      'UPDATE cajas SET nombre = ? WHERE id = ?',
      [nombre, id]
    );
  },

  getAllByInventario: async (db: SQLiteDatabase, inventarioId: string) => {
    return await db.getAllAsync<Caja>('SELECT * FROM cajas WHERE inventarioId = ? ORDER BY fechaCreacion DESC', [inventarioId]);
  }
};
