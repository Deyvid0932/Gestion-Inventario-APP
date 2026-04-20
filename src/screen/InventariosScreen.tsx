import React, { useState, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Inventario } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const InventariosScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const db = useSQLiteContext();
  const { currentTheme } = useAppStore();
  
  const [inventarios, setInventarios] = useState<Inventario[]>([]);

  const fetchInventarios = async () => {
    try {
      const result = await db.getAllAsync<Inventario>('SELECT * FROM inventarios ORDER BY fechaCreacion DESC');
      setInventarios(result);
    } catch (error) {
      console.error("Error fetching inventarios:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInventarios();
    }, [db])
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

  const deleteInventario = async (id: string, nombre: string) => {
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

  const renderItem = ({ item }: { item: Inventario }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
      onPress={() => navigation.navigate('Cajas', { 
        inventarioId: item.id, 
        nombreInventario: item.nombre 
      })}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: currentTheme.text }]}>{item.nombre}</Text>
        <View style={styles.headerRight}>
          <View style={[styles.badge, { backgroundColor: item.estado === 'Activo' ? currentTheme.primary : currentTheme.border }]}>
              <Text style={styles.badgeText}>{item.estado}</Text>
          </View>
          <TouchableOpacity onPress={() => openEditForm(item)} style={styles.iconButton}>
             <Ionicons name="pencil-outline" size={20} color="#3498db" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteInventario(item.id, item.nombre)} style={styles.iconButton}>
             <Ionicons name="trash-outline" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.cardDesc, { color: currentTheme.textSecondary }]} numberOfLines={2}>
        {item.descripcion || 'Sin descripción'}
      </Text>
      <View style={styles.cardFooter}>
        <Ionicons name="calendar-outline" size={14} color={currentTheme.textSecondary} />
        <Text style={[styles.dateText, { color: currentTheme.textSecondary }]}>
          {new Date(item.fechaCreacion).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Lotes de Trabajo" />
      
      <FlatList
        data={inventarios}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>No hay lotes creados.</Text>}
      />

      <FloatingButton onPress={openAddForm} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 15,
  },
  card: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 10,
    padding: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardDesc: {
    fontSize: 14,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    marginLeft: 5,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});
