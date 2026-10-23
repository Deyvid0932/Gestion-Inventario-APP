import React from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
  useWindowDimensions,
  Platform
} from 'react-native';
import { HistoryItem } from '../types';
import { Navbar } from '../components';
import { clayStyles } from '../styles/theme';
import { SearchBar } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonLoader } from '../components';
import { getColorHex } from '../utils/colorUtils';
import { ExportModal } from '../components';
import { EmptyState } from '../components';
import { useHistoryScreen, getRelativeDateLabel } from '../hooks';

export const HistoryScreen = () => {
  const { width } = useWindowDimensions();
  const {
    state: { search, status, results, loading, refreshing, showExportModal },
    computed: { currentTheme, themeMode },
    refs: { tabAnim, fadeAnim },
    handlers: { setSearch, toggleStatus, setShowExportModal, onRefresh, navigateToDetail },
  } = useHistoryScreen();

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

  const renderItem = ({ item, index }: { item: HistoryItem; index: number }) => {
    const dateToUse = status === 'Alarmas'
      ? (item.alarm_datetime || item.created_at || new Date().toISOString())
      : (item.created_at || new Date().toISOString());
    const itemDateLabel = getRelativeDateLabel(dateToUse);
    const shippingDate = item.shipping_at ? new Date(item.shipping_at) : null;
    const shippingLabel = shippingDate && Number.isFinite(shippingDate.getTime())
      ? `${shippingDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} | ${shippingDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
      : null;

    const prevItem = index > 0 ? results[index - 1] : null;
    const prevDateToUse = prevItem
      ? (status === 'Alarmas' ? (prevItem.alarm_datetime || prevItem.created_at) : prevItem.created_at)
      : null;
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
            onPress={() => navigateToDetail(item)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badgeContainer}>
                <View style={[styles.compactBadge, { backgroundColor: currentTheme.primary + '15' }]}>
                  <Text style={[styles.compactBadgeText, { color: currentTheme.primary }]}>{item.style}</Text>
                </View>
                <Text style={[styles.opText, { color: currentTheme.textSecondary }]}>
                  {item.op ? item.op : 'Sin OP'}
                </Text>

                {status === 'Alarmas' && item.alarm_datetime && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EAB30815', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 4 }}>
                    <Ionicons name="notifications-outline" size={11} color="#EAB308" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#EAB308' }}>
                      {new Date(item.alarm_datetime).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} {new Date(item.alarm_datetime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.colorSwatch, { backgroundColor: colorHex, borderColor: currentTheme.border }]} />
            </View>

            <Text style={[styles.locationText, { color: '#2ecc71' }]}>
              {item.inventory_name || 'Inventario'} • {item.box_name || 'Caja'} • {item.color}
            </Text>
            {shippingLabel && (
              <Text style={[styles.opText, { color: currentTheme.textSecondary, marginTop: 3, fontWeight: '700' }]} numberOfLines={1}>
                ✓✓ Enviado · {shippingLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 60 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={currentTheme.primary}
                colors={[currentTheme.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                iconName={status === 'Activo' ? "checkmark-circle-outline" : (status === 'Inactivo' ? "close-circle-outline" : "alarm-outline")}
                title={`No hay prendas ${status.toLowerCase()}s`}
                description={`No se encontraron resultados para la búsqueda o filtro actual.`}
                currentTheme={currentTheme}
                delay={200}
              />
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
});
