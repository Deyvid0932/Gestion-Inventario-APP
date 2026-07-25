import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { AppNavigation } from './src/navigation/AppNavigation';
import { migrateDbIfNeeded } from './src/database/database';
import { useAppStore } from './src/store/useAppStore';
import { RootStackParamList } from './src/types';

import { Text, TextInput } from 'react-native';

// Garantizar accesibilidad de fuente grande sin romper el diseño en pantallas pequeñas
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.35;

if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.35;

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

import { useSQLiteContext } from 'expo-sqlite';
import { supabase } from './src/database/supabase';
import { SyncService } from './src/services/SyncService';

const ThemeInitializer = () => {
  const db = useSQLiteContext();
  const loadThemeFromDb = useAppStore(state => state.loadThemeFromDb);

  useEffect(() => {
    if (db) {
      loadThemeFromDb(db);
    }
  }, [db, loadThemeFromDb]);

  return null;
};

const AuthInitializer = () => {
  const setSession = useAppStore(state => state.setSession);
  const setLastSyncTime = useAppStore(state => state.setLastSyncTime);

  useEffect(() => {
    SyncService.getLastSyncTime().then(time => {
      if (time) setLastSyncTime(time);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLastSyncTime]);

  return null;
};

export default function App() {
  const themeMode = useAppStore(state => state.themeMode);
  const currentTheme = useAppStore(state => state.currentTheme);

  useEffect(() => {
    // Listener para cuando el usuario toca una notificación (abierta, en segundo plano o cerrada)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.cajaId && navigationRef.isReady()) {
        navigationRef.navigate('ExcelGrid', {
          cajaId: data.cajaId as string,
          nombreCaja: (data.cajaNombre as string) || 'Caja',
          targetPrendaId: data.prendaId as string,
        });
      }
    });

    return () => subscription.remove();
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
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
