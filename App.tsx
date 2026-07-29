import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { Text, TextInput } from 'react-native';

import { AppNavigation } from './src/navigation/AppNavigation';
import { migrateDbIfNeeded } from './src/database/database';
import { useAppStore } from './src/store/useAppStore';
import { RootStackParamList } from './src/types';
import { supabase } from './src/database/supabase';
import { AuthManager } from './src/services/AuthManager';
import { SynchronizationEngine } from './src/sync/SynchronizationEngine';
import { LoadingModal } from './src/components/LoadingModal';

import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Prevenir pantalla roja por bug interno de Expo Dev Settings en rechazo de promesas
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const originalHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    if (error?.message?.includes('reload') || error?.toString()?.includes('reload')) {
      console.warn('[ExpoDevGuard] Error de dev reload ignorado:', error);
      return;
    }
    if (originalHandler) originalHandler(error, isFatal);
  });
}

// Garantizar accesibilidad de fuente grande sin romper el diseño en pantallas pequeñas
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.35;

if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.35;

import { navigationRef } from './src/navigation/navigationRef';

const ThemeInitializer = () => {
  const db = useSQLiteContext();
  const loadThemeFromDb = useAppStore(state => state.loadThemeFromDb);

  useEffect(() => {
    if (db) {
      loadThemeFromDb(db).finally(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    }
  }, [db, loadThemeFromDb]);

  return null;
};

const AuthInitializer = () => {
  const db = useSQLiteContext();
  const setSession = useAppStore(state => state.setSession);
  const setLastSyncTime = useAppStore(state => state.setLastSyncTime);

  useEffect(() => {
    let subscription: any = null;
    try {
      SynchronizationEngine.getLastSyncTime().then(time => {
        if (time) setLastSyncTime(time);
      }).catch(e => console.error('[STARTUP_LOG] Error al obtener last sync time:', e));

      supabase.auth.getSession().then((res) => {
        const session = res?.data?.session ?? null;
        setSession(session);
        if (db) {
          AuthManager.handleAuthChange(db, session?.user ?? null).catch(e => console.error('[STARTUP_LOG] Error en handleAuthChange:', e));
        }
      }).catch(e => console.error('[STARTUP_LOG] Error al obtener sesion de Supabase:', e));

      const authRes = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (db) {
          AuthManager.handleAuthChange(db, session?.user ?? null).catch(e => console.error('[STARTUP_LOG] Error en onAuthStateChange:', e));
        }
      });
      subscription = authRes?.data?.subscription;
    } catch (e) {
      console.error('[STARTUP_LOG] Excepción en AuthInitializer:', e);
    }

    return () => {
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      } catch (_) {}
    };
  }, [db, setSession, setLastSyncTime]);

  return null;
};

export default function App() {
  const themeMode = useAppStore(state => state.themeMode);
  const currentTheme = useAppStore(state => state.currentTheme);
  const isSyncing = useAppStore(state => state.isSyncing);
  const syncMessage = useAppStore(state => state.syncMessage);

  useEffect(() => {
    let subscription: any = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(response => {
        try {
          const data = response?.notification?.request?.content?.data;
          if (data?.cajaId && navigationRef.isReady()) {
            navigationRef.navigate('ExcelGrid', {
              cajaId: data.cajaId as string,
              nombreCaja: (data.cajaNombre as string) || 'Caja',
              targetPrendaId: data.prendaId as string,
            });
          }
        } catch (e) {
          console.error('[STARTUP_LOG] Error procesando respuesta de notificación:', e);
        }
      });
    } catch (e) {
      console.error('[STARTUP_LOG] Excepción al registrar listener de notificaciones:', e);
    }

    return () => {
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (_) {}
    };
  }, []);

  const navigationTheme = {
    ...(themeMode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(themeMode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: currentTheme.background,
      card: currentTheme.card,
    },
  };

  return (
    <SafeAreaProvider style={{ backgroundColor: currentTheme.background }}>
      <SQLiteProvider databaseName="inventario.db" onInit={migrateDbIfNeeded}>
        <ThemeInitializer />
        <AuthInitializer />
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <AppNavigation />
        </NavigationContainer>
        <LoadingModal visible={isSyncing} message={syncMessage} />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
