import { SQLiteDatabase } from 'expo-sqlite';
import { Inventario } from '../types';

export const InventarioService = {
  create: async (db: SQLiteDatabase, inventario: Inventario) => {
    await db.runAsync(
      'INSERT INTO inventarios (id, nombre, descripcion, fechaCreacion, estado) VALUES (?, ?, ?, ?, ?)',
      [inventario.id, inventario.nombre, inventario.descripcion, inventario.fechaCreacion, inventario.estado]
    );
  },

  update: async (db: SQLiteDatabase, id: string, nombre: string, descripcion: string) => {
    await db.runAsync(
      'UPDATE inventarios SET nombre = ?, descripcion = ? WHERE id = ?',
      [nombre, descripcion, id]
    );
  },

  getAll: async (db: SQLiteDatabase) => {
    return await db.getAllAsync<Inventario>('SELECT * FROM inventarios ORDER BY fechaCreacion DESC');
  }
};
