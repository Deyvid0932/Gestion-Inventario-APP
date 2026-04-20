import React, { useState, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  Alert
} from 'react-native';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Caja } from '../types';
import { Navbar } from '../components/Navbar';
import { FloatingButton } from '../components/FloatingButton';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

type CajasRouteProp = RouteProp<RootStackParamList, 'Cajas'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 45) / 2;

const CajasScreen = () => {
  const route = useRoute<CajasRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { inventarioId, nombreInventario } = route.params;
  const db = useSQLiteContext();
  const { currentTheme } = useAppStore();
  
  const [cajas, setCajas] = useState<Caja[]>([]);

  const fetchCajas = async () => {
    try {
      const result = await db.getAllAsync<Caja>(
        'SELECT * FROM cajas WHERE inventarioId = ? ORDER BY fechaCreacion DESC', 
        [inventarioId]
      );
      setCajas(result);
    } catch (error) {
      console.error("Error fetching cajas:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCajas();
    }, [db, inventarioId])
  );

  const openAddForm = () => {
    navigation.navigate('Form', {
      mode: 'NAME_ONLY',
      entityType: 'caja',
      parentId: inventarioId
    });
  };

  const openEditForm = (item: Caja) => {
    navigation.navigate('Form', {
      mode: 'NAME_ONLY',
      entityType: 'caja',
      initialData: {
        id: item.id,
        nombre: item.nombre
      }
    });
  };

  const deleteCaja = async (id: string, nombre: string) => {
    Alert.alert(
      "Eliminar Caja",
      `¿Estás seguro de que deseas eliminar la caja "${nombre}"? Se borrarán todas las prendas que contiene.`,
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
              console.error("Error deleting caja:", error);
            }
          }
        }
      ]
    );
  };

  const renderCaja = ({ item }: { item: Caja }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
      onPress={() => navigation.navigate('ExcelGrid', { 
        cajaId: item.id, 
        nombreCaja: item.nombre 
      })}
    >
      <TouchableOpacity onPress={() => openEditForm(item)} style={styles.updateButton}>
          <Ionicons name="pencil-outline" size={20} color="#3498db" />
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.deleteButton} 
        onPress={() => deleteCaja(item.id, item.nombre)}
      >
        <Ionicons name="trash-outline" size={20} color="#e74c3c" />
      </TouchableOpacity>
      
      

      <View style={[styles.iconContainer, { backgroundColor: currentTheme.background }]}>
        <Ionicons name="cube-outline" size={32} color={currentTheme.primary} />
      </View>
      <Text style={[styles.cardTitle, { color: currentTheme.text }]}>{item.nombre}</Text>
        <Text style={[styles.dateText, { color: currentTheme.textSecondary }]}>
          {new Date(item.fechaCreacion).toLocaleDateString()}
        </Text>
    </TouchableOpacity>
    
  );

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title={`Cajas: ${nombreInventario}`} showBackButton />
      
      <FlatList
        data={cajas}
        renderItem={renderCaja}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>No hay cajas creadas.</Text>}
      />

      <FloatingButton 
      style={styles.floatingButton}
      onPress={openAddForm}
       />
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
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  card: {
    width: CARD_WIDTH,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    alignItems: 'center',
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 5,
    zIndex: 1,
  },
  updateButton: {
    position: 'absolute',
    top: 50,
    right: 10,
    padding: 5,
    zIndex: 1,
  },
  detailsButton: {
    position: 'absolute',
    top: 90,
    right: 10,
    padding: 5,
    zIndex: 1,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  }, 
  floatingButton:{
    top: 700,
    right: 20,
  },
  dateText: {
    fontSize: 12,
    marginLeft: 5,
  },
});

export default CajasScreen;
