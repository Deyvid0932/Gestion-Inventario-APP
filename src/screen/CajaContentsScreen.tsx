import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Animated,
  Modal,
  Image,
  ScrollView
} from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Prenda } from '../types';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { usePrenda } from '../hooks/usePrenda';
import { PrendaService } from '../services/PrendaService';
import { generateId } from '../database/database';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView, FlatList } from 'react-native-gesture-handler';
import { useOCRManager } from '../hooks/useOCRManager';
import { PrendaCard } from '../components/PrendaCard';
import { SearchBar } from '../components/SearchBar';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { MovePrendaModal } from '../components/MovePrendaModal';
import { SuccessModal } from '../components/SuccessModal';

import { AuthManager } from '../services/AuthManager';
import { useRoles } from '../hooks/useRoles';

type ExcelGridRouteProp = RouteProp<RootStackParamList, 'ExcelGrid'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const CajaContentsScreen = () => {
  const route = useRoute<ExcelGridRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { hasRole } = useRoles();
  const { cajaId, nombreCaja } = route.params;
  const db = useSQLiteContext();
  const user = useAppStore(state => state.user);
  const { processImage, loading: ocrLoading } = useOCRManager();

  const [search, setSearch] = useState('');
  const globalPrendas = useAppStore(state => state.prendas);
  const initialCajaPrendas = React.useMemo(() => {
    return globalPrendas.filter(p => p.cajaId === cajaId);
  }, [globalPrendas, cajaId]);

  const [localPrendas, setLocalPrendas] = useState<Prenda[]>(initialCajaPrendas);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ALARM' | 'PHOTOS' | 'INACTIVE'>('ALL');

  const filteredPrendas = React.useMemo(() => {
    return localPrendas.filter((item: Prenda) => {
      if (activeFilter === 'ALARM') return !!item.alarmaFechaHora;
      if (activeFilter === 'PHOTOS') return !!item.fotoUri || !!item.fotoUri2;
      if (activeFilter === 'INACTIVE') return item.estado === 0;
      return true;
    });
  }, [localPrendas, activeFilter]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(initialCajaPrendas.length === 0);
  const fadeAnim = useRef(new Animated.Value(initialCajaPrendas.length > 0 ? 1 : 0)).current;
  const lastNavTime = useRef(0);
  const searchCounter = useRef(0);

  const { toggleStatus: togglePrendaStatus } = usePrenda();

  const setPrendasGlobal = useAppStore(state => state.setPrendas);
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const selectedPrendas = useAppStore(state => state.selectedPrendas);
  const toggleSelectPrenda = useAppStore(state => state.toggleSelectPrenda);
  const clearSelectedPrendas = useAppStore(state => state.clearSelectedPrendas);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [prendaToMove, setPrendaToMove] = useState<string | null>(null);
  const [successModalConfig, setSuccessModalConfig] = useState<{
    isVisible: boolean;
    title: string;
    message: string;
  }>({
    isVisible: false,
    title: '',
    message: '',
  });

  const fetchPrendas = useCallback(async (showLoading = false) => {
    if (!db) return;
    const queryId = ++searchCounter.current;

    if (showLoading && localPrendas.length === 0) {
      setLoading(true);
      fadeAnim.setValue(0);
    }

    try {
      const result = await PrendaService.getAllPrendasByCaja(db, cajaId, search);

      if (queryId === searchCounter.current) {
        setLocalPrendas(result);

        if (search === '') {
          setPrendasGlobal(result);
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
  }, [db, cajaId, setPrendasGlobal, fadeAnim, search, localPrendas.length]);

  useEffect(() => {
    const cached = globalPrendas.filter(p => p.cajaId === cajaId);
    if (cached.length > 0) {
      setLocalPrendas(cached);
      setLoading(false);
      fadeAnim.setValue(1);
    }
  }, [cajaId, globalPrendas, fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      if (db && cajaId) {
        fetchPrendas(false);
      }
      return () => clearSelectedPrendas();
    }, [db, cajaId, fetchPrendas, clearSelectedPrendas])
  );

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (db) {
      const timer = setTimeout(() => {
        fetchPrendas(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [search, db, fetchPrendas]);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const targetId = route.params?.targetPrendaId;
    if (targetId && localPrendas.length > 0) {
      setHighlightedId(targetId);
      const index = localPrendas.findIndex(p => p.id === targetId);
      if (index !== -1) {
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [localPrendas, route.params?.targetPrendaId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrendas(false);
  }, [fetchPrendas]);

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleItemPress = useCallback((item: Prenda) => {
    if (Object.keys(selectedPrendas).filter(k => selectedPrendas[k]).length > 0) toggleSelectPrenda(item.id);
    else {
      navigateSafe('Form', {
        mode: 'ADVANCED',
        entityType: 'prenda',
        parentId: cajaId,
        initialData: item
      });
    }
  }, [Object.keys(selectedPrendas).filter(k => selectedPrendas[k]).length, cajaId, navigateSafe, toggleSelectPrenda]);

  const handleBulkDelete = () => {
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual solo permite lectura. No tienes permisos para eliminar registros.');
      return;
    }

    Alert.alert(
      "Eliminar Selección",
      `¿Deseas eliminar las ${Object.keys(selectedPrendas).filter(k => selectedPrendas[k]).length} prendas seleccionadas?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const selectedIds = Object.keys(selectedPrendas).filter(k => selectedPrendas[k]);
              for (const id of selectedIds) {
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
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para escanear prendas.');
      return;
    }

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
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para eliminar registros.');
      return;
    }

    Alert.alert("Eliminar", "¿Eliminar registro de prenda?", [
      { text: "Cancelar" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            const res = await PrendaService.hardDelete(db, id, user?.id);
            if (!res.success) {
              Alert.alert('Error al eliminar', res.error || 'No se pudo eliminar la prenda.');
              return;
            }
            setLocalPrendas(prev => prev.filter((p: Prenda) => p.id !== id));
            AuthManager.refreshAllAppState(db);
          } catch (e) {
            console.error('Error al eliminar prenda:', e);
            Alert.alert('Error', 'Ocurrió un error al eliminar la prenda.');
          }
        }
      }
    ]);
  }, [db, fetchPrendas, user?.id, hasRole]);


  const renderItem = useCallback(({ item }: { item: Prenda }) => {
    const canEdit = hasRole(['Admin', 'Editor']);
    return (
      <PrendaCard
        item={item}
        theme={currentTheme}
        isSelected={!!selectedPrendas[item.id]}
        isHighlighted={item.id === highlightedId}
        canEdit={canEdit}
        onPress={() => handleItemPress(item)}
        onLongPress={() => toggleSelectPrenda(item.id)}
        onDelete={() => deletePrenda(item.id)}
        onToggleStatus={() => {
          if (!canEdit) {
            Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para cambiar el estado.');
            return;
          }
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
        onMove={() => {
          if (!canEdit) {
            Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para mover prendas.');
            return;
          }
          setPrendaToMove(item.id);
          setMoveModalVisible(true);
        }}
        onImagePress={(uri) => {
          if (uri) {
            setModalVisible(true);
            setCurrentImage(uri);
          }
        }}
      />
    );
  }, [currentTheme, selectedPrendas, highlightedId, handleItemPress, toggleSelectPrenda, deletePrenda, togglePrendaStatus, fetchPrendas, hasRole]);

  const showSkeleton = !db || (loading && localPrendas.length === 0);

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title={nombreCaja} showBackButton />

      <View style={styles.headerActions}>
        {Object.keys(selectedPrendas).filter(k => selectedPrendas[k]).length > 0 ? (
          <TouchableOpacity
            onPress={handleBulkDelete}
            style={[styles.bulkDeleteButton, { backgroundColor: '#e74c3c' }]}
          >
            <Ionicons name="trash" size={24} color="#FFF" />
            <Text style={[styles.bulkDeleteText, { color: '#FFF' }]}>Eliminar Prendas ({Object.keys(selectedPrendas).filter(k => selectedPrendas[k]).length})</Text>
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
              <Ionicons name="camera" size={22} color={currentTheme.primaryText} />
              <Text style={[styles.glassButtonText, { color: currentTheme.primaryText }]}>OCR</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.searchWrapper}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Filtrar prendas..." />
      </View>

      <View style={{ height: 38, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, alignItems: 'center' }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveFilter('ALL')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: activeFilter === 'ALL' ? currentTheme.primary : currentTheme.card,
              borderWidth: 1,
              borderColor: activeFilter === 'ALL' ? currentTheme.primary : currentTheme.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFilter === 'ALL' ? currentTheme.primaryText : currentTheme.text }}>
              Todas ({localPrendas.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveFilter('ALARM')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: activeFilter === 'ALARM' ? '#EAB308' : currentTheme.card,
              borderWidth: 1,
              borderColor: activeFilter === 'ALARM' ? '#EAB308' : currentTheme.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFilter === 'ALARM' ? '#000' : currentTheme.text }}>
              ⏰ Con Alarma ({localPrendas.filter((p: Prenda) => !!p.alarmaFechaHora).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveFilter('PHOTOS')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: activeFilter === 'PHOTOS' ? currentTheme.primary : currentTheme.card,
              borderWidth: 1,
              borderColor: activeFilter === 'PHOTOS' ? currentTheme.primary : currentTheme.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFilter === 'PHOTOS' ? currentTheme.primaryText : currentTheme.text }}>
              📷 Con Fotos ({localPrendas.filter((p: Prenda) => !!p.fotoUri || !!p.fotoUri2).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveFilter('INACTIVE')}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 20,
              backgroundColor: activeFilter === 'INACTIVE' ? '#8E8E93' : currentTheme.card,
              borderWidth: 1,
              borderColor: activeFilter === 'INACTIVE' ? '#8E8E93' : currentTheme.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: activeFilter === 'INACTIVE' ? '#FFF' : currentTheme.text }}>
              ⚪ Inactivas ({localPrendas.filter((p: Prenda) => p.estado === 0).length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {showSkeleton ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <FlatList
              key={`prendas-${themeMode}`}
              extraData={themeMode}
              ref={flatListRef}
              data={filteredPrendas}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(_, index) => ({ length: 142, offset: 142 * index, index })}
              updateCellsBatchingPeriod={50}
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

      <MovePrendaModal
        isVisible={moveModalVisible}
        onClose={() => setMoveModalVisible(false)}
        currentCajaId={cajaId}
        onSelectCaja={async (newCajaId, nombreCajaDestino) => {
          if (prendaToMove && db) {
            setMoveModalVisible(false);
            const result = await PrendaService.movePrenda(db, prendaToMove, newCajaId);
            if (result.success) {
              fetchPrendas(false);
              setSuccessModalConfig({
                isVisible: true,
                title: '¡Prenda Movida con Éxito! 📦',
                message: `La prenda se trasladó a la "${nombreCajaDestino}" correctamente.`
              });
            } else {
              Alert.alert("Error", result.error || "No se pudo mover la prenda");
            }
          }
        }}
      />

      <SuccessModal
        isVisible={successModalConfig.isVisible}
        title={successModalConfig.title}
        message={successModalConfig.message}
        onClose={() => setSuccessModalConfig(prev => ({ ...prev, isVisible: false }))}
      />

      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>

          <Image
            source={{ uri: currentImage || '' }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
});

export default CajaContentsScreen;