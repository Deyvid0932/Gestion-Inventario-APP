import React, { Suspense } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { AppNavigation } from './src/navigation/AppNavigation';
import { migrateDbIfNeeded } from './src/database/database';
import { useAppStore } from './src/store/useAppStore';

export default function App() {
  const { themeMode, currentTheme } = useAppStore();

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
            <NavigationContainer theme={navigationTheme}>
              <AppNavigation />
            </NavigationContainer>
          </SQLiteProvider>
      </SafeAreaProvider>
  );
}
