import AsyncStorage from '@react-native-async-storage/async-storage';
import { SQLiteDatabase } from 'expo-sqlite';
import { User } from '@supabase/supabase-js';
import { ProfileService } from './ProfileService';
import { RoleService } from './RoleService';
import { SynchronizationEngine } from '../../sync/SynchronizationEngine';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../database/supabase';

const LAST_USER_ID_KEY = 'last_authenticated_user_id';

let isProcessingAuth = false;

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

  refreshAllAppState: async (db: SQLiteDatabase): Promise<void> => {
    try {
      await db.runAsync(`
        DELETE FROM inventories 
        WHERE (name = 'Nuevo Lote' OR name = 'Lote Sincronizado') 
          AND id NOT IN (SELECT DISTINCT inventory_id FROM boxes WHERE deleted_at IS NULL);
      `).catch(() => {});

      await db.runAsync(`
        DELETE FROM boxes 
        WHERE (name = 'Caja Sincronizada' OR name = 'Nueva Caja') 
          AND id NOT IN (SELECT DISTINCT box_id FROM garments WHERE deleted_at IS NULL);
      `).catch(() => {});

      const freshInventories = await db.getAllAsync<any>(
        `SELECT i.*, 
                (SELECT COUNT(*) FROM boxes WHERE inventory_id = i.id AND deleted_at IS NULL) as totalBoxes,
                COUNT(CASE WHEN g.deleted_at IS NULL THEN g.id ELSE NULL END) as totalGarments,
                SUM(CASE WHEN g.status = 1 AND g.deleted_at IS NULL THEN 1 ELSE 0 END) as scannedGarments
         FROM inventories i 
         LEFT JOIN boxes b ON b.inventory_id = i.id AND b.deleted_at IS NULL
         LEFT JOIN garments g ON g.box_id = b.id AND g.deleted_at IS NULL
         WHERE i.deleted_at IS NULL
         GROUP BY i.id
         ORDER BY COALESCE(i.order_index, 0) ASC, i.created_at DESC`
      );
      useAppStore.getState().setInventories(freshInventories);
      useAppStore.getState().bumpDataRevision();
    } catch (e) {
      console.error('Error al refrescar estado de la app:', e);
    }
  },

  handleAuthChange: async (db: SQLiteDatabase, user: User | null): Promise<void> => {
    if (isProcessingAuth) return;
    isProcessingAuth = true;

    if (!user) {
      try {
        const previousUserId = await AuthManager.getLastUserId();
        await SynchronizationEngine.preservePendingInventory(db, previousUserId);
        useAppStore.getState().clearAllState();
        await SynchronizationEngine.cleanLocalData(db);
        await AuthManager.setLastUserId(null);
      } finally {
        isProcessingAuth = false;
      }
      return;
    }

    try {
      const currentUserId = user.id;

      // 1. Refrescar estado local desde SQLite inmediatamente para pintar la UI sin esperas
      await AuthManager.refreshAllAppState(db);

      // Asegurar primero el perfil para que assign_default_role no choque con
      // la foreign key de profile_roles si el login es el primero del usuario.
      const [previousUserId] = await Promise.all([
        AuthManager.getLastUserId(),
        ProfileService.upsertProfile(user).catch(e => console.warn('upsertProfile warning:', e)),
      ]);
      const roleInfo = await RoleService.getUserProfileAndRoles(currentUserId).catch(() => ({
        profile: null,
        roles: ['Viewer'] as any[],
        isActive: true,
      }));

      // Actualizar perfil y roles en el store
      useAppStore.getState().setUserProfileAndRoles(roleInfo.profile, roleInfo.roles, roleInfo.isActive);

      // Si la cuenta fue suspendida por un Administrador, cerrar sesión y expulsar al usuario
      if (roleInfo.isActive === false) {
        console.warn('[AUTH_LOG] Cuenta desactivada por un Administrador. Expulsando y limpiando sesión.');
        useAppStore.getState().setSyncing(false);
        await SynchronizationEngine.preservePendingInventory(db, currentUserId);
        await SynchronizationEngine.cleanLocalData(db);
        await AuthManager.setLastUserId(null);
        await supabase.auth.signOut().catch(() => {});
        isProcessingAuth = false;
        return;
      }

      // Evaluar casos de login y sincronizar datos
      if (previousUserId && previousUserId !== currentUserId) {
        // CASO 2: Cambio de cuenta
        await SynchronizationEngine.preservePendingInventory(db, previousUserId);
        useAppStore.getState().clearAllState();
        await SynchronizationEngine.cleanLocalData(db);
        await SynchronizationEngine.restorePendingInventory(db, currentUserId);
        await SynchronizationEngine.fullSync(db, currentUserId, false, true);
      } else if (!previousUserId) {
        // CASO 1 & 4: Primer login
        await SynchronizationEngine.restorePendingInventory(db, currentUserId);
        const guestData = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) as count FROM inventories WHERE user_id IS NULL OR user_id = ''`
        );

        if (guestData && guestData.count > 0) {
          await SynchronizationEngine.adoptLocalData(db, currentUserId);
          await SynchronizationEngine.fullSync(db, currentUserId, false, true);
        } else {
          await SynchronizationEngine.fullSync(db, currentUserId, false, true);
        }
      } else {
        // Re-apertura o sesión activa: sincronización con ruedita discreta en Navbar
        await SynchronizationEngine.restorePendingInventory(db, currentUserId);
        await SynchronizationEngine.fullSync(db, currentUserId, false, true);
      }

      // REFRESCO TOTAL: Recargar SQLite en Zustand reactivo para pintar la UI de inmediato
      await AuthManager.refreshAllAppState(db);

      // Guardar ID del usuario activo
      await AuthManager.setLastUserId(currentUserId);
    } catch (e) {
      console.error('Error en AuthManager.handleAuthChange:', e);
    } finally {
      isProcessingAuth = false;
      // Ocultar Modal de carga al terminar
      useAppStore.getState().setSyncing(false);
    }
  },
};
