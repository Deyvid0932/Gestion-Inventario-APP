import { useState, useCallback, useRef, useMemo } from 'react';
import { Alert, InteractionManager } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, InventoryStats } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { InventoryService } from '../../services';
import { SynchronizationEngine } from '../../sync/SynchronizationEngine';
import { AuthManager } from '../../services';
import { useRoles } from '../common/useRoles';
import { matchesNormalizedSearch } from '../../utils/searchUtils';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const useInventoriesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const setGarments = useAppStore(state => state.setGarments);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const dataRevision = useAppStore(state => state.dataRevision);

  const { hasRole } = useRoles();
  const canEdit = hasRole(['Admin', 'Editor']);

  const inventories = useAppStore(state => state.inventories);

  const [loading, setLoading] = useState(() => useAppStore.getState().inventories.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const lastNavTime = useRef(0);
  const lastLoadedRevisionRef = useRef(-1);

  const filteredInventories = useMemo(() => {
    if (!search.trim()) return inventories;
    return inventories.filter(i =>
      matchesNormalizedSearch(
        [i.name, (i as any).nombre, i.description, (i as any).descripcion],
        search
      )
    );
  }, [inventories, search]);

  const loadAppState = useCallback(async (showSkeleton = false) => {
    if (!db) return;
    if (showSkeleton) setLoading(true);
    try {
      await AuthManager.refreshAllAppState(db);
    } catch (e) {
      console.error('Error loading inventories:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      if (lastLoadedRevisionRef.current === dataRevision && inventories.length > 0) return;
      lastLoadedRevisionRef.current = dataRevision;
      const task = InteractionManager.runAfterInteractions(() => {
        loadAppState(false);
      });
      return () => task.cancel();
    }, [db, dataRevision, inventories.length, loadAppState])
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
      console.error('Error in manual sync:', e);
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

  const handleNavigateToBoxes = useCallback((id: string, name: string, boxCount?: number) => {
    const now = Date.now();
    if (now - lastNavTime.current < 300) return;
    lastNavTime.current = now;

    navigation.navigate('Boxes', {
      inventoryId: id,
      inventoryName: name,
      boxCount,
    });
  }, [navigation]);

  const deleteInventory = useCallback(async (id: string) => {
    try {
      const result = await InventoryService.softDelete(db, id, user?.id);
      if (!result.success) {
        Alert.alert('Error al eliminar', result.error || 'No se pudo mover el inventario a la papelera. Inténtalo de nuevo.');
        return;
      }
      await AuthManager.refreshAllAppState(db);
    } catch (error) {
      console.error('Exception in deleteInventory:', error);
      Alert.alert('Error', 'No se pudo eliminar el inventario. Inténtalo de nuevo.');
    }
  }, [db, user?.id]);


  const handleDragEnd = useCallback(({ data }: { data: InventoryStats[] }) => {
    setIsDragging(false);

    requestAnimationFrame(() => {
      const updatedData = data.map((item, index) => ({
        ...item,
        order_index: index,
        orden: index,
      }));
      useAppStore.getState().setInventories(updatedData);

      const allOrderings = updatedData.map((item, index) => ({
        id: item.id,
        order_index: index,
        orden: index,
      }));
      InventoryService.updateInventoriesOrder(db, allOrderings, user?.id).catch(error => {
        console.error("Error updating inventories order:", error);
        loadAppState(false);
      });
    });
  }, [db, loadAppState, user?.id]);

  const handleCardPress = useCallback((id: string, name: string, boxCount?: number) => {
    handleNavigateToBoxes(id, name, boxCount);
  }, [handleNavigateToBoxes]);

  const handleCardEdit = useCallback((id: string, name: string, description: string) => {
    navigateSafe('Form', { mode: 'BASIC', entityType: 'inventory', initialData: { id, name, description } });
  }, [navigateSafe]);

  const handleCreateInventory = useCallback(() => {
    navigateSafe('Form', { mode: 'BASIC', entityType: 'inventory' });
  }, [navigateSafe]);

  return {
    state: {
      loading,
      refreshing,
      isDragging,
      search,
    },
    computed: {
      currentTheme,
      themeMode,
      canEdit,
      filteredInventories,
    },
    handlers: {
      setSearch,
      setIsDragging,
      handleRefreshOrSync,
      handleDragEnd,
      handleCardPress,
      handleCardEdit,
      deleteInventory,
      handleCreateInventory,
    },
  };
};

export default useInventoriesScreen;
