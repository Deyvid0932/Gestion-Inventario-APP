import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,

  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Animated,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, DetallePrenda } from '../types';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { useDetallePrenda } from '../hooks/useDetallePrenda';
import { SearchBar } from '../components/SearchBar';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { Swipeable, GestureHandlerRootView, RectButton, FlatList } from 'react-native-gesture-handler';
import { getColorHex } from '../utils/colorUtils';



const FocusGarmentCard = React.memo(({
  item, index, theme, onPress, onToggleStatus, onDelete
}: {
  item: DetallePrenda, index: number, theme: any, onPress: () => void, onToggleStatus: () => void, onDelete: () => void
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const fadeAnim = useRef(new Animated.Value(index < 10 ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(index < 10 ? 20 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (index < 10) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 40, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, delay: index * 40, useNativeDriver: true })
      ]).start();
    }
  }, []);

  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  const colorHex = getColorHex(item.color);
  const estado = Number(item.estado);

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
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }}>
      <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} friction={2}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: colorHex, borderLeftWidth: 4 }]}
        >
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
              <Text style={[styles.itemStyle, { color: theme.text }]} numberOfLines={1}>{item.estilo}</Text>
              <TouchableOpacity onPress={onToggleStatus} style={[styles.statusBadge, { backgroundColor: estado === 1 ? '#2ecc7120' : '#8E8E9320' }]}>
                <View style={[styles.statusIndicator, { backgroundColor: estado === 1 ? '#2ecc71' : '#8E8E93' }]} />
                <Text style={[styles.statusText, { color: estado === 1 ? '#2ecc71' : '#8E8E93' }]}>{estado === 1 ? 'Activo' : 'Inactivo'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.itemFooter}>
              <View style={styles.infoGroup}><Ionicons name="pricetag-outline" size={14} color={theme.textSecondary} /><Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.op || 'Sin OP'}</Text></View>
              <View style={styles.infoGroup}><Ionicons name="color-palette-outline" size={14} color={theme.textSecondary} /><Text style={[styles.infoText, { color: theme.textSecondary }]}>{item.color}</Text></View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
    prev.item.estado === next.item.estado &&
    prev.item.estilo === next.item.estilo &&
    prev.item.color === next.item.color &&
    prev.item.op === next.item.op &&
    prev.theme === next.theme;
});

const GarmentDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { toggleStatus } = useDetallePrenda();
  const { detallesPrenda, setDetallesPrenda, currentTheme } = useAppStore();

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
      const query = 'SELECT * FROM detalles_prendas WHERE (op LIKE ? OR estilo LIKE ? OR color LIKE ?) ORDER BY id DESC';
      const searchParam = `%${debouncedSearch}%`;
      const rows = await db.getAllAsync<DetallePrenda>(query, [searchParam, searchParam, searchParam]);
      setDetallesPrenda(rows);

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
  }, [db, debouncedSearch, setDetallesPrenda]);

  useFocusEffect(
    useCallback(() => {
      fetchPrendas(true);
    }, [fetchPrendas])
  );

  useEffect(() => {
    if (!loading) fetchPrendas(false);
  }, [debouncedSearch]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPrendas(false);
  };

  const handleToggleStatus = (detalle: DetallePrenda) => {
    const nuevoEstado = Number(detalle.estado) === 1 ? 'Inactivo' : 'Activo';
    Alert.alert("Estado", `¿Marcar como ${nuevoEstado}?`, [{ text: "Cancelar" }, {
      text: "Confirmar", onPress: async () => {
        await toggleStatus(detalle.id);
        fetchPrendas(false);
      }
    }]);
  };

  const deletePrenda = async (id: string) => {
    Alert.alert("Eliminar", "¿Eliminar registro?", [
      { text: "Cancelar" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            await db.runAsync('DELETE FROM detalles_prendas WHERE id = ?', [id]);
            fetchPrendas(false);
          } catch (error) {
            console.error(error);
          }
        }
      }
    ]);
  };
  const pageTitle = route.params?.nombreCaja ? `Caja: ${route.params.nombreCaja}` : "Registros";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <Navbar title={pageTitle} showBackButton={!!route.params?.nombreCaja} />
        <View style={styles.headerRow}>
          <View style={styles.searchWrapper}><SearchBar value={search} onChangeText={setSearch} placeholder="Filtrar registros..." /></View>
          <TouchableOpacity style={[styles.addButton, { backgroundColor: currentTheme.primary }]} onPress={() => navigation.navigate('Form', { mode: 'ADVANCED_LITE', entityType: 'detalle_prenda' })}>
            <Ionicons name="add" size={26} color="#FFF" />
            </TouchableOpacity>
        </View>
  
        {loading ? <SkeletonLoader theme={currentTheme} /> : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <FlatList
              data={detallesPrenda}
              renderItem={({ item, index }) => (
                <FocusGarmentCard
                  item={item} index={index} theme={currentTheme}
                  onToggleStatus={() => handleToggleStatus(item)}
                  onDelete={() => deletePrenda(item.id)}
                  onPress={() => navigation.navigate('Form', { mode: 'ADVANCED_LITE', entityType: 'detalle_prenda', initialData: item })}
                />
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={[styles.listContent]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={currentTheme.primary} />}
              ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="layers-outline" size={80} color={currentTheme.border} /><Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>Vacio</Text></View>}
            />
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', padding: 18, gap: 10, alignItems: 'center' },
  searchWrapper: { flex: 1 },
  addButton: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', elevation: 4 },
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
  deleteActionButton: { width: 80, justifyContent: 'center', alignItems: 'center', borderRadius: 16, marginLeft: 10, marginBottom: 12 },
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 15 },
});

export default GarmentDetailsScreen;
