import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, InventarioStats } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SkeletonLoader } from '../components/SkeletonLoader';
import InventarioCard from '../components/InventarioCard';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const InventariosScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const { currentTheme, setPrendas } = useAppStore();
  const [inventarios, setInventarios] = useState<InventarioStats[]>([]);
  const [loading, setLoading] = useState(true);
  const lastNavTime = React.useRef(0);

  const fetchInventarios = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
      fetchInventarios(inventarios.length === 0);
    }, [fetchInventarios, inventarios.length])
  );

  const navigateSafe = useCallback((routeName: keyof RootStackParamList, params?: any) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    navigation.navigate(routeName as any, params);
  }, [navigation]);

  const handleNavigateToCajas = (id: string, nombre: string) => {
    const now = Date.now();
    if (now - lastNavTime.current < 400) return;
    lastNavTime.current = now;
    
    setPrendas([]);
    navigation.navigate('Cajas', {
      inventarioId: id,
      nombreInventario: nombre
    });
  };

  const deleteInventario = async (id: string) => {
    try {
      await db.runAsync('DELETE FROM inventarios WHERE id = ?', [id]);
      fetchInventarios(false);
    } catch (error) {
      console.error("Error deleting inventario:", error);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <Navbar title="Lotes de Trabajo" />

        {loading ? (
          <SkeletonLoader theme={currentTheme} />
        ) : (
          <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
            <Reanimated.FlatList
              data={inventarios}
              itemLayoutAnimation={LinearTransition.springify()}
              renderItem={({ item }) => (
                <Reanimated.View exiting={FadeOut.duration(300)}>
                  <InventarioCard
                    item={item}
                    theme={currentTheme}
                    onPress={() => handleNavigateToCajas(item.id, item.nombre)}
                    onEdit={() => navigateSafe('Form', { mode: 'BASIC', entityType: 'inventario', initialData: { id: item.id, nombre: item.nombre, descripcion: item.descripcion || '' } })}
                    onDelete={() => deleteInventario(item.id)}
                  />
                </Reanimated.View>
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Reanimated.View
                  style={styles.emptyContainer}
                  entering={FadeIn.duration(400)} 
                >
                  <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIconCircle, { backgroundColor: currentTheme.card }]}>
                      <Ionicons name="cube-outline" size={80} color={currentTheme.primary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>¡Lotes Vacíos!</Text>
                    <Text style={[styles.emptySubtitle, { color: currentTheme.textSecondary }]}>
                      Parece que aún no has creado inventarios. Toca el botón + para comenzar.
                    </Text>
                  </View>
                </Reanimated.View>
              }
            />
          </View>
        )}

        <FloatingButton onPress={() => navigateSafe('Form', { mode: 'BASIC', entityType: 'inventario' })} />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    padding: 18,
    paddingBottom: 100,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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