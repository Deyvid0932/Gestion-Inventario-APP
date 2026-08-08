import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { User } from '@supabase/supabase-js';
import { ProfileService } from './ProfileService';
import { RoleService } from './RoleService';
import { SynchronizationEngine } from '../sync/SynchronizationEngine';
import { useAppStore } from '../store/useAppStore';

const LAST_USER_ID_KEY = 'last_authenticated_user_id';

export const AuthManager = {
  getLastUserId: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(LAST_USER_ID_KEY);
    } catch (e) {
      console.error('Error al obtener lastUserId:', e);
      return null;
    }
  },

  setLastUserId: async (userId: string | null): Promise<void> => {
    try {
      if (userId) {
        await AsyncStorage.setItem(LAST_USER_ID_KEY, userId);
      } else {
        await AsyncStorage.removeItem(LAST_USER_ID_KEY);
      }
    } catch (e) {
      console.error('Error al guardar lastUserId:', e);
    }
  },

  // Refrescar todos los datos de la app desde SQLite a Zustand reactivo
  refreshAllAppState: async (db: SQLiteDatabase): Promise<void> => {
    try {
      // Limpiar automáticamente registros vacíos creados por sincronización si no contienen cajas/prendas activas
      await db.runAsync(`
        DELETE FROM inventarios 
        WHERE (nombre = 'Nuevo Lote' OR nombre = 'Lote Sincronizado') 
          AND id NOT IN (SELECT DISTINCT inventarioId FROM cajas WHERE deleted_at IS NULL);
      `).catch(() => {});

      await db.runAsync(`
        DELETE FROM cajas 
        WHERE (nombre = 'Caja Sincronizada' OR nombre = 'Nueva Caja') 
          AND id NOT IN (SELECT DISTINCT cajaId FROM prendas WHERE deleted_at IS NULL);
      `).catch(() => {});

      let freshInventarios: any[] = [];
      try {
        freshInventarios = await db.getAllAsync<any>(
          `SELECT i.*, 
                  (SELECT COUNT(*) FROM cajas WHERE inventarioId = i.id AND deleted_at IS NULL) as totalCajas,
                  COUNT(CASE WHEN p.deleted_at IS NULL THEN p.id ELSE NULL END) as totalPrendas,
                  SUM(CASE WHEN p.estado = 1 AND p.deleted_at IS NULL THEN 1 ELSE 0 END) as prendasEscaneadas
           FROM inventarios i 
           LEFT JOIN cajas c ON c.inventarioId = i.id AND c.deleted_at IS NULL
           LEFT JOIN prendas p ON p.cajaId = c.id AND p.deleted_at IS NULL
           WHERE i.deleted_at IS NULL
           GROUP BY i.id
           ORDER BY i.orden ASC, i.fechaCreacion DESC`
        );
      } catch (_e) {
        freshInventarios = await db.getAllAsync<any>(
          `SELECT i.*, 
                  (SELECT COUNT(*) FROM cajas WHERE inventarioId = i.id AND deleted_at IS NULL) as totalCajas,
                  COUNT(CASE WHEN p.deleted_at IS NULL THEN p.id ELSE NULL END) as totalPrendas,
                  SUM(CASE WHEN p.estado = 1 AND p.deleted_at IS NULL THEN 1 ELSE 0 END) as prendasEscaneadas
           FROM inventarios i 
           LEFT JOIN cajas c ON c.inventarioId = i.id AND c.deleted_at IS NULL
           LEFT JOIN prendas p ON p.cajaId = c.id AND p.deleted_at IS NULL
           WHERE i.deleted_at IS NULL
           GROUP BY i.id
           ORDER BY i.fechaCreacion DESC`
        );
      }
      useAppStore.getState().setInventarios(freshInventarios);
    } catch (e) {
      console.error('Error al refrescar estado de la app:', e);
    }
  },

  handleAuthChange: async (db: SQLiteDatabase, user: User | null): Promise<void> => {
    if (!user) {
      // 1. Reseteo instantáneo de la UI en Zustand
      useAppStore.getState().clearAllState();

      // 2. Limpiar datos locales en SQLite y resetear el último usuario
      await SynchronizationEngine.cleanLocalData(db);
      await AuthManager.setLastUserId(null);
      return;
    }

    try {
      // Mostrar Modal bonito de carga durante el proceso de auth / sync
      useAppStore.getState().setSyncing(true, 'Obteniendo y sincronizando tus datos...');

      const currentUserId = user.id;
      const previousUserId = await AuthManager.getLastUserId();

      // 1. Crear o actualizar profile automáticamente en Supabase
      await ProfileService.upsertProfile(user);

      // 2. Obtener roles y estado de cuenta activo desde Supabase
      const roleInfo = await RoleService.getUserProfileAndRoles(currentUserId);
      useAppStore.getState().setUserProfileAndRoles(roleInfo.profile, roleInfo.roles, roleInfo.isActive);

      if (!roleInfo.isActive) {
        console.warn('[AUTH_LOG] Cuenta desactivada por un Administrador. Deteniendo sincronización.');
        useAppStore.getState().setSyncing(false);
        return;
      }

      // 3. Evaluar Casos de Login y descargar/subir datos de Supabase
      if (previousUserId && previousUserId !== currentUserId) {
        // CASO 2: Cambio de cuenta
        useAppStore.getState().clearAllState();
        await SynchronizationEngine.cleanLocalData(db);
        await SynchronizationEngine.pullAll(db, currentUserId);
      } else if (!previousUserId) {
        // CASO 1 & 4: Primer login
        const guestData = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM inventarios WHERE user_id IS NULL OR user_id = ''`
        );

        if (guestData && guestData.count > 0) {
          await SynchronizationEngine.adoptLocalData(db, currentUserId);
          await SynchronizationEngine.fullSync(db, currentUserId);
        } else {
          await SynchronizationEngine.pullAll(db, currentUserId);
        }
      } else {
        // Re-apertura o sesión activa
        await SynchronizationEngine.fullSync(db, currentUserId);
      }

      // 3. REFRESCO TOTAL: Recargar SQLite en Zustand reactivo para pintar la UI de inmediato
      await AuthManager.refreshAllAppState(db);

      // 4. Guardar ID del usuario activo
      await AuthManager.setLastUserId(currentUserId);
    } catch (e) {
      console.error('Error en AuthManager.handleAuthChange:', e);
    } finally {
      // Ocultar Modal de carga al terminar
      useAppStore.getState().setSyncing(false);
    }
  },
};
