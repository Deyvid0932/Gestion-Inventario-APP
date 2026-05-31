import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,

  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
  Animated,
  LayoutAnimation,
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
import { SearchBar } from '../components/SearchBar';
import { Swipeable, GestureHandlerRootView, RectButton, FlatList } from 'react-native-gesture-handler';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { useOCRManager } from '../hooks/useOCRManager';
import { getColorHex } from '../utils/colorUtils';

type ExcelGridRouteProp = RouteProp<RootStackParamList, 'ExcelGrid'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;



const PrendaItem = React.memo(({
  item, theme, isSelected, onPress, onLongPress, onDelete, onToggleStatus, isHighlighted
}: {
  item: Prenda, theme: any, isSelected: boolean, onPress: () => void,
  onLongPress: () => void, onDelete: () => void, onToggleStatus: () => void, isHighlighted: boolean
}) => {
  const colorHex = getColorHex(item.color);
  const estado = Number(item.estado);


  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isHighlighted ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [isHighlighted]);

  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isSelected ? theme.primary + '15' : theme.card, '#9CA3AF']
  });
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <RectButton
      style={[styles.deleteActionButton, { backgroundColor: '#e74c3c' }]}
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
    >
      <Ionicons name="trash-outline" size={24} color="#FFF" />
    </RectButton>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={onLongPress}
        onPress={onPress}
      >
        <Animated.View style={[
          styles.itemCard,
          {
            backgroundColor,
            borderColor: isHighlighted ? theme.primary : (isSelected ? theme.primary + '15' : theme.border),
            borderLeftColor: colorHex,
            borderLeftWidth: 4,
            transform: [{ scale: isHighlighted ? 1.05 : 1 }]
          }
        ]}>
          {isHighlighted && (
            <View style={{ backgroundColor: theme.primary, paddingVertical: 2 }}></View>
          )}
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={[styles.itemStyle, { color: theme.text }]} numberOfLines={1}>{item.estilo}</Text>
              <TouchableOpacity onPress={onToggleStatus} style={[styles.statusBadge, { backgroundColor: estado === 1 ? '#2ecc7120' : '#8E8E9320' }]}>
                <View style={[styles.statusIndicator, { backgroundColor: estado === 1 ? '#2ecc71' : '#8E8E93' }]} />
                <Text style={[styles.statusText, { color: estado === 1 ? '#2ecc71' : '#8E8E93' }]}>{estado === 1 ? 'Activo' : 'Inactivo'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.itemFooter}>
              <View style={styles.infoGroup}>
                <Ionicons name="pricetag-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.op || 'Sin OP'}</Text>
              </View>
              <View style={styles.infoGroup}>
                <Ionicons name="color-palette-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.color}</Text>
              </View>
            </View>
          </View>
          {isSelected && (
            <View style={[styles.selectionCheck, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </Swipeable>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected &&
    prev.item.id === next.item.id &&
    prev.isHighlighted === next.isHighlighted &&
    prev.item.estado === next.item.estado &&
    prev.item.estilo === next.item.estilo &&
    prev.item.color === next.item.color &&
    prev.item.op === next.item.op &&
    prev.theme === next.theme;
});

const CajaContentsScreen = () => {
  const route = useRoute<ExcelGridRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { cajaId, nombreCaja } = route.params;
  const db = useSQLiteContext();
  const { processImage, loading: ocrLoading } = useOCRManager();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { toggleStatus: togglePrendaStatus } = usePrenda();
  const { prendas, setPrendas, currentTheme, selectedPrendas, toggleSelectPrenda, clearSelectedPrendas } = useAppStore();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const handleItemPress = useCallback((item: Prenda) => {
    if (selectedPrendas.length > 0) toggleSelectPrenda(item.id);
    else navigation.navigate('Form', {
      mode: 'ADVANCED',
      entityType: 'prenda',
      parentId: cajaId,
      initialData: item
    });
  }, [selectedPrendas.length, cajaId, navigation, toggleSelectPrenda]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPrendas = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
      fadeAnim.setValue(0);
    }
    try {
      const result = await db.getAllAsync<Prenda>(
        'SELECT * FROM prendas WHERE cajaId = ? AND (op LIKE ? OR estilo LIKE ? OR color LIKE ?) ORDER BY id DESC',
        [cajaId, `%${debouncedSearch}%`, `%${debouncedSearch}%`, `%${debouncedSearch}%`]
      );

      setPrendas(result);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
      if (showLoading) {
        setTimeout(() => setLoading(false), 300);
      } else {
        setLoading(false);
      }
    }
  }, [db, cajaId, setPrendas, debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      fetchPrendas(true);
    }, [fetchPrendas])
  );

  useEffect(() => {
    const targetId = route.params?.targetPrendaId;
    if (targetId && prendas.length > 0) {
      const index = prendas.findIndex(p => p.id === targetId);

      if (index !== -1) {
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5
          });
          setHighlightedId(targetId);
          setTimeout(() => setHighlightedId(null), 1500);
          navigation.setParams({ targetPrendaId: undefined });
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [prendas, route.params?.targetPrendaId]);

  useEffect(() => {
    if (!loading) fetchPrendas(false);
  }, [debouncedSearch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPrendas(false);
  }, [fetchPrendas]);

  const handleCameraScan = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Error', 'Permisos denegados');

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });

    if (!result.canceled && result.assets[0].uri) {
      const listaExtraida = await processImage(result.assets[0].uri, cajaId);

      if (listaExtraida.length === 0) {
        return Alert.alert('OCR', 'No se detectaron prendas con el formato KHM.');
      }

      Alert.alert('Detectados', `Se encontraron ${listaExtraida.length} prendas.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Guardar', onPress: () => saveToDatabase(listaExtraida) }
      ]);
    }
  };

  const saveToDatabase = async (items: any[]) => {
    try {
      const result = await PrendaService.bulkAddPrendas(db, items);
      if (result.success) {
        fetchPrendas(false);
      } else {
        Alert.alert('Error', result.error || 'No se pudo guardar en la base de datos.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar en la base de datos local.');
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

  const deleteSelected = useCallback(async () => {
    Alert.alert("Eliminar Selección", `¿Eliminar las ${selectedPrendas.length} prendas?`, [
      { text: "Cancelar" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            const placeholders = selectedPrendas.map(() => '?').join(',');
            await db.runAsync(`DELETE FROM prendas WHERE id IN (${placeholders})`, selectedPrendas);
            fetchPrendas(false);
            clearSelectedPrendas();
          } catch (error) {
            console.error("Error en borrado masivo:", error);
          }
        }
      }
    ]);
  }, [db, selectedPrendas, fetchPrendas, clearSelectedPrendas]);

  const renderItem = useCallback(({ item }: { item: Prenda }) => {
    const isHighlighted = item.id === highlightedId;
    return (
      <PrendaItem
        item={item}
        theme={currentTheme}
        isSelected={selectedPrendas.includes(item.id)}
        isHighlighted={isHighlighted}
        onPress={() => handleItemPress(item)}
        onLongPress={() => toggleSelectPrenda(item.id)}
        onDelete={() => deletePrenda(item.id)}
        onToggleStatus={() => {
          const nuevoEstado = Number(item.estado) === 1 ? 'Inactivo' : 'Activo';

          Alert.alert("Estado", `¿Marcar como ${nuevoEstado}?`, [{ text: "Cancelar" }, {
            text: "Confirmar", onPress: async () => {
              await togglePrendaStatus(item.id);
              fetchPrendas(false);
            }
          }]);
        }}

      />
    );
  }, [currentTheme, selectedPrendas, cajaId, navigation, toggleSelectPrenda, deletePrenda, togglePrendaStatus, highlightedId]);

  const keyExtractor = useCallback((item: Prenda) => item.id, []);
  const showSkeleton = loading && prendas.length === 0;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <Navbar
          title={nombreCaja}
          showBackButton
        />
        <View style={styles.headerActions}>
          {selectedPrendas.length > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.glassButton, { backgroundColor: '#e74c3c' }]}
              onPress={deleteSelected}
            >
              <Ionicons name="trash-outline" size={20} color="#FFF" />
              <Text style={styles.glassButtonText}>Eliminar ({selectedPrendas.length})</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.glassButton, { backgroundColor: currentTheme.card, borderColor: currentTheme.primary + '40', borderWidth: 1 }]}
                onPress={() => navigation.navigate('Form', { entityType: 'prenda', parentId: cajaId, mode: 'BASIC' })}
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
                data={prendas}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                onScrollBeginDrag={() => setHighlightedId(null)}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={currentTheme.primary}
                    colors={[currentTheme.primary]}
                  />
                }
                onScrollToIndexFailed={(info) => {
                  const wait = new Promise(resolve => setTimeout(resolve, 100));
                  wait.then(() => {
                    flatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0.5
                    });
                  });
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="shirt-outline" size={80} color={currentTheme.border} />
                    <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>Vacio</Text>
                  </View>
                }
              />
            </Animated.View>
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: { flexDirection: 'row', padding: 18, gap: 12 },
  glassButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, gap: 8, elevation: 4 },
  glassButtonText: { fontSize: 15, fontWeight: '700' },
  searchWrapper: { paddingHorizontal: 18, marginBottom: 10 },
  listContent: { padding: 18, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  itemContent: { flex: 1, padding: 15, justifyContent: 'center' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemStyle: { fontSize: 18, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 5 },
  statusIndicator: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  itemFooter: { flexDirection: 'row', gap: 15 },
  infoGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: 13, fontWeight: '600' },
  selectionCheck: { position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  deleteActionButton: { width: 80, justifyContent: 'center', alignItems: 'center', borderRadius: 16, marginLeft: 10, marginBottom: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 15 },
});

export default CajaContentsScreen;