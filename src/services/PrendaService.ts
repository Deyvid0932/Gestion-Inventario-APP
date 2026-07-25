import { SQLiteDatabase } from 'expo-sqlite';
import { Prenda } from '../types';
import { AuthService } from './AuthService';
import { supabase } from '../database/supabase';

export const PrendaService = {
  addPrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    const isGuest = await AuthService.isGuestMode();
    try {
      if (prenda.op && prenda.op.trim() !== '') {
        const existing = await db.getFirstAsync<{ id: string; op: string; }>(
          'SELECT id, op FROM prendas WHERE op = ? AND cajaId = ?',
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
        'INSERT INTO prendas (id, cajaId, op, estilo, color, fotoUri, fotoUri2, fechaCreacion, alarmaFechaHora, alarmaNotificationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          prenda.id,
          prenda.cajaId,
          prenda.op || '',
          prenda.estilo,
          prenda.color,
          prenda.fotoUri || null,
          prenda.fotoUri2 || null,
          prenda.fechaCreacion || new Date().toISOString(),
          prenda.alarmaFechaHora || null,
          prenda.alarmaNotificationId || null
        ]
      );

      if (!isGuest) {
        await supabase.from('prendas').upsert({
          id: prenda.id,
          cajaId: prenda.cajaId,
          op: prenda.op || '',
          estilo: prenda.estilo,
          color: prenda.color,
          fotoUri: prenda.fotoUri || null,
          fotoUri2: prenda.fotoUri2 || null,
          fechaCreacion: prenda.fechaCreacion || new Date().toISOString(),
          alarmaFechaHora: prenda.alarmaFechaHora || null,
          alarmaNotificationId: prenda.alarmaNotificationId || null
        })
      }

      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Error al guardar en la base de datos.' };
    }
  },

  updatePrenda: async (db: SQLiteDatabase, prenda: Prenda) => {
    try {
      if (prenda.op && prenda.op.trim() !== '') {
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
        'UPDATE prendas SET op = ?, estilo = ?, color = ?, fotoUri = ?, fotoUri2 = ?, alarmaFechaHora = ?, alarmaNotificationId = ? WHERE id = ?',
        [
          prenda.op || '',
          prenda.estilo,
          prenda.color,
          prenda.fotoUri || null,
          prenda.fotoUri2 || null,
          prenda.alarmaFechaHora || null,
          prenda.alarmaNotificationId || null,
          prenda.id
        ]
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
            'INSERT INTO prendas (id, cajaId, op, estilo, color, fotoUri, fotoUri2, fechaCreacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              prenda.id,
              prenda.cajaId,
              prenda.op || '',
              prenda.estilo,
              prenda.color,
              prenda.fotoUri || null,
              prenda.fotoUri2 || null,
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
