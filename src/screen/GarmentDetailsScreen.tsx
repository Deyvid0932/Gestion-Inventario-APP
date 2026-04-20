import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, Alert, Pressable } from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, DetallePrenda } from '../types';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { DetallePrendaCard } from '../components/DetallePrendaCard';
import { useDetallePrenda } from '../hooks/useDetallePrenda';
import { SearchBar } from '../components/SearchBar';

type GarmentDetailsRouteProp = RouteProp<RootStackParamList, 'GarmentDetails'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const GarmentDetailsScreen = () => {
  const route = useRoute<GarmentDetailsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const params = route.params || {};
  const nombrePrenda = params.nombreCaja || "No seleccionada";
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');
  
  const { 
    toggleStatus: toggleDetallePrendaStatus, 
    deleteSelected: deleteDetallesPrenda 
  } = useDetallePrenda();

  const {
    detallesPrenda,
    setDetallesPrenda,
    currentTheme,
    selectedPrendas,
    toggleSelectPrenda,
    clearSelectedDetallesPrenda
  } = useAppStore();

  const fetchPrendas = async () => {
    
    try {
      const result = 
        ('SELECT * FROM detalles_prendas WHERE (op LIKE ? OR estilo LIKE ? )');
        const searchParam = `%${search}%`;
        const rows = await db.getAllAsync<DetallePrenda>(result, [searchParam, searchParam])
        
      setDetallesPrenda(rows);
    } catch (error) {
      console.error("Error fetching prendas:", error);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchPrendas();
    }, [db, search])
  );

  const handleToggleStatus = (detalle: DetallePrenda) => {
    const nuevoEstado = Number(detalle.estado) === 1 ? 'Inactivo' : 'Activo';
    Alert.alert(
      "Confirmar cambio",
      `¿Estás seguro de que deseas marcar esta prenda como ${nuevoEstado}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => toggleDetallePrendaStatus(detalle.id)
        }
      ]
    );
  };

  const openAddForm = () => {
    navigation.navigate('Form', {
      mode: 'ADVANCED_LITE',
      entityType: 'detalle_prenda',
    });
  };

  const openEditForm = (detallePrenda: DetallePrenda) => {
    navigation.navigate('Form', {
      mode: 'ADVANCED_LITE',
      entityType: 'detalle_prenda',
      initialData: detallePrenda
    });
  };

  const renderItem = ({ item }: { item: DetallePrenda }) => (
    <DetallePrendaCard
      detallePrenda={item}
      onToggleStatus={() => handleToggleStatus(item)}
      onLongPress={() => toggleSelectPrenda(item.id)}
      isSelected={selectedPrendas.includes(item.id)}
      onSelect={() => openEditForm(item)}
    />
  );

  const handleDeleteSelected = () => {
    if (selectedPrendas.length === 0) return;
    Alert.alert(
      "Eliminar Prendas",
      `¿Estás seguro de que deseas eliminar ${selectedPrendas.length} prendas de la caja "${nombrePrenda}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            await deleteDetallesPrenda();
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title={`Registro:`} showBackButton />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
          onPress={openAddForm}
        >
          <Ionicons name="add-circle-outline" size={24} color="#FFF" />
          <Text style={styles.actionButtonText}>Nueva Prenda</Text>
        </TouchableOpacity>

        {selectedPrendas.length > 0 && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#e74c3c' }]}
            onPress={handleDeleteSelected}
          >
            <Ionicons name="trash-outline" size={24} color="#FFF" />
            <Text style={styles.actionButtonText}>Borrar ({selectedPrendas.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por OP o Estilo..."
          />
        </View>
      </View>

      <Pressable style={{ flex: 1 }} onPress={clearSelectedDetallesPrenda}>
        <FlatList
          data={detallesPrenda}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={64} color={currentTheme.textSecondary} />
              <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>No hay prendas en este registro.</Text>
            </View>
          }
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  listContent: {
    padding: 15,
    paddingTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  searchBarWrapper: {
    flex: 1,
  }
});

export default GarmentDetailsScreen;
