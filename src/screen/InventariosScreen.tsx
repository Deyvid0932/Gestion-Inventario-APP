import React, { useState, useCallback, useRef, memo } from 'react';
import { 
  View,  
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Inventario } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { Swipeable, GestureHandlerRootView, RectButton, FlatList} from 'react-native-gesture-handler';
import { SkeletonLoader } from '../components/SkeletonLoader';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface InventarioStats extends Inventario {
  totalPrendas: number;
  prendasEscaneadas: number;
}

const InventarioCard = memo(({ 
  item, 
  onPress, 
  onEdit, 
  onDelete, 
  theme 
}: { 
  item: InventarioStats, 
  onPress: () => void, 
  onEdit: () => void, 
  onDelete: () => void,
  theme: any
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const progress = item.totalPrendas > 0 ? (item.prendasEscaneadas / item.totalPrendas) : 0;
  
  const renderRightActions = (progressAnimatedValue: Animated.AnimatedInterpolation<number>) => {
    const trans = progressAnimatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [180, 0],
    });

    return (
      <View style={{ width: 180, flexDirection: 'row' }}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#3498db' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit();
            }}
          >
            <Ionicons name="pencil-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
        <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#FFF" />
          </RectButton>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
    >
      <TouchableOpacity 
        activeOpacity={1}
        delayPressIn={0}
        pressRetentionOffset={{ top: 20, left: 20, right: 20, bottom: 20 }}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={onPress}
      >
        <View style={styles.cardMain}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.nombre}</Text>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                {new Date(item.fechaCreacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.estado === 'Activo' ? '#2ecc7120' : theme.border }]}>
            <Text style={[styles.statusText, { color: item.estado === 'Activo' ? '#2ecc71' : theme.textSecondary }]}>
              {item.estado}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardDesc, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.descripcion || 'Sin descripción adicional'}
        </Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Progreso de Escaneo</Text>
            <Text style={[styles.progressValue, { color: theme.primary }]}>
              {item.prendasEscaneadas} / {item.totalPrendas}
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  backgroundColor: theme.primary, 
                  width: `${progress * 100}%`,
                  shadowColor: theme.primary,
                  elevation: 2,
                }
              ]} 
            />
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

export const InventariosScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const { currentTheme, setPrendas } = useAppStore();
  const [inventarios, setInventarios] = useState<InventarioStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInventarios = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = `
        SELECT i.*, 
               COUNT(p.id) as totalPrendas,
               SUM(CASE WHEN p.estado = 1 THEN 1 ELSE 0 END) as prendasEscaneadas
        FROM inventarios i 
        LEFT JOIN cajas c ON c.inventarioId = i.id
        LEFT JOIN prendas p ON p.cajaId = c.id
        GROUP BY i.id
        ORDER BY i.fechaCreacion DESC
      `;
      const result = await db.getAllAsync<InventarioStats>(query);
      setInventarios(result);
    } catch (error) {
      console.error("Error fetching inventarios:", error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      fetchInventarios(inventarios.length > 0);
    }, [fetchInventarios, inventarios.length])
  );

  const openAddForm = () => {
    navigation.navigate('Form', {
      mode: 'BASIC',
      entityType: 'inventario'
    });
  };

  const openEditForm = (item: Inventario) => {
    navigation.navigate('Form', {
      mode: 'BASIC',
      entityType: 'inventario',
      initialData: {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion || ''
      }
    });
  };

  const deleteInventario = (id: string, nombre: string) => {
    Alert.alert(
      "Eliminar Lote",
      `¿Estás seguro de que deseas eliminar el lote "${nombre}"? Esta acción borrará todas las cajas y prendas dentro de él.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              await db.runAsync('DELETE FROM inventarios WHERE id = ?', [id]);
              fetchInventarios();
            } catch (error) {
              console.error("Error deleting inventario:", error);
            }
          }
        }
      ]
    );
  };

  const handleNavigateToCajas = (id: string, nombre: string) => {
    setPrendas([]); 
    navigation.navigate('Cajas', { 
      inventarioId: id, 
      nombreInventario: nombre 
    });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <Navbar title="Lotes de Trabajo" />
        
        {loading ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
            <FlatList
              data={inventarios}
              renderItem={({ item }) => (
                <InventarioCard 
                  item={item}
                  theme={currentTheme}
                  onPress={() => handleNavigateToCajas(item.id, item.nombre)}
                  onEdit={() => openEditForm(item)}
                  onDelete={() => deleteInventario(item.id, item.nombre)}
                />
              )}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.card }]}>
                    <Ionicons name="cube-outline" size={80} color={currentTheme.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>¡Lotes Vacíos!</Text>
                  <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                    Parece que aún no has creado inventarios. Toca el botón + para comenzar.
                  </Text>
                </View>
              }
              removeClippedSubviews={Platform.OS === 'android'}
            />
          </View>
        )}

        <FloatingButton onPress={openAddForm} />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 18, paddingBottom: 100 },
  card: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDesc: {
    fontSize: 14,
    marginBottom: 18,
    lineHeight: 20,
  },
  progressSection: {
    marginTop: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginBottom: 16,
    marginHorizontal: 8,
    elevation: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Dimensions.get('window').height * 0.15,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
});

export default InventariosScreen;