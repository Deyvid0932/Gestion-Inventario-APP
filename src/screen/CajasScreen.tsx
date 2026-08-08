import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Text,
  RefreshControl,
} from 'react-native';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, CajaWithStats } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { SkeletonLoader } from '../components/SkeletonLoader';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CajaService } from '../services/CajaService';
import { AuthManager } from '../services/AuthManager';
import { EmptyState } from '../components/EmptyState';
import CajaCard from '../components/CajaCard';
import { useRoles } from '../hooks/useRoles';

type CajasRouteProp = RouteProp<RootStackParamList, 'Cajas'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

export const CajasScreen = () => {
  const route = useRoute<CajasRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { inventarioId, nombreInventario } = route.params;
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);

  const { hasRole } = useRoles();
  const canEdit = hasRole(['Admin', 'Editor']);

  const [cajas, setCajas] = useState<CajaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastNavTime = useRef(0);

  const fetchCajas = useCallback(async (showLoading = true) => {
    if (!db) return;
    if (showLoading) setLoading(true);
    try {
      const result = await db.getAllAsync<CajaWithStats>(
        `SELECT c.*, (SELECT COUNT(*) FROM prendas WHERE cajaId = c.id AND deleted_at IS NULL) as itemCount 
         FROM cajas c 
         WHERE c.inventarioId = ? AND c.deleted_at IS NULL
         ORDER BY c.orden ASC, c.fechaCreacion DESC`,
        [inventarioId]
      );

      setCajas(result);
    } catch (error) {
      console.error("Error fetching cajas:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, inventarioId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCajas(false);
  }, [fetchCajas]);

  useFocusEffect(
    useCallback(() => {
      if (db) {
        fetchCajas(cajas.length === 0);
        AuthManager.refreshAllAppState(db).catch(e => console.error('[CajasScreen] refreshAllAppState error:', e));
      }
    }, [db, fetchCajas, cajas.length])
  );

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleNavigateToPrendas = useCallback((cajaId: string, nombreCaja: string) => {
    const now = Date.now();
    if (now - lastNavTime.current < 300) return;
    navigation.navigate('ExcelGrid', {
      cajaId,
      nombreCaja
    });
  }, [navigation]);

  const handleDragEnd = useCallback(({ data }: { data: CajaWithStats[] }) => {
    setIsDragging(false);

    // Defer data update to next frame so DraggableFlatList can finish its
    // internal drag-release animation before we trigger a list re-render.
    requestAnimationFrame(() => {
      setCajas(data);
      const newOrderings = data.map((item, index) => ({
        id: item.id,
        orden: index
      }));
      CajaService.updateCajasOrder(db, newOrderings, user?.id).catch(error => {
        console.error("Error updating order:", error);
        fetchCajas(false);
      });
    });
  }, [db, fetchCajas, user?.id]);

  const deleteCaja = useCallback(async (id: string, nombre: string) => {
    Alert.alert(
      "Eliminar Caja",
      `¿Eliminar "${nombre}"? Esta acción borrará todas las prendas dentro de ella.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await CajaService.softDelete(db, id, user?.id);
              if (!res.success) {
                Alert.alert('Error al eliminar', res.error || 'No se pudo mover la caja a la papelera.');
                return;
              }
              fetchCajas(false);
              await AuthManager.refreshAllAppState(db);
            } catch (error) {
              console.error('Error al borrar caja:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar la caja.');
            }
          }
        }
      ]
    );
  }, [db, fetchCajas, user?.id]);

  const handleCardPress = useCallback((id: string, nombre: string) => {
    handleNavigateToPrendas(id, nombre);
  }, [handleNavigateToPrendas]);

  const handleCardEdit = useCallback((id: string, nombre: string) => {
    navigateSafe('Form', { mode: 'NAME_ONLY', entityType: 'caja', initialData: { id, nombre } });
  }, [navigateSafe]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<CajaWithStats>) => (
    <CajaCard
      item={item}
      theme={currentTheme}
      canEdit={canEdit}
      onPress={handleCardPress}
      onEdit={handleCardEdit}
      onDelete={deleteCaja}
      drag={drag}
      isActive={isActive}
    />
  ), [currentTheme, handleCardPress, handleCardEdit, deleteCaja, canEdit]);

  const showSkeleton = !db || (loading && cajas.length === 0);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
        <Navbar title={nombreInventario} showBackButton isLoading={isUpdatingOrder} />

        <View style={{ flex: 1 }}>
          {showSkeleton ? (
            <SkeletonLoader theme={currentTheme} />
          ) : (
            <DraggableFlatList
              key={`cajas-${themeMode}`}
              extraData={themeMode}
              data={cajas}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              onDragBegin={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              contentContainerStyle={[
                styles.listContent,
                cajas.length === 0 && { flexGrow: 1, paddingTop: 40 }
              ]}
              containerStyle={{ flex: 1, overflow: 'visible' }}
              animationConfig={{ damping: 20, stiffness: 200, mass: 0.8 }}
              autoscrollSpeed={200}
              autoscrollThreshold={80}
              dragHitSlop={{ top: -4, bottom: -4, left: 0, right: 0 }}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  enabled={!isDragging && !refreshing}
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={currentTheme.primary}
                  colors={[currentTheme.primary]}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  iconName="cube-outline"
                  title="No hay cajas"
                  description="Toca el botón + para agregar una caja a este lote."
                  currentTheme={currentTheme}
                  delay={100}
                />
              }
            />
          )}
        </View>

        <FloatingButton
          onPress={() => {
            if (!canEdit) {
              Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para crear cajas.');
              return;
            }
            navigateSafe('Form', { mode: 'NAME_ONLY', entityType: 'caja', parentId: inventarioId });
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
});

export default CajasScreen;