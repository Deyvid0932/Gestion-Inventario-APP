import React, { Suspense } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { AppNavigation } from './src/navigation/AppNavigation';
import { migrateDbIfNeeded } from './src/database/database';

export default function App() {
  return (
      <SafeAreaProvider>
          <SQLiteProvider databaseName="inventario.db" onInit={migrateDbIfNeeded} useSuspense>
            <NavigationContainer>
              <AppNavigation />
            </NavigationContainer>
          </SQLiteProvider>
      </SafeAreaProvider>
  );
}
