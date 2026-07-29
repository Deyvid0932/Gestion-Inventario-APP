import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
  useWindowDimensions
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, HistoryItem } from '../types';
import { Navbar } from '../components/Navbar';
import { clayStyles } from '../style/theme';
import { SearchBar } from '../components/SearchBar';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { getColorHex } from '../utils/colorUtils';
import { ExportModal } from '../components/ExportModal';

const getRelativeDateLabel = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();

  const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = dNow.getTime() - dDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';

  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const HistoryScreen = () => {
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const { width } = useWindowDimensions();
  const [showExportModal, setShowExportModal] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'Activo' | 'Inactivo' | 'Alarmas'>('Activo');
  const [results, setResults] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchHistory = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      fadeAnim.setValue(0);
    }
    try {
      const searchParam = `%${search}%`;
      const startParam = `${search}%`;
      const exactParam = search;

      const userClause = '';

      let query = '';
      let params: any[] = [];

      if (status === 'Alarmas') {
        query = `
          SELECT p.id, p.cajaId, p.op, p.estilo, p.color, p.estado, p.fechaCreacion, p.alarmaFechaHora,
                 c.nombre as cajaNombre, i.nombre as inventarioNombre
          FROM prendas p
          JOIN cajas c ON p.cajaId = c.id
          JOIN inventarios i ON c.inventarioId = i.id
          WHERE p.alarmaFechaHora IS NOT NULL AND (p.op LIKE ? OR p.estilo LIKE ? OR p.color LIKE ?) ${userClause}
          ORDER BY p.alarmaFechaHora ASC
        `;
        params = [searchParam, searchParam, searchParam];
      } else {
        const estadoDb = status === 'Activo' ? 1 : 0;
        query = `
          SELECT p.id, p.cajaId, p.op, p.estilo, p.color, p.estado, p.fechaCreacion, p.alarmaFechaHora,
                 c.nombre as cajaNombre, i.nombre as inventarioNombre
          FROM prendas p
          JOIN cajas c ON p.cajaId = c.id
          JOIN inventarios i ON c.inventarioId = i.id
          WHERE p.estado = ? AND (p.op LIKE ? OR p.estilo LIKE ? OR p.color LIKE ?) ${userClause}
          ORDER BY 
            (CASE 
              WHEN p.op = ? OR p.estilo = ? OR p.color = ? THEN 0
              WHEN p.op LIKE ? OR p.estilo LIKE ? OR p.color LIKE ? THEN 1
              ELSE 2
            END), p.fechaCreacion DESC
        `;
        params = [
          estadoDb, searchParam, searchParam, searchParam,
          exactParam, exactParam, exactParam,
          startParam, startParam, startParam
        ];
      }

      const rows = await db.getAllAsync<HistoryItem>(query, params);
      setResults(rows);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
      if (showLoading) {
        setTimeout(() => setLoading(false), 200);
      } else {
        setLoading(false);
      }
    }
  };

  useFocusEffect(useCallback(() => { fetchHistory(); }, [db, search, status]));

  const toggleStatus = (newStatus: 'Activo' | 'Inactivo' | 'Alarmas') => {
    setStatus(newStatus);
    const targetVal = newStatus === 'Activo' ? 0 : (newStatus === 'Inactivo' ? 1 : 2);
    Animated.spring(tabAnim, { toValue: targetVal, useNativeDriver: false }).start();
  };

  const renderItem = ({ item, index }: { item: HistoryItem, index: number }) => {
    const dateToUse = status === 'Alarmas' ? (item.alarmaFechaHora || item.fechaCreacion || new Date().toISOString()) : (item.fechaCreacion || new Date().toISOString());
    const itemDateLabel = getRelativeDateLabel(dateToUse);

    const prevItem = index > 0 ? results[index - 1] : null;
    const prevDateToUse = prevItem ? (status === 'Alarmas' ? (prevItem.alarmaFechaHora || prevItem.fechaCreacion) : prevItem.fechaCreacion) : null;
    const prevDateLabel = prevDateToUse ? getRelativeDateLabel(prevDateToUse) : null;

    const showHeader = itemDateLabel !== prevDateLabel;
    const colorHex = getColorHex(item.color);

    return (
      <View>
        {showHeader && (
          <View style={styles.dateHeader}>
            <Text style={[styles.dateHeaderText, { color: currentTheme.primary }]}>
              {status === 'Alarmas' ? `Alarma: ${itemDateLabel}` : itemDateLabel}
            </Text>
          </View>
        )}
        <View style={styles.timelineRow}>
          <View style={styles.timelineCol}>
            <View style={[styles.timelineDot, { backgroundColor: status === 'Alarmas' ? '#EAB308' : currentTheme.primary }]} />
            <View style={[styles.timelineLine, { backgroundColor: currentTheme.border }]} />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.card, clayStyles, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.borderShadow || '#000' }]}
            onPress={() => {
              const rootNav = (navigation.getParent() as any) || navigation;
              rootNav.navigate('ExcelGrid', { cajaId: item.cajaId, nombreCaja: item.cajaNombre, targetPrendaId: item.id });
            }}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badgeContainer}>
                <View style={[styles.compactBadge, { backgroundColor: currentTheme.primary + '15' }]}>
                  <Text style={[styles.compactBadgeText, { color: currentTheme.primary }]}>{item.estilo}</Text>
                </View>
                <Text style={[styles.opText, { color: currentTheme.textSecondary }]}>
                  {item.op ? item.op : 'Sin OP'}
                </Text>

                {status === 'Alarmas' && item.alarmaFechaHora && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAB30815', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 4 }}>
                    <Ionicons name="notifications-outline" size={11} color="#EAB308" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#EAB308' }}>
                      {new Date(item.alarmaFechaHora).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {new Date(item.alarmaFechaHora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: colorHex, borderColor: currentTheme.border }]} />
            </View>

            <Text style={[styles.locationText, { color: '#2ecc71' }]}>
              {item.inventarioNombre} • {item.cajaNombre} • {item.color}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const tabCount = 3;
  const containerPaddingH = 4;
  const containerMarginH = 18;
  const containerBorderW = 1;
  const innerWidth = width - (containerMarginH * 2) - (containerBorderW * 2) - (containerPaddingH * 2);
  const tabWidth = innerWidth / tabCount;
  const tabTranslateX = tabAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      containerPaddingH,
      containerPaddingH + tabWidth,
      containerPaddingH + tabWidth * 2,
    ],
  });

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar title="Historial" />

      <View style={[styles.segmentedWrapper, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
        <Animated.View style={[styles.segmentIndicator, { backgroundColor: themeMode === 'light' ? "#E4E4E7" : "#27272A", width: tabWidth, transform: [{ translateX: tabTranslateX }] }]} />
        <TouchableOpacity style={styles.segmentTab} onPress={() => toggleStatus('Activo')}>
          <Text style={[styles.segmentText, { color: status === 'Activo' ? '#2ecc71' : currentTheme.textSecondary, fontWeight: status === 'Activo' ? '800' : '600' }]}>Activos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.segmentTab} onPress={() => toggleStatus('Inactivo')}>
          <Text style={[styles.segmentText, { color: status === 'Inactivo' ? '#e74c3c' : currentTheme.textSecondary, fontWeight: status === 'Inactivo' ? '800' : '600' }]}>Inactivos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.segmentTab} onPress={() => toggleStatus('Alarmas')}>
          <Text style={[styles.segmentText, { color: status === 'Alarmas' ? '#EAB308' : currentTheme.textSecondary, fontWeight: status === 'Alarmas' ? '800' : '600' }]}>Alarmas</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBarWrapper}><SearchBar value={search} onChangeText={setSearch} placeholder="Buscar..." /></View>
        <TouchableOpacity style={[styles.exportBtn, { backgroundColor: currentTheme.primary }]} onPress={() => setShowExportModal(true)}>
          <Ionicons name="document-text" size={22} color={currentTheme.primaryText} />
        </TouchableOpacity>
      </View>

      {loading ? <SkeletonLoader theme={currentTheme} /> : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            key={`history-${themeMode}`}
            extraData={themeMode}
            style={{ flex: 1 }}
            data={results}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            getItemLayout={(_, index) => ({ length: 142, offset: 142 * index, index })}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(false); }} tintColor={currentTheme.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name={status === 'Activo' ? "checkmark-circle-outline" : "close-circle-outline"} size={80} color={currentTheme.border} />
                <Text style={[styles.emptyText, { color: currentTheme.textSecondary }]}>
                  No hay prendas {status.toLowerCase()}s
                </Text>
              </View>
            }
          />
        </Animated.View>
      )}
      <ExportModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={results}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  segmentedWrapper: { flexDirection: 'row', margin: 18, height: 46, borderRadius: 12, borderWidth: 1, padding: 4, alignItems: 'center' },
  segmentIndicator: { position: 'absolute', height: 38, borderRadius: 10 },
  segmentTab: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  segmentText: { fontWeight: '700', fontSize: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 18, marginBottom: 5 },
  searchBarWrapper: { flex: 1 },
  exportBtn: { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  listContent: {
    padding: 18,
    paddingBottom: 40,
    flexGrow: 1,
  },
  dateHeader: { marginBottom: 10, marginTop: 15 },
  dateHeaderText: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  timelineRow: { flexDirection: 'row', gap: 12 },
  timelineCol: { alignItems: 'center', width: 16 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 24 },
  timelineLine: { flex: 1, width: 1.5, marginTop: -10, marginBottom: -20 },
  card: { flex: 1, padding: 18, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  compactBadgeText: { fontSize: 12, fontWeight: '800' },
  opText: { fontSize: 12, fontWeight: '500' },
  colorSwatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  locationText: { fontSize: 14, fontWeight: '500', fontStyle: 'italic' },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5
  },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 15 },
});