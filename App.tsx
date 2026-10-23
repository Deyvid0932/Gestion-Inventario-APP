import './src/utils/bootstrap';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import { migrateDbIfNeeded } from './src/database/database';
import { AppContent } from './src/components/init/AppContent';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#090A0F' }}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: '#090A0F' }}>
        <SQLiteProvider databaseName="inventario.db" onInit={migrateDbIfNeeded}>
          <AppContent />
        </SQLiteProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}