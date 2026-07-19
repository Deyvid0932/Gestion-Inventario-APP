import { SQLiteDatabase } from 'expo-sqlite';
import { Prenda } from '../types';

export const PrendaService = {
  addPrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    try {
      // Solo validamos duplicados si el OP no está vacío
      if (prenda.op && prenda.op.trim() !== '') {
        const existing = await db.getFirstAsync<{ id: string; op: string; }>(
          'SELECT op FROM prendas WHERE op = ? AND cajaId = ?',
          [prenda.op, prenda.cajaId]
        );

        if (existing) {
          const conflict = `OP: ${existing.op}`;
          return {
            success: false,
            error: `El registro con ${conflict} ya está agregado en esta caja.`,
            duplicateId: existing.id,
          };
        }
      }

      await db.runAsync(
        'INSERT INTO prendas (id, cajaId, op, estilo, color, fotoUri, fechaCreacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          prenda.id, 
          prenda.cajaId, 
          prenda.op || '', 
          prenda.estilo, 
          prenda.color, 
          prenda.fotoUri || null,
          prenda.fechaCreacion || new Date().toISOString()
        ]
      );

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al guardar en la base de datos.' };
    }
  },

  updatePrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    try {
      if (prenda.op && prenda.op.trim() !== '') {
        // Verificar si la OP ya existe en otra prenda dentro de la MISMA CAJA
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM prendas WHERE op = ? AND cajaId = ? AND id != ?',
          [prenda.op, prenda.cajaId, prenda.id]
        );

        if (existing) {
          return {
            success: false,
            error: `La OP: ${prenda.op} ya existe en otra prenda de esta caja.`,
          };
        }
      }

      await db.runAsync(
        'UPDATE prendas SET op = ?, estilo = ?, color = ?, fotoUri = ? WHERE id = ?',
        [prenda.op || '', prenda.estilo, prenda.color, prenda.fotoUri || null, prenda.id]
      );
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al actualizar la prenda.' };
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

  movePrenda: async (db: SQLiteDatabase, prendaId: string, newCajaId: string) => {
    try {
      // Opcional: Podrías verificar si ya existe un OP duplicado en la nueva caja,
      // pero para mantenerlo simple, solo hacemos el UPDATE.
      // Actualizamos también fechaCreacion para que aparezca arriba en la nueva caja
      const now = new Date().toISOString();
      await db.runAsync('UPDATE prendas SET cajaId = ?, fechaCreacion = ? WHERE id = ?', [newCajaId, now, prendaId]);
      return { success: true };
    } catch (error) {
      console.error('Error al mover prenda:', error);
      return { success: false, error: 'Error al mover la prenda a la nueva caja.' };
    }
  },

  getAllPrendasByCaja: async (db: SQLiteDatabase, cajaId: string, search: string = '') => {
    try {
      if (search.trim() === '') {
        return await db.getAllAsync<Prenda>('SELECT * FROM prendas WHERE cajaId = ? ORDER BY fechaCreacion DESC', [cajaId]);
      }
      
      const startParam = `${search}%`;
      const exactParam = search;
      const searchParam = `%${search}%`;

      return await db.getAllAsync<Prenda>(
        `SELECT * FROM prendas 
         WHERE cajaId = ? AND (op LIKE ? OR estilo LIKE ? OR color LIKE ?) 
         ORDER BY 
          (CASE 
            WHEN op = ? OR estilo = ? OR color = ? THEN 0
            WHEN op LIKE ? OR estilo LIKE ? OR color LIKE ? THEN 1
            ELSE 2
          END), fechaCreacion DESC`,
        [
          cajaId, searchParam, searchParam, searchParam, 
          exactParam, exactParam, exactParam, 
          startParam, startParam, startParam
        ]
      );
    } catch (error) {
      console.error('Error fetching prendas:', error);
      return [];
    }
  },

  bulkAddPrendas: async (db: SQLiteDatabase, prendas: Prenda[]) => {
    try {
      await db.withTransactionAsync(async () => {
        for (const prenda of prendas) {
          await db.runAsync(
            'INSERT INTO prendas (id, cajaId, op, estilo, color, fotoUri, fechaCreacion) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              prenda.id, 
              prenda.cajaId, 
              prenda.op || '', 
              prenda.estilo, 
              prenda.color, 
              prenda.fotoUri || null,
              prenda.fechaCreacion || new Date().toISOString()
            ]
          );
        }
      });
      return { success: true };
    } catch (e) {
      console.error('Error in bulkAddPrendas:', e);
      return { success: false, error: 'Error al realizar la carga masiva.' };
    }
  }
};
