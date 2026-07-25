import React, { useState, useCallback } from 'react';
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
import CajaCard from '../components/CajaCard';

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

  const [cajas, setCajas] = useState<CajaWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
  const lastNavTime = React.useRef(0);

  const fetchCajas = useCallback(async (showLoading = true) => {
    if (!db) return;
    if (showLoading) setLoading(true);
    try {
      const result = await db.getAllAsync<CajaWithStats>(
        `SELECT c.*, (SELECT COUNT(*) FROM prendas WHERE cajaId = c.id) as itemCount 
         FROM cajas c 
         WHERE c.inventarioId = ? 
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
        fetchCajas(true);
      }
    }, [fetchCajas])
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
    lastNavTime.current = now;

    useAppStore.getState().setPrendas([]);
    navigation.navigate('ExcelGrid', {
      cajaId,
      nombreCaja
    });
  }, [navigation]);

  const handleDragEnd = useCallback(async ({ data }: { data: CajaWithStats[] }) => {
    setCajas(data);
    setIsUpdatingOrder(true);

    try {
      const newOrderings = data.map((item, index) => ({
        id: item.id,
        orden: index
      }));
      await CajaService.updateCajasOrder(db, newOrderings);
    } catch (error) {
      console.error("Error updating order:", error);
      fetchCajas(false);
    } finally {
      setIsUpdatingOrder(false);
    }
  }, [db, fetchCajas]);

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
              const res = await CajaService.hardDelete(db, id, user?.id);
              if (!res.success) {
                Alert.alert('Error al eliminar', res.error || 'No se pudo eliminar la caja.');
                return;
              }
              fetchCajas(false);
              AuthManager.refreshAllAppState(db);
            } catch (error) {
              console.error('Error al borrar caja:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar la caja.');
            }
          }
        }
      ]
    );
  }, [db, fetchCajas, user?.id]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<CajaWithStats>) => (
    <View>
      <CajaCard
        item={item}
        theme={currentTheme}
        onPress={() => handleNavigateToPrendas(item.id, item.nombre)}
        onEdit={() => navigateSafe('Form', { mode: 'NAME_ONLY', entityType: 'caja', initialData: { id: item.id, nombre: item.nombre } })}
        onDelete={() => deleteCaja(item.id, item.nombre)}
        drag={drag}
        isActive={isActive}
      />
    </View>
  ), [currentTheme, navigateSafe, deleteCaja, handleNavigateToPrendas]);

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
              onDragEnd={handleDragEnd}
              contentContainerStyle={[
                styles.listContent,
                cajas.length === 0 && { flexGrow: 1, justifyContent: 'center' }
              ]}
              activationDistance={10}
              containerStyle={{ flex: 1 }}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={currentTheme.primary}
                  colors={[currentTheme.primary]}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="cube-outline" size={80} color={currentTheme.primary} />
                  <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>No hay cajas</Text>
                  <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                    Toca el botón + para agregar una caja a este lote.
                  </Text>
                </View>
              }
            />
          )}
        </View>

        <FloatingButton
          onPress={() => navigateSafe('Form', { mode: 'NAME_ONLY', entityType: 'caja', parentId: inventarioId })}
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default CajasScreen;