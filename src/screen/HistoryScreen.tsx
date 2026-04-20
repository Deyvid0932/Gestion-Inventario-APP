import React, { useState, useCallback } from 'react';
import { 
  View, 
  FlatList, 
  Text, 
  StyleSheet, 
  TouchableOpacity 
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { Navbar } from '../components/Navbar';
import { SearchBar } from '../components/SearchBar';
import { useAppStore } from '../store/useAppStore';
import { exportToExcel } from '../utils/export';
import { Ionicons } from '@expo/vector-icons';

interface HistoryItem {
  id: string;
  cajaId: string;
  op: string;
  estilo: string;
  color: string;
  cajaNombre: string;
  inventarioNombre: string;
}

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const HistoryScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<NavigationProp>();
  const { currentTheme } = useAppStore();
  
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [results, setResults] = useState<HistoryItem[]>([]);

  const fetchHistory = async () => {
    try {
      const estadoDb = estado === 'Activo' ? 1 : 0;

      const query = `
        SELECT p.id, p.cajaId, p.op, p.estilo, p.color, p.estado, c.nombre as cajaNombre, i.nombre as inventarioNombre
        FROM prendas p
        JOIN cajas c ON p.cajaId = c.id
        JOIN inventarios i ON c.inventarioId = i.id
        WHERE p.estado = ? AND (p.op LIKE ? OR p.estilo LIKE ? )
        ORDER BY i.fechaCreacion DESC
      `;
      const searchParam = `%${search}%`;
      const rows = await db.getAllAsync<HistoryItem>(query, [estadoDb, searchParam, searchParam]);
      setResults(rows);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [db, search, estado])
  );

  const handleExport = () => {
    if (results.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    exportToExcel(results, `Historial_${estado}_${new Date().getTime()}`);
  };

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
      onPress={() => navigation.navigate('ExcelGrid', { 
        cajaId: item.cajaId, 
        nombreCaja: item.cajaNombre 
      })}
    >
      <View style={styles.cardHeader}>
         <View style={[styles.badge, { backgroundColor: currentTheme.primary }]}>
          <Text style={styles.badgeText}>Estilo: {item.estilo}</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: currentTheme.primary }]}>
          <Text style={styles.badgeText}>OP: {item.op}</Text>
        </View>

      </View>
      <Text style={[styles.color, { color: currentTheme.textSecondary }]}>Color: {item.color}</Text>
      <View style={styles.footer}>
        <Text style={[styles.location, { color: currentTheme.textSecondary }]}>
          Lote: {item.inventarioNombre} | Caja: {item.cajaNombre}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Historial" />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            estado === 'Activo' ? { backgroundColor: currentTheme.primary } : { backgroundColor: currentTheme.card }
          ]}
          onPress={() => setEstado('Activo')}
        >
          <Text style={[styles.tabText, { color: estado === 'Activo' ? '#FFF' : currentTheme.textSecondary }]}>Activos</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.tab, 
            estado === 'Inactivo' ? { backgroundColor: currentTheme.primary } : { backgroundColor: currentTheme.card }
          ]}
          onPress={() => setEstado('Inactivo')}
        >
          <Text style={[styles.tabText, { color: estado === 'Inactivo' ? '#FFF' : currentTheme.textSecondary }]}>Inactivos</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar 
            value={search} 
            onChangeText={setSearch} 
            placeholder="Buscar por OP o Estilo..." 
          />
        </View>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: currentTheme.primary }]} onPress={handleExport}>
          <Ionicons name="download-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>No se encontraron resultados.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  tabText: {
    fontWeight: 'bold',
  },
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
  listContent: {
    padding: 15,
  },
  card: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  estilo: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  color: {
    fontSize: 14,
    marginBottom: 10,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 8,
  },
  location: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  }
});
