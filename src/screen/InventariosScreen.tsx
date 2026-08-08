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
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { SkeletonLoader } from '../components/SkeletonLoader';
import InventarioCard from '../components/InventarioCard';
import { EmptyState } from '../components/EmptyState';
import { InventarioService } from '../services/InventarioService';
import { SynchronizationEngine } from '../sync/SynchronizationEngine';
import { AuthManager } from '../services/AuthManager';
import { useRoles } from '../hooks/useRoles';
import { InventarioStats } from '../types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const InventariosScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const setPrendas = useAppStore(state => state.setPrendas);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);

  const { hasRole } = useRoles();
  const canEdit = hasRole(['Admin', 'Editor']);

  // Suscripción reactiva pura a Zustand
  const inventarios = useAppStore(state => state.inventarios);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleNavigateToCajas = useCallback((id: string, nombre: string) => {
    const now = Date.now();
    if (now - lastNavTime.current < 300) return;
    lastNavTime.current = now;

    setPrendas([]);
    navigation.navigate('Cajas', {
      inventarioId: id,
      nombreInventario: nombre,
    });
  }, [navigation, setPrendas]);

  const deleteInventario = useCallback(async (id: string) => {
    try {
      let result = await InventarioService.softDelete(db, id, user?.id);
      if (!result.success) {
        console.warn('softDelete falló, ejecutando hardDelete de respaldo:', result.error);
        result = await InventarioService.hardDelete(db, id, user?.id);
      }
      await AuthManager.refreshAllAppState(db);
    } catch (error) {
      console.error('Excepción en deleteInventario, intentando hardDelete de respaldo:', error);
      try {
        await InventarioService.hardDelete(db, id, user?.id);
        await AuthManager.refreshAllAppState(db);
      } catch (innerErr) {
        console.error('Fallo definitivo en deleteInventario:', innerErr);
        Alert.alert('Error', 'No se pudo eliminar el lote.');
      }
    }
  }, [db, user?.id]);

  const handleDragEnd = useCallback(({ data }: { data: InventarioStats[] }) => {
    setIsDragging(false);

    // Defer data update to next frame so DraggableFlatList can finish its
    // internal drag-release animation before we trigger a list re-render.
    requestAnimationFrame(() => {
      useAppStore.getState().setInventarios(data);
      const newOrderings = data.map((item, index) => ({
        id: item.id,
        orden: index
      }));
      InventarioService.updateInventariosOrder(db, newOrderings, user?.id).catch(error => {
        console.error("Error al actualizar el orden de inventarios:", error);
        loadAppState(false);
      });
    });
  }, [db, loadAppState, user?.id]);

  const handleCardPress = useCallback((id: string, nombre: string) => {
    handleNavigateToCajas(id, nombre);
  }, [handleNavigateToCajas]);

  const handleCardEdit = useCallback((id: string, nombre: string, descripcion: string) => {
    navigateSafe('Form', { mode: 'BASIC', entityType: 'inventario', initialData: { id, nombre, descripcion } });
  }, [navigateSafe]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<InventarioStats>) => (
    <InventarioCard
      item={item}
      theme={currentTheme}
      canEdit={canEdit}
      drag={drag}
      isActive={isActive}
      onPress={() => handleCardPress(item.id, item.nombre)}
      onEdit={() => handleCardEdit(item.id, item.nombre, item.descripcion || '')}
      onDelete={() => deleteInventario(item.id)}
    />
  ), [currentTheme, canEdit, handleCardPress, handleCardEdit, deleteInventario]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <Navbar title="Lotes de Trabajo" />

        {loading ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
            <DraggableFlatList
              key={`inventarios-${themeMode}`}
              extraData={themeMode}
              data={inventarios}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              onDragBegin={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              containerStyle={{ flex: 1, overflow: 'visible' }}
              animationConfig={{ damping: 20, stiffness: 200, mass: 0.8 }}
              autoscrollSpeed={200}
              autoscrollThreshold={80}
              dragHitSlop={{ top: -4, bottom: -4, left: 0, right: 0 }}
              contentContainerStyle={[
                styles.listContent,
                inventarios.length === 0 && { flexGrow: 1, paddingTop: 40 }
              ]}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  enabled={!isDragging && !refreshing}
                  refreshing={refreshing}
                  onRefresh={handleRefreshOrSync}
                  tintColor={currentTheme.primary}
                  colors={[currentTheme.primary]}
                />
              }
              removeClippedSubviews={false}
              alwaysBounceVertical={true}
              overScrollMode="always"
              ListEmptyComponent={
                <EmptyState
                  iconName="cube-outline"
                  title="¡Lotes Vacíos!"
                  description="Parece que aún no has creado inventarios. Toca el botón + para comenzar."
                  currentTheme={currentTheme}
                  delay={400}
                />
              }
            />
          </View>
        )}

        <FloatingButton 
          style={{ bottom: 30 }} 
          onPress={() => {
            if (!canEdit) {
              Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para crear inventarios.');
              return;
            }
            navigateSafe('Form', { mode: 'BASIC', entityType: 'inventario' });
          }} 
        />
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
  },
});