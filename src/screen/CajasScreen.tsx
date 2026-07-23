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
import CajaCard from '../components/CajaCard';


type CajasRouteProp = RouteProp<RootStackParamList, 'Cajas'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const CajasScreen = () => {
  const route = useRoute<CajasRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { inventarioId, nombreInventario } = route.params;
  const db = useSQLiteContext();
  const { currentTheme, themeMode } = useAppStore();

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
      `¿Eliminar "${nombre}"? Esta acción borrará prendas.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await db.runAsync('DELETE FROM cajas WHERE id = ?', [id]);
              fetchCajas(false);
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  }, [db, fetchCajas]);

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
            contentContainerStyle={styles.listContent}
            activationDistance={10}
            containerStyle={{ flex: 1 }}
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
                <Ionicons name="cube-outline" size={100} color={currentTheme.border} />
                <Text style={[styles.emptyTitle, { color: currentTheme.textSecondary }]}>No hay cajas</Text>
                <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                  Toca el botón + para comenzar.
                </Text>
              </View>
            }
          />
        )}
      </View>

      <FloatingButton
        onPress={() => navigateSafe('Form', { mode: 'NAME_ONLY', entityType: 'caja', parentId: inventarioId })}
        style={styles.floatingButton}
      />

    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 100,
    flexGrow: 1,
  },
  floatingButton: {
    bottom: 80,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
});

export default CajasScreen;