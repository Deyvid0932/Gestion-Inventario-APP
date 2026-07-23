import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import { AppNavigation } from './src/navigation/AppNavigation';
import { migrateDbIfNeeded } from './src/database/database';
import { useAppStore } from './src/store/useAppStore';
import { RootStackParamList } from './src/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const { themeMode, currentTheme } = useAppStore();

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
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <AppNavigation />
        </NavigationContainer>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
