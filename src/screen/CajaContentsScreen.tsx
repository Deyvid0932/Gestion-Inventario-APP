// src/screen/CajaContentsScreen.tsx new file ContentCaja
import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Pressable,

} from 'react-native';
import { RouteProp, useRoute, useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Prenda } from '../types';
import { Navbar } from '../components/Navbar';
import { useAppStore } from '../store/useAppStore';
import { PrendaCard } from '../components/PrendaCard';
import { usePrenda } from '../hooks/usePrenda';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { SearchBar } from '../components/SearchBar';
import { processOCRText } from '../utils/ocrParser';


type ExcelGridRouteProp = RouteProp<RootStackParamList, 'ExcelGrid'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

const CajaContentsScreen = () => {
  const route = useRoute<ExcelGridRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { cajaId, nombreCaja } = route.params;
  const db = useSQLiteContext();
  const [search, setSearch] = useState('');

  const { toggleStatus: togglePrendaStatus } = usePrenda();

  const {
    prendas,
    setPrendas,
    currentTheme,
    selectedPrendas,
    toggleSelectPrenda,
    clearSelectedPrendas,
  } = useAppStore();

  const fetchPrendas = useCallback(async () => {
    try {
      const query = 'SELECT * FROM prendas WHERE cajaId = ? AND (op LIKE ? OR estilo LIKE ?) ORDER BY id DESC';
      const searchParam = `%${search}%`;
      const result = await db.getAllAsync<Prenda>(query, [cajaId, searchParam, searchParam]);
      setPrendas(result);
    } catch (error) {
      console.error("Error fetching prendas:", error);
    }
  }, [db, cajaId, setPrendas, search]);

  useFocusEffect(
    useCallback(() => {
      fetchPrendas();
      return () => clearSelectedPrendas();
    }, [fetchPrendas, clearSelectedPrendas])
  );

  const handleToggleStatus = (prenda: Prenda) => {
    const nuevoEstado = Number(prenda.estado) === 1 ? 'Inactivo' : 'Activo';
    Alert.alert(
      "Confirmar cambio",
      `¿Estás seguro de que deseas marcar esta prenda como ${nuevoEstado}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => togglePrendaStatus(prenda.id)
        }
      ]
    );
  };

  const handleItemPress = (item: Prenda) => {
    if (selectedPrendas.length > 0) {
      toggleSelectPrenda(item.id);
    } else {
      // Navegación para editar la prenda
      navigation.navigate('Form', {
        mode: 'ADVANCED',
        entityType: 'prenda',
        parentId: cajaId,
        initialData: item
      });
    }
  };

  const handleItemLongPress = (item: Prenda) => {
    toggleSelectPrenda(item.id);
  };

  const openAddForm = () => {
    navigation.navigate('Form', {
      mode: 'ADVANCED',
      entityType: 'prenda',
      parentId: cajaId
    });
  };

  const renderItem = ({ item }: { item: Prenda }) => {
    const isSelected = selectedPrendas.includes(item.id);

    return (
      <PrendaCard
        prenda={item}
        onToggleStatus={() => handleToggleStatus(item)}
        onLongPress={() => handleItemLongPress(item)}
        isSelected={isSelected}
        onSelect={() => handleItemPress(item)}
        delayLongPress={300}
      />
    );
  };

  

  const handleCameraScan = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Se requieren permisos de cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        const recognized = await TextRecognition.recognize(result.assets[0].uri);
        const listaExtraida = processOCRText(recognized.text, cajaId);

        if (listaExtraida.length === 0) {
          return Alert.alert('OCR Incompleto', 'No se detectaron datos en la imagen.');
        }

        Alert.alert(
          'Tabla Detectada',
          `Se encontraron ${listaExtraida.length} registros. ¿Deseas guardarlos en esta caja?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Guardar Todo',
              onPress: async () => {
                for (const prenda of listaExtraida) {
                  await db.runAsync(
                    'INSERT INTO prendas (id, cajaId, estilo, color, estado) VALUES (?, ?, ?, ?, ?)', //op ,?
                    [prenda.id, prenda.cajaId, prenda.estilo, prenda.color, 1] // prenda.op,
                  );
                }
                fetchPrendas();
                Alert.alert('Éxito', 'Inventario actualizado correctamente.');
              }
            }
          ]
        );

      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Fallo al procesar imagen');
      }
    }
  };


  const deletePrenda = async (_id: string, op: string) => {
    Alert.alert(
      "Eliminar Prenda",
      `¿Estás seguro de que deseas eliminar la prenda de la caja " ${nombreCaja} "?`,
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
              fetchPrendas();
              clearSelectedPrendas();
            } catch (error) {
              console.error("Error deleting prenda:", error);
            }
          }
        }
      ]
    );
  };

  
  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title={`Caja: ${nombreCaja}`} showBackButton />

      <View style={styles.actionRow}>
        {selectedPrendas.length > 0 ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#e74c3c', flex: 1 }]}
              onPress={() =>
                deletePrenda(cajaId, nombreCaja)}
            >
              <Ionicons name="trash-outline" size={24} color="#FFF" />
              <Text style={styles.actionButtonText}>Eliminar ({selectedPrendas.length})</Text>
            </TouchableOpacity>
          </>
        ) : (

          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
              onPress={openAddForm}
            >
              <Ionicons name="add-circle-outline" size={24} color="#FFF" />
              <Text style={styles.actionButtonText}>Nuevo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: currentTheme.primary }]}
              onPress={handleCameraScan}
            >
              <Ionicons name="camera" size={24} color="#FFF" />
              <Text style={styles.actionButtonText}>OCR</Text>
            </TouchableOpacity>
          </>
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

      <Pressable style={{ flex: 1 }} onPress={clearSelectedPrendas}>
      <FlatList
        data={prendas}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: 130, // Altura estimada del PrendaCard
          offset: 130 * index,
          index,
        })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="archive-outline" size={64} color={currentTheme.textSecondary} />
            <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>No hay prendas en esta caja.</Text>
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
    height: 55,
    borderRadius: 10,
    gap: 8,
    elevation: 3,
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
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 1,
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  scanText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 15,
  },
  searchBarWrapper: {
    flex: 1,
  },
  exportBtn: {
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
});



export default CajaContentsScreen;
