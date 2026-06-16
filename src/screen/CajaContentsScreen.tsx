import React, { useCallback, useState, useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Alert, 
  RefreshControl, 
  Animated, 
} from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Prenda } from '../types';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { usePrenda } from '../hooks/usePrenda';
import { PrendaService } from '../services/PrendaService';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView, FlatList  } from 'react-native-gesture-handler';
import { useOCRManager } from '../hooks/useOCRManager';
import { PrendaCard } from '../components/PrendaCard';
import { SearchBar } from '../components/SearchBar';
import { SkeletonLoader } from '../components/SkeletonLoader';

type ExcelGridRouteProp = RouteProp<RootStackParamList, 'ExcelGrid'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const CajaContentsScreen = () => {
  const route = useRoute<ExcelGridRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { cajaId, nombreCaja } = route.params;
  const db = useSQLiteContext();
  const { processImage, loading: ocrLoading } = useOCRManager();

  const [search, setSearch] = useState('');
  const [localPrendas, setLocalPrendas] = useState<Prenda[]>([]); 
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastNavTime = useRef(0);
  const searchCounter = useRef(0); 

  const { toggleStatus: togglePrendaStatus } = usePrenda();
  
  const setPrendasGlobal = useAppStore(state => state.setPrendas);
  const currentTheme = useAppStore(state => state.currentTheme);
  const selectedPrendas = useAppStore(state => state.selectedPrendas);
  const toggleSelectPrenda = useAppStore(state => state.toggleSelectPrenda);
  const clearSelectedPrendas = useAppStore(state => state.clearSelectedPrendas);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const fetchPrendas = useCallback(async (showLoading = false, currentSearch = search) => {
    const queryId = ++searchCounter.current;

    if (showLoading) {
      setLoading(true);
      fadeAnim.setValue(0);
    }

    try {
      const result = await PrendaService.getAllPrendasByCaja(db, cajaId, currentSearch);
      
      if (queryId === searchCounter.current) {
        setLocalPrendas(result);

        if (currentSearch === '') {
          setPrendasGlobal(result); 
        }

        if (showLoading || currentSearch === '') {
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
  }, [db, cajaId, setPrendasGlobal, fadeAnim]);

  useEffect(() => {
    fetchPrendas(false, search);
  }, [search, fetchPrendas]);

  useFocusEffect(
    useCallback(() => {
      fetchPrendas(localPrendas.length === 0);
      return () => clearSelectedPrendas();
    }, [cajaId, clearSelectedPrendas, localPrendas.length, fetchPrendas])
  );

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const targetId = route.params?.targetPrendaId;
    if (targetId && localPrendas.length > 0 && !loading) {
      setHighlightedId(targetId);
      const index = localPrendas.findIndex(p => p.id === targetId);
      if (index !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }, 500);
        navigation.setParams({ targetPrendaId: undefined });
      }
    }
  }, [localPrendas, route.params?.targetPrendaId, loading, navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrendas(false);
  }, [fetchPrendas]);

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 350) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleItemPress = useCallback((item: Prenda) => {
    if (selectedPrendas.length > 0) toggleSelectPrenda(item.id);
    else {
      navigateSafe('Form', {
        mode: 'ADVANCED',
        entityType: 'prenda',
        parentId: cajaId,
        initialData: item
      });
    }
  }, [selectedPrendas.length, cajaId, navigateSafe, toggleSelectPrenda]);

  const handleBulkDelete = () => {
    Alert.alert(
      "Eliminar Selección",
      `¿Deseas eliminar las ${selectedPrendas.length} prendas seleccionadas?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              for (const id of selectedPrendas) {
                await db.runAsync('DELETE FROM prendas WHERE id = ?', [id]);
              }
              clearSelectedPrendas();
              fetchPrendas(false);
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const handleCameraScan = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Error', 'Permisos denegados');

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });

    if (!result.canceled && result.assets[0].uri) {
      const listaExtraida = await processImage(result.assets[0].uri, cajaId);
      if (listaExtraida.length === 0) return Alert.alert('OCR', 'No se detectaron prendas.');

      Alert.alert('Detectados', `Se encontraron ${listaExtraida.length} prendas.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Guardar', onPress: () => saveToDatabase(listaExtraida) }
      ]);
    }
  };

  const saveToDatabase = async (items: any[]) => {
    try {
      const result = await PrendaService.bulkAddPrendas(db, items);
      if (result.success) fetchPrendas(false);
      else Alert.alert('Error', result.error || 'No se pudo guardar.');
    } catch (e) {
      Alert.alert('Error', 'Error de base de datos.');
    }
  };

  const deletePrenda = useCallback(async (id: string) => {
    Alert.alert("Eliminar", "¿Eliminar registro?", [
      { text: "Cancelar" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            await db.runAsync('DELETE FROM prendas WHERE id = ?', [id]);
            fetchPrendas(false);
          } catch (e) { console.error(e); }
        }
      }
    ]);
  }, [db, fetchPrendas]);

  const ITEM_HEIGHT = 108; 

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  const renderItem = useCallback(({item}: { item: Prenda }) => (
      <PrendaCard
        item={item}
        theme={currentTheme}
        isSelected={selectedPrendas.includes(item.id)}
        isHighlighted={item.id === highlightedId}
        onPress={() => handleItemPress(item)}
        onLongPress={() => toggleSelectPrenda(item.id)}
        onDelete={() => deletePrenda(item.id)}
        onToggleStatus={() => {
          const nextStatusLabel = item.estado === 1 ? 'Inactivo' : 'Activo';
          Alert.alert("Estado", `¿Marcar como ${nextStatusLabel}?`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Confirmar",
              onPress: async () => {
                await togglePrendaStatus(item.id);
                fetchPrendas(false);
              }
            }
          ]);
        }}
      />
  ), [currentTheme, selectedPrendas, highlightedId, handleItemPress, toggleSelectPrenda, deletePrenda, togglePrendaStatus, fetchPrendas]);

  const showSkeleton = loading && localPrendas.length === 0;

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title={nombreCaja} showBackButton/>

      <View style={styles.headerActions}>
        {selectedPrendas.length > 0 ? (
          <TouchableOpacity
            onPress={handleBulkDelete}
            style={[styles.bulkDeleteButton, { backgroundColor: '#e74c3c' }]}
          >
            <Ionicons name="trash" size={24} color="#FFF" />
            <Text style={styles.bulkDeleteText}>Eliminar Prendas ({selectedPrendas.length})</Text>
            <TouchableOpacity onPress={clearSelectedPrendas} style={styles.clearSelectionSmall}>
              <Ionicons name="close-circle" size={24} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.glassButton, { backgroundColor: currentTheme.card, borderColor: currentTheme.primary + '40', borderWidth: 1 }]}
              onPress={() => navigateSafe('Form', { entityType: 'prenda', parentId: cajaId, mode: 'BASIC' })}
            >
              <Ionicons name="add" size={22} color={currentTheme.primary} />
              <Text style={[styles.glassButtonText, { color: currentTheme.text }]}>Nuevo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.glassButton, { backgroundColor: currentTheme.primary }]}
              onPress={handleCameraScan}
            >
              <Ionicons name="camera" size={22} color="#FFF" />
              <Text style={styles.glassButtonText}>OCR</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.searchWrapper}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Filtrar prendas..." />
      </View>

      <View style={{ flex: 1 }}>
        {showSkeleton ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <FlatList
              ref={flatListRef}
              data={localPrendas}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              getItemLayout={getItemLayout} 
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={true}
              onScrollToIndexFailed={(info) => {
                const offset = info.averageItemLength * info.index;
                flatListRef.current?.scrollToOffset({ offset, animated: true });
                setTimeout(() => {
                  if (flatListRef.current && info.index < localPrendas.length) {
                    flatListRef.current.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0.5
                    });
                  }
                }, 300); 
              }}
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
                  <Ionicons name="shirt-outline" size={100} color={currentTheme.border} />
                  <Text style={[styles.emptyTitle, { color: currentTheme.textSecondary }]}>¡Sin Prendas!</Text>
                  <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                    Toca "Nuevo" o usa el OCR para comenzar.
                  </Text>
                </View>
              }

              ListFooterComponent={<View style={{ height: 50 }} />}
            />
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: { flexDirection: 'row', padding: 18, gap: 12 },
  glassButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, gap: 8, elevation: 4 },
  glassButtonText: { fontSize: 15, fontWeight: '700' },
  bulkDeleteButton: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: 52, 
    borderRadius: 14, 
    gap: 12, 
    elevation: 8,
    paddingHorizontal: 20,
  },
  bulkDeleteText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  clearSelectionSmall: { marginLeft: 'auto' },
  searchWrapper: { paddingHorizontal: 18, marginBottom: 10 },
  listContent: {
    padding: 18,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: -50
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

export default CajaContentsScreen;