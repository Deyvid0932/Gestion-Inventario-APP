import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SkeletonLoader } from '../components/SkeletonLoader';
import InventarioCard from '../components/InventarioCard';
import { DashboardSummaryCard } from '../components/DashboardSummaryCard';
import { InventarioService } from '../services/InventarioService';
import { SynchronizationEngine } from '../sync/SynchronizationEngine';
import { AuthManager } from '../services/AuthManager';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const InventariosScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const setPrendas = useAppStore(state => state.setPrendas);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);

  // Suscripción reactiva pura a Zustand
  const inventarios = useAppStore(state => state.inventarios);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lastNavTime = useRef(0);

  const loadAppState = useCallback(async (showSkeleton = false) => {
    if (!db) return;
    if (showSkeleton) setLoading(true);
    try {
      await AuthManager.refreshAllAppState(db);
    } catch (e) {
      console.error('Error al cargar inventarios:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    loadAppState(inventarios.length === 0);
  }, [loadAppState]);

  useFocusEffect(
    useCallback(() => {
      if (db) loadAppState(false);
    }, [db, loadAppState])
  );

  const handleRefreshOrSync = async () => {
    if (!db) return;
    setRefreshing(true);
    try {
      if (user?.id) {
        await SynchronizationEngine.fullSync(db, user.id);
      }
      await AuthManager.refreshAllAppState(db);
    } catch (e) {
      console.error('Error en sincronización manual:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleNavigateToCajas = (id: string, nombre: string) => {
    const now = Date.now();
    if (now - lastNavTime.current < 300) return;
    lastNavTime.current = now;

    setPrendas([]);
    navigation.navigate('Cajas', {
      inventarioId: id,
      nombreInventario: nombre,
    });
  };

  const deleteInventario = async (id: string) => {
    try {
      const result = await InventarioService.hardDelete(db, id, user?.id);
      if (!result.success) {
        Alert.alert('Error al eliminar', result.error || 'No se pudo eliminar el lote.');
        return;
      }
      await AuthManager.refreshAllAppState(db);
    } catch (error) {
      console.error('Error deleting inventario:', error);
      Alert.alert('Error', 'Ocurrió un error al eliminar el lote.');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <Navbar title="Lotes de Trabajo" />

        {loading ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
            <Reanimated.FlatList
              key={themeMode}
              extraData={themeMode}
              data={inventarios}
              itemLayoutAnimation={LinearTransition.springify()}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefreshOrSync}
                  tintColor={currentTheme.primary}
                  colors={[currentTheme.primary]}
                />
              }
              renderItem={({ item }) => (
                <Reanimated.View exiting={FadeOut.duration(300)}>
                  <InventarioCard
                    item={item}
                    theme={currentTheme}
                    onPress={() => handleNavigateToCajas(item.id, item.nombre)}
                    onEdit={() => navigateSafe('Form', { mode: 'BASIC', entityType: 'inventario', initialData: { id: item.id, nombre: item.nombre, descripcion: item.descripcion || '' } })}
                    onDelete={() => deleteInventario(item.id)}
                  />
                </Reanimated.View>
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              alwaysBounceVertical={true}
              overScrollMode="always"
              ListFooterComponent={<DashboardSummaryCard />}
              ListEmptyComponent={
                <Reanimated.View
                  style={styles.emptyContainer}
                  entering={FadeIn.duration(400)}
                >
                  <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.card }]}>
                      <Ionicons name="cube-outline" size={80} color={currentTheme.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>¡Lotes Vacíos!</Text>
                    <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                      Parece que aún no has creado inventarios. Toca el botón + para comenzar.
                    </Text>
                  </View>
                </Reanimated.View>
              }
            />
          </View>
        )}

        <FloatingButton style={{ bottom: 30 }} onPress={() => navigateSafe('Form', { mode: 'BASIC', entityType: 'inventario' })} />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    padding: 18,
    paddingBottom: 90,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },
  emptyIconCircle: {
    width: 86.5,
    height: 86.5,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});