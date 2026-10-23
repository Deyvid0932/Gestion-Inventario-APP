import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Alert, Animated } from 'react-native';
import { useRoute, useFocusEffect, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { FlatList } from 'react-native-gesture-handler';
import { RootStackParamList, Garment } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useGarment } from '../common/useGarment';
import { GarmentService } from '../../services';
import { useOCRManager } from '../common/useOCRManager';
import { AuthManager } from '../../services';
import { useRoles } from '../common/useRoles';
import { SyncScheduler } from '../../sync/SyncScheduler';

type BoxContentsRouteProp = RouteProp<RootStackParamList, 'BoxContents'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

export const useBoxContentsScreen = (boxId: string, _boxName: string) => {
  const route = useRoute<BoxContentsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { hasRole } = useRoles();
  const db = useSQLiteContext();
  const user = useAppStore(state => state.user);
  const dataRevision = useAppStore(state => state.dataRevision);
  const { processImage, loading: ocrLoading, scanSource } = useOCRManager();

  const [search, setSearch] = useState('');
  const globalGarments = useAppStore(state => state.garments);
  const initialBoxGarments = useMemo(() => {
    return globalGarments.filter(g => g.box_id === boxId);
  }, [globalGarments, boxId]);

  const [localGarments, setLocalGarments] = useState<Garment[]>(initialBoxGarments);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ALARM' | 'PHOTOS' | 'INACTIVE'>('ALL');

  const hasPhoto = (g: Garment) => {
    const photo1 = g.photo_uri || (g as any).fotoUri;
    const photo2 = g.photo_uri_2 || (g as any).fotoUri2;
    const key1 = (g as any).r2Key || (g as any).primary_storage_key || (g as any).storage_key;
    const key2 = (g as any).r2Key2 || (g as any).secondary_storage_key;
    return !!(
      (photo1 && photo1.trim() !== '') ||
      (photo2 && photo2.trim() !== '') ||
      (key1 && key1.trim() !== '') ||
      (key2 && key2.trim() !== '')
    );
  };

  const filteredGarments = useMemo(() => {
    return localGarments.filter((item: Garment) => {
      const alarm = item.alarm_datetime;
      const status = item.status ?? 1;
      if (activeFilter === 'ALARM') return !!alarm;
      if (activeFilter === 'PHOTOS') return hasPhoto(item);
      if (activeFilter === 'INACTIVE') return status === 0;
      return true;
    });
  }, [localGarments, activeFilter]);

  const filterCounts = useMemo(() => {
    return {
      all: localGarments.length,
      alarm: localGarments.filter(g => !!g.alarm_datetime).length,
      photos: localGarments.filter(hasPhoto).length,
      inactive: localGarments.filter(g => g.status === 0).length,
    };
  }, [localGarments]);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(initialBoxGarments.length === 0);
  const fadeAnim = useRef(new Animated.Value(initialBoxGarments.length > 0 ? 1 : 0)).current;
  const lastNavTime = useRef(0);
  const searchCounter = useRef(0);
  const flatListRef = useRef<FlatList>(null);

  const { toggleStatus: toggleGarmentStatus } = useGarment();

  const setGarmentsGlobal = useAppStore(state => state.setGarments);
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const selectedGarments = useAppStore(state => state.selectedGarments);
  const toggleSelectGarment = useAppStore(state => state.toggleSelectGarment);
  const clearSelectedGarments = useAppStore(state => state.clearSelectedGarments);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [garmentToMove, setGarmentToMove] = useState<string | null>(null);
  const [successModalConfig, setSuccessModalConfig] = useState<{
    isVisible: boolean;
    title: string;
    message: string;
  }>({
    isVisible: false,
    title: '',
    message: '',
  });

  const fetchGarments = useCallback(async (showLoading = false) => {
    if (!db) return;
    const queryId = ++searchCounter.current;

    if (showLoading && localGarments.length === 0) {
      setLoading(true);
      fadeAnim.setValue(0);
    }

    try {
      const result = await GarmentService.getAllGarmentsByBox(db, boxId, search);

      if (queryId === searchCounter.current) {
        setLocalGarments(result);

        if (search === '') {
          setGarmentsGlobal(result);
        }

        if (showLoading || search === '') {
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        } else {
          fadeAnim.setValue(1);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      if (queryId === searchCounter.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [db, boxId, setGarmentsGlobal, fadeAnim, search, localGarments.length]);

  useEffect(() => {
    // No reemplazar los resultados filtrados por la lista global sin filtrar.
    if (search.trim() !== '') return;

    const cached = globalGarments.filter(g => g.box_id === boxId);
    if (cached.length > 0) {
      setLocalGarments(cached);
      setLoading(false);
      fadeAnim.setValue(1);
    }
  }, [boxId, globalGarments, fadeAnim, search]);

  useEffect(() => {
    if (db && boxId) fetchGarments(false);
  }, [db, boxId, dataRevision, fetchGarments]);

  useFocusEffect(
    useCallback(() => {
      if (db && boxId) {
        fetchGarments(false);
      }
    }, [db, boxId, fetchGarments])
  );

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (db) {
      const timer = setTimeout(() => {
        fetchGarments(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [search, db, fetchGarments]);

  useEffect(() => {
    const targetId = (route.params as any)?.targetGarmentId;
    if (targetId && localGarments.length > 0) {
      setHighlightedId(targetId);
      const index = localGarments.findIndex(g => g.id === targetId);
      if (index !== -1) {
        const timer = setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
          } catch (_) {}
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [localGarments, route.params]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGarments(false);
  }, [fetchGarments]);

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleItemPress = useCallback((item: Garment) => {
    if (Object.keys(selectedGarments).some(k => selectedGarments[k])) {
      toggleSelectGarment(item.id);
      return;
    }
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual solo permite lectura. No tienes permisos para modificar registros.');
      return;
    }
    navigateSafe('Form', {
      mode: 'ADVANCED',
      entityType: 'garment',
      parentId: boxId,
      initialData: item
    });
  }, [selectedGarments, boxId, navigateSafe, toggleSelectGarment, hasRole]);

  const handleBulkDelete = async () => {
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual solo permite lectura. No tienes permisos para eliminar registros.');
      return;
    }

    const selectedIds = Object.keys(selectedGarments).filter(k => selectedGarments[k]);
    const selectedBoxLabels = new Map<string, number>();
    try {
      for (let index = 0; index < selectedIds.length; index += 500) {
        const chunk = selectedIds.slice(index, index + 500);
        const placeholders = chunk.map(() => '?').join(',');
        const boxes = await db.getAllAsync<{ inventory_name: string; box_name: string; garment_count: number }>(
          `SELECT i.name AS inventory_name, b.name AS box_name, COUNT(g.id) AS garment_count
           FROM garments g
           JOIN boxes b ON b.id = g.box_id
           JOIN inventories i ON i.id = b.inventory_id
           WHERE g.id IN (${placeholders}) AND g.deleted_at IS NULL
           GROUP BY i.id, b.id, i.name, b.name`,
          chunk
        );
        boxes.forEach(box => {
          const label = `${box.inventory_name} / ${box.box_name}`;
          selectedBoxLabels.set(label, (selectedBoxLabels.get(label) || 0) + box.garment_count);
        });
      }
    } catch (error) {
      console.warn('No se pudo obtener el detalle de cajas de la selección:', error);
    }
    const boxSummary = Array.from(selectedBoxLabels.entries())
      .slice(0, 5)
      .map(([label, count]) => `${label} (${count})`)
      .join(', ');
    const additionalBoxes = selectedBoxLabels.size > 5 ? ` y ${selectedBoxLabels.size - 5} caja(s) más` : '';
    const confirmationMessage = boxSummary
      ? `¿Eliminar ${selectedIds.length} prendas de: ${boxSummary}${additionalBoxes}?`
      : `¿Eliminar las ${selectedIds.length} prendas seleccionadas, que pueden estar en varias cajas?`;
    Alert.alert(
      "Eliminar Selección",
      confirmationMessage,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            const failedIds: string[] = [];
            try {
              for (const id of selectedIds) {
                try {
                  const result = await GarmentService.softDelete(db, id, user?.id);
                  if (result.success) {
                    toggleSelectGarment(id);
                  } else {
                    failedIds.push(id);
                  }
                } catch (error) {
                  console.error('Error eliminando prenda seleccionada:', id, error);
                  failedIds.push(id);
                }
              }
              await AuthManager.refreshAllAppState(db);
              await fetchGarments(false);
              if (failedIds.length > 0) {
                Alert.alert('Eliminación incompleta', `No se pudieron eliminar ${failedIds.length} prendas. Siguen seleccionadas para que puedas intentarlo de nuevo.`);
              }
            } catch (error) {
              console.error('Error al actualizar la lista después de eliminar prendas:', error);
              Alert.alert('Error', 'Las prendas se marcaron para eliminar, pero no se pudo actualizar la lista. Recarga la pantalla.');
            }
          }
        }
      ]
    );
  };

  const saveToDatabase = async (items: any[]) => {
    try {
      const result = await GarmentService.bulkAddGarments(db, items);
      if (result.success) {
        fetchGarments(false);
        if (user?.id) {
          SyncScheduler.schedulePush(db, user.id);
        }
      }
      else Alert.alert('Error', result.error || 'No se pudo guardar.');
    } catch (e) {
      Alert.alert('Error', 'Error de base de datos.');
    }
  };

  const handleCameraScan = async () => {
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para escanear prendas.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Error', 'Permisos denegados');

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });

    if (!result.canceled && result.assets[0].uri) {
      const { garments: listaExtraida, source } = await processImage(result.assets[0].uri, boxId);
      if (listaExtraida.length === 0) {
        return Alert.alert('Escáner de Prendas', 'No se detectaron prendas legibles en la imagen.');
      }

      const isAI = source === 'gemini';
      const alertTitle = isAI ? '✨ Extraído por IA' : '📋 Extraído por Escáner';

      const count = listaExtraida.length;
      const countHeader = count === 1
        ? 'Se detectó 1 prenda lista para registrar:'
        : `Se detectaron ${count} prendas listas para registrar:`;

      const formattedList = listaExtraida
        .map((p, index) => {
          const num = `${index + 1}.`;
          const opText = p.op ? `OP: ${p.op}` : 'OP: S/N';
          return `${num} ${p.style}\n   ${opText}  •  Color: ${p.color}`;
        })
        .join('\n\n');

      const question = count === 1
        ? '¿Deseas agregarla a esta caja?'
        : `¿Deseas agregar estas ${count} prendas a la caja?`;

      Alert.alert(
        alertTitle,
        `${countHeader}\n\n${formattedList}\n\n${question}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: count === 1 ? 'Agregar Prenda' : 'Agregar Prendas',
            onPress: () => saveToDatabase(listaExtraida),
          }
        ]
      );
    }
  };

  const deleteGarment = useCallback(async (id: string) => {
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para eliminar registros.');
      return;
    }

    Alert.alert("Eliminar", "¿Eliminar registro de prenda?", [
      { text: "Cancelar" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            const res = await GarmentService.softDelete(db, id, user?.id);
            if (!res.success) {
              Alert.alert('Error al eliminar', res.error || 'No se pudo mover la prenda a la papelera.');
              return;
            }
            setLocalGarments(prev => prev.filter((g: Garment) => g.id !== id));
            await AuthManager.refreshAllAppState(db);
          } catch (e) {
            console.error('Error deleting garment:', e);
            Alert.alert('Error', 'Ocurrió un error al eliminar la prenda.');
          }
        }
      }
    ]);
  }, [db, user?.id, hasRole]);

  const handleNew = () => {
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para crear registros.');
      return;
    }

    navigateSafe('Form', { entityType: 'garment', parentId: boxId, mode: 'BASIC' });
  };

  const canEdit = hasRole(['Admin', 'Editor']);
  const showSkeleton = !db || (loading && localGarments.length === 0);
  const selectedCount = Object.keys(selectedGarments).filter(k => selectedGarments[k]).length;

  return {
    state: {
      search,
      activeFilter,
      refreshing,
      loading,
      highlightedId,
      isModalVisible,
      currentImage,
      moveModalVisible,
      garmentToMove,
      successModalConfig,
      ocrLoading,
    },
    computed: {
      currentTheme,
      themeMode,
      canEdit,
      filteredGarments,
      filterCounts,
      selectedCount,
      selectedGarments,
      showSkeleton,
    },
    refs: {
      flatListRef,
      fadeAnim,
    },
    handlers: {
      setSearch,
      setActiveFilter,
      onRefresh,
      handleNew,
      handleCameraScan,
      handleBulkDelete,
      handleItemPress,
      deleteGarment,
      toggleGarmentStatus,
      fetchGarments,
      setMoveModalVisible,
      setGarmentToMove,
      setModalVisible,
      setCurrentImage,
      setSuccessModalConfig,
      toggleSelectGarment,
      clearSelectedGarments,
    },
  };
};

export default useBoxContentsScreen;
