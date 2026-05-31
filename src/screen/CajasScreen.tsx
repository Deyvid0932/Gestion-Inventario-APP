import React, { useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Animated as RNAnimated,
  Platform,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Caja } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { SkeletonLoader } from '../components/SkeletonLoader';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams
} from 'react-native-draggable-flatlist';
import { Swipeable, GestureHandlerRootView, RectButton } from 'react-native-gesture-handler';
import { CajaService } from '../services/CajaService';

type CajasRouteProp = RouteProp<RootStackParamList, 'Cajas'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

interface CajaWithStats extends Caja {
  itemCount: number;
}

const CajaCard = memo(({
  item,
  onPress,
  onEdit,
  onDelete,
  theme,
  drag,
  isActive
}: {
  item: CajaWithStats,
  onPress: () => void,
  onEdit: () => void,
  onDelete: () => void,
  theme: any,
  drag: () => void,
  isActive: boolean
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const renderRightActions = (progress: any) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [160, 0],
    });


    return (
      <View style={styles.swipeActionsContainer}>
        <RNAnimated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#3498db' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit();
            }}
          >
            <Ionicons name="pencil-outline" size={24} color="#FFF" />
          </RectButton>
        </RNAnimated.View>
        <RNAnimated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
          <RectButton
            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
            onPress={() => {
              swipeableRef.current?.close();
              onDelete();
            }}
          >
            <Ionicons name="trash-outline" size={24} color="#FFF" />
          </RectButton>
        </RNAnimated.View>
      </View>
    );
  };

  return (
    <ScaleDecorator>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={3}
        rightThreshold={30}
        enabled={!isActive}
      >
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={300}
          disabled={isActive}
          onPress={onPress}
          activeOpacity={0.9}
          style={[
            styles.card,
            {
              backgroundColor: isActive ? theme.primary + '20' : theme.card,
              borderColor: isActive ? theme.primary : theme.border,
            }
          ]}
        >
          <View style={styles.cardMain}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="archive" size={26} color={theme.primary} />
            </View>

            <View style={styles.textContainer}>
              <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.nombre}</Text>
              <View style={styles.cardFooter}>
                <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                  {new Date(item.fechaCreacion).toLocaleDateString()}
                </Text>
                <Text style={[styles.dot, { color: theme.textSecondary }]}>•</Text>
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>{item.itemCount} prendas</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </ScaleDecorator>
  );
});

const CajasScreen = () => {
  const route = useRoute<CajasRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { inventarioId, nombreInventario } = route.params;
  const db = useSQLiteContext();
  const { currentTheme } = useAppStore();

  const [cajas, setCajas] = useState<CajaWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCajas = useCallback(async () => {
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
    }
  }, [db, inventarioId]);

  useFocusEffect(
    useCallback(() => {
      fetchCajas();
    }, [fetchCajas])
  );

  const handleDragEnd = useCallback(async ({ data }: { data: CajaWithStats[] }) => {
    setCajas(data);
    
    try {
      const newOrderings = data.map((item, index) => ({
        id: item.id,
        orden: index
      }));
      await CajaService.updateCajasOrder(db, newOrderings);
    } catch (error) {
      console.error("Error updating order:", error);
    } 
  }, [db]);

  const handleNavigateToPrendas = (cajaId: string, nombreCaja: string) => {
    useAppStore.getState().setPrendas([]);
    navigation.navigate('ExcelGrid', {
      cajaId,
      nombreCaja
    });
  };

  const openAddForm = () => {
    navigation.navigate('Form', {
      mode: 'NAME_ONLY',
      entityType: 'caja',
      parentId: inventarioId
    });
  };

  const openEditForm = useCallback((item: CajaWithStats) => {
    navigation.navigate('Form', {
      mode: 'NAME_ONLY',
      entityType: 'caja',
      initialData: { id: item.id, nombre: item.nombre }
    });
  }, [navigation]);

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
              fetchCajas();
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  }, [db, fetchCajas]);

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<CajaWithStats>) => (
    <CajaCard
      item={item}
      theme={currentTheme}
      onPress={() => handleNavigateToPrendas(item.id, item.nombre)}
      onEdit={() => openEditForm(item)}
      onDelete={() => deleteCaja(item.id, item.nombre)}
      drag={drag}
      isActive={isActive}
    />
  ), [currentTheme, navigation, openEditForm, deleteCaja]);

  const showSkeleton = loading && cajas.length === 0;



  return (

    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <Navbar title={nombreInventario} showBackButton />

      <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
        {showSkeleton ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <DraggableFlatList
            data={cajas}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            onDragEnd={handleDragEnd}
            contentContainerStyle={styles.listContent}
            activationDistance={20}
            containerStyle={{ flex: 1 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.card }]}>
                  <Ionicons name="cube" size={80} color={currentTheme.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>¡Lotes Vacíos!</Text>
                <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                  Parece que aún no has creado cajas. Toca el botón + para comenzar.
                </Text>
              </View>
            }
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}
      </View>

      <FloatingButton onPress={openAddForm} style={styles.floatingButton} />

    </GestureHandlerRootView>

  );
};

const styles = StyleSheet.create({
  listContent: { padding: 18, paddingBottom: 100 },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  swipeActionsContainer: {
    width: 160,
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 140,
    paddingHorizontal: 40,
  },
  emptyIconBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.7,
  },
  floatingButton: {
    bottom: 80,
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
  }

});

export default CajasScreen;