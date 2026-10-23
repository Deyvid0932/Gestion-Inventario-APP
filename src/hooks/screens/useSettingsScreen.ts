import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAppStore } from '../../store/useAppStore';
import { AuthService, SyncService, StatsService, DashboardStats, RoleService, ExcelImportService, LegacyImportService } from '../../services';
import { maskEmail } from '../../utils/maskUtils';
import { exportSqliteDatabase } from '../../utils/export';
import { useRoles } from '../common/useRoles';

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';

export const useSettingsScreen = () => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const toggleTheme = useAppStore(state => state.toggleTheme);
  const user = useAppStore(state => state.user);
  const isAuthLoading = useAppStore(state => state.isAuthLoading);
  const setIsAuthLoading = useAppStore(state => state.setIsAuthLoading);
  const setSession = useAppStore(state => state.setSession);
  const logout = useAppStore(state => state.logout);
  const userRoles = useAppStore(state => state.userRoles);
  const lastSyncTime = useAppStore(state => state.lastSyncTime);
  const setLastSyncTime = useAppStore(state => state.setLastSyncTime);
  const { isAdmin } = useRoles();

  // Modals state
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [userMgmtModalVisible, setUserMgmtModalVisible] = useState(false);
  const [trashModalVisible, setTrashModalVisible] = useState(false);
  const [isExportingDb, setIsExportingDb] = useState(false);

  // Stats state
  const [stats, setStats] = useState<DashboardStats>({
    totalInventories: 0,
    totalBoxes: 0,
    totalGarments: 0,
    activeGarments: 0,
    inactiveGarments: 0,
    garmentsWithPhoto: 0,
    garmentsWithAlarm: 0,
    topBoxName: '',
    topBoxCount: 0,
    top5Boxes: [],
    topColors: [],
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Todo está sincronizado correctamente.');

  useFocusEffect(
    useCallback(() => {
      if (db) {
        StatsService.getStats(db, user?.id)
          .then(data => {
            setStats(data);
          })
          .catch(e => console.error('Error fetching settings stats:', e));

        if (user?.id) {
          RoleService.getUserProfileAndRoles(user.id)
            .then(roleInfo => {
              useAppStore.getState().setUserProfileAndRoles(
                roleInfo.profile,
                roleInfo.roles,
                roleInfo.isActive
              );
            })
            .catch(() => {});
        }
      }
    }, [db, user?.id])
  );

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuario';
  const email = user?.email || '';
  const maskedEmail = maskEmail(email);

  const handleGoogleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      setSyncStatus('syncing');
      const { session } = await AuthService.signInWithGoogle();
      if (session) {
        const roleInfo = await RoleService.getUserProfileAndRoles(session.user.id);
        useAppStore.getState().setUserProfileAndRoles(roleInfo.profile, roleInfo.roles, roleInfo.isActive);
        setSession(session);

        if (!roleInfo.isActive) {
          setSyncStatus('error');
          setSyncMessage('Cuenta suspendida.');
          return;
        }

        setSyncStatus('synced');
        setSyncMessage('Sesión conectada con Google.');
        Alert.alert('¡Bienvenido!', `Sesión iniciada como ${session.user.email}`);
      }
    } catch (error: any) {
      setSyncStatus('error');
      setSyncMessage('Error al conectar con Google.');
      Alert.alert('Error de Autenticación', error.message || 'No se pudo iniciar sesión.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas cerrar tu sesión actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await AuthService.signOut();
            logout();
            setSyncStatus('synced');
            setSyncMessage('Modo Local Activo');
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    if (!user) {
      Alert.alert('Modo Local', 'Inicia sesión con Google para sincronizar tus datos en la nube.');
      return;
    }
    try {
      setIsAuthLoading(true);
      setSyncStatus('syncing');
      setSyncMessage('Sincronizando lotes, cajas y prendas...');

      const result = await SyncService.syncAll(db, user.id);
      if (result.success) {
        setLastSyncTime(result.syncedAt);
        setSyncStatus('synced');
        setSyncMessage('Todo está sincronizado correctamente.');
        Alert.alert('Sincronización Completada', 'Tus datos se han respaldado correctamente en la nube.');
      } else {
        setSyncStatus('error');
        setSyncMessage('Ocurrió un error en la sincronización.');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('No existe conexión a internet o falló el servidor.');
      Alert.alert('Error de Sincronización', 'No se pudo completar la sincronización.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const formattedSyncTime = (() => {
    if (!lastSyncTime) return 'Pendiente de sincronizar';
    const date = new Date(lastSyncTime);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  })();

  const handleToggleTheme = useCallback(() => {
    toggleTheme(db);
  }, [toggleTheme, db]);

  const handleExportDatabase = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert('Acceso Restringido', 'Solo los administradores tienen permiso para exportar la base de datos.');
      return;
    }
    try {
      setIsExportingDb(true);
      await exportSqliteDatabase(db);
    } catch (e: any) {
      console.error('Error al exportar base de datos:', e);
      Alert.alert('Error', 'No se pudo exportar la base de datos.');
    } finally {
      setIsExportingDb(false);
    }
  }, [db, isAdmin]);

  const handleImportSeedData = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert('Acceso Restringido', 'Solo los administradores tienen permiso para importar datos masivos.');
      return;
    }

    Alert.alert(
      '📥 Importar Reporte de Inventario',
      '¿Deseas importar el reporte de 629 prendas distribuidas en 21 cajas (TOPYTOP y Lacoste)?\n\nEste proceso creará los lotes, las cajas y registrará todas las prendas automáticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar Ahora',
          onPress: async () => {
            try {
              setIsAuthLoading(true);
              const result = await ExcelImportService.importSeedInventory(db, user?.id);
              if (result.success) {
                const updatedStats = await StatsService.getStats(db, user?.id);
                setStats(updatedStats);

                Alert.alert(
                  '✅ Importación Exitosa',
                  `Se importaron correctamente:\n• ${result.importedGarments} prendas registradas\n• ${result.importedBoxes} cajas creadas\n• ${result.importedInventories} lotes creados${result.skippedGarments ? `\n• ${result.skippedGarments} omitidas por existir previamente` : ''}\n\nLos datos se sincronizarán con Supabase.`
                );
              } else {
                Alert.alert('Error', result.error || 'No se pudo completar la importación.');
              }
            } catch (err: any) {
              console.error('Error importing seed inventory:', err);
              Alert.alert('Error', 'Ocurrió un error al importar los datos.');
            } finally {
              setIsAuthLoading(false);
            }
          },
        },
      ]
    );
  }, [db, isAdmin, user?.id, setIsAuthLoading]);

  const handleImportLegacyBackup = useCallback(async () => {
    if (!isAdmin) {
      Alert.alert('Acceso Restringido', 'Solo los administradores pueden importar respaldos antiguos.');
      return;
    }

    Alert.alert(
      '📷 Importar respaldo antiguo',
      'Selecciona la carpeta MigracionInventario que contiene migration-data.json y las fotografías.\n\nLas prendas existentes se reconocerán para evitar duplicados y solo se agregarán las fotos que falten.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Seleccionar carpeta',
          onPress: async () => {
            try {
              setIsAuthLoading(true);
              const result = await LegacyImportService.importFromSelectedFolder(db, user?.id);
              if (result.canceled) return;
              if (!result.success) {
                Alert.alert('No se pudo importar', result.error || 'El respaldo no es válido.');
                return;
              }

              const updatedStats = await StatsService.getStats(db, user?.id);
              setStats(updatedStats);
              Alert.alert(
                '✅ Respaldo importado',
                `Resultado:\n• ${result.matchedGarments} prendas existentes reconocidas\n• ${result.importedGarments} prendas nuevas\n• ${result.importedPhotos} fotos recuperadas\n• ${result.skippedPhotos} fotos omitidas porque ya existían${result.failedPhotos ? `\n• ${result.failedPhotos} fotos no pudieron copiarse` : ''}\n\nLos cambios pendientes se sincronizarán con tu cuenta.`,
              );
            } catch (error: any) {
              console.error('Error importing legacy backup:', error);
              Alert.alert('Error', error?.message || 'No se pudo importar el respaldo antiguo.');
            } finally {
              setIsAuthLoading(false);
            }
          },
        },
      ],
    );
  }, [db, isAdmin, user?.id, setIsAuthLoading]);

  return {
    state: {
      user,
      userRoles,
      isAuthLoading,
      isExportingDb,
      stats,
      syncStatus,
      syncMessage,
      profileModalVisible,
      themeModalVisible,
      exportModalVisible,
      notifModalVisible,
      aboutModalVisible,
      privacyModalVisible,
      userMgmtModalVisible,
      trashModalVisible,
    },
    computed: {
      currentTheme,
      themeMode,
      avatarUrl,
      fullName,
      email,
      maskedEmail,
      formattedSyncTime,
    },
    handlers: {
      handleGoogleSignIn,
      handleSignOut,
      handleSync,
      handleToggleTheme,
      handleExportDatabase,
      handleImportSeedData,
      handleImportLegacyBackup,
      setProfileModalVisible,
      setThemeModalVisible,
      setExportModalVisible,
      setNotifModalVisible,
      setAboutModalVisible,
      setPrivacyModalVisible,
      setUserMgmtModalVisible,
      setTrashModalVisible,
    },
  };
};
