import { useState, useCallback, useRef, useMemo } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, BoxWithStats } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { BoxService } from '../../services';
import { AuthManager } from '../../services';
import { useRoles } from '../common/useRoles';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const sameBoxes = (previous: BoxWithStats[], next: BoxWithStats[]): boolean =>
  previous.length === next.length && previous.every((box, index) => {
    const updated = next[index];
    const keys = Object.keys(box) as (keyof BoxWithStats)[];
    return keys.length === Object.keys(updated).length &&
      keys.every(key => box[key] === updated[key]);
  });

export const useBoxesScreen = (inventoryId: string, inventoryName: string) => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const dataRevision = useAppStore(state => state.dataRevision);

  const { hasRole } = useRoles();
  const canEdit = hasRole(['Admin', 'Editor']);

  const [boxes, setBoxes] = useState<BoxWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isUpdatingOrder] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const lastNavTime = useRef(0);
  const fetchGeneration = useRef(0);

  const filteredBoxes = useMemo(() => {
    if (!search.trim()) return boxes;
    const q = search.toLowerCase().trim();
    return boxes.filter(b => {
      const name = b.name || (b as any).nombre || '';
      return name.toLowerCase().includes(q);
    });
  }, [boxes, search]);

  const fetchBoxes = useCallback(async () => {
    if (!db) return;
    const generation = ++fetchGeneration.current;
    try {
      const result = await db.getAllAsync<BoxWithStats>(
        `SELECT b.*, (SELECT COUNT(*) FROM garments WHERE box_id = b.id AND deleted_at IS NULL) as itemCount 
         FROM boxes b 
         WHERE b.inventory_id = ? AND b.deleted_at IS NULL
         ORDER BY COALESCE(b.order_index, 0) ASC, b.created_at `,
        [inventoryId]
      );

      if (generation === fetchGeneration.current) {
        setBoxes(previous => sameBoxes(previous, result) ? previous : result);
      }
    } catch (error) {
      console.error("Error fetching boxes:", error);
    } finally {
      if (generation === fetchGeneration.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [db, inventoryId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBoxes();
  }, [fetchBoxes]);

  useFocusEffect(
    useCallback(() => {
      if (db) void fetchBoxes();
    }, [db, dataRevision, fetchBoxes])
  );

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleNavigateToGarments = useCallback((boxId: string, boxName: string) => {
    const now = Date.now();
    if (now - lastNavTime.current < 300) return;
    navigation.navigate('BoxContents', {
      boxId,
      boxName,
      inventoryName,
    });
  }, [navigation, inventoryName]);


  const handleDragEnd = useCallback(({ data }: { data: BoxWithStats[] }) => {
    setIsDragging(false);

    requestAnimationFrame(() => {
      const updatedData = data.map((item, index) => ({
        ...item,
        order_index: index,
        orden: index,
      }));
      setBoxes(updatedData);

      const allOrderings = updatedData.map((item, index) => ({
        id: item.id,
        order_index: index,
        orden: index,
      }));
      BoxService.updateBoxesOrder(db, allOrderings, user?.id).catch(error => {
        console.error("Error updating order:", error);
        fetchBoxes();
      });
    });
  }, [db, fetchBoxes, user?.id]);

  const deleteBox = useCallback(async (id: string, name: string) => {
    Alert.alert(
      "Eliminar Caja",
      `¿Eliminar "${name}"? Esta acción borrará todas las prendas dentro de ella.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await BoxService.softDelete(db, id, user?.id);
              if (!res.success) {
                Alert.alert('Error al eliminar', res.error || 'No se pudo mover la caja a la papelera.');
                return;
              }
              fetchBoxes();
              await AuthManager.refreshAllAppState(db);
            } catch (error) {
              console.error('Error deleting box:', error);
              Alert.alert('Error', 'Ocurrió un error al eliminar la caja.');
            }
          }
        }
      ]
    );
  }, [db, fetchBoxes, user?.id]);

  const handleCardPress = useCallback((id: string, name: string) => {
    handleNavigateToGarments(id, name);
  }, [handleNavigateToGarments]);

  const handleCardEdit = useCallback((id: string, name: string) => {
    navigateSafe('Form', { mode: 'NAME_ONLY', entityType: 'box', initialData: { id, name, nombre: name } });
  }, [navigateSafe]);

  const handleCreateBox = useCallback(() => {
    navigateSafe('Form', {
      mode: 'NAME_ONLY',
      entityType: 'box',
      parentId: inventoryId
    });
  }, [navigateSafe, inventoryId]);

  const showSkeleton = !db || (loading && boxes.length === 0);

  return {
    state: {
      boxes,
      loading,
      refreshing,
      isUpdatingOrder,
      isDragging,
      search,
    },
    computed: {
      currentTheme,
      themeMode,
      canEdit,
      filteredBoxes,
      showSkeleton,
    },
    handlers: {
      setSearch,
      setIsDragging,
      onRefresh,
      handleDragEnd,
      deleteBox,
      handleCardPress,
      handleCardEdit,
      handleCreateBox,
    },
  };
};

export default useBoxesScreen;
