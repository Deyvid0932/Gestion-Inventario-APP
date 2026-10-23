import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoleGuard } from '../components';
import { EmptyState } from '../components';
import { useTrashScreen } from '../hooks';

export const TrashScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    state: { activeTab, items, loading, processingId },
    computed: { currentTheme, counts, displayedItems },
    handlers: {
      setActiveTab,
      handleRestore,
      handlePermanentDelete,
      computeRemainingTime,
      getEntityIcon,
      getEntityName,
      goBack,
    },
  } = useTrashScreen();

  return (
    <RoleGuard roles={['Admin']}>
      <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
        <StatusBar barStyle="light-content" backgroundColor={currentTheme.background} />

        {/* Header Pantalla Completa */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: currentTheme.text }]}>Papelera de Reciclaje</Text>
            <Text style={[styles.subtitle, { color: currentTheme.textSecondary }]}>
              {items.length} elemento{items.length !== 1 ? 's' : ''} en papelera (retención 48h)
            </Text>
          </View>
        </View>

        {/* Barra de Pestañas: [ Inventarios ] [ Cajas ] [ Prendas ] */}
        <View style={[styles.tabBar, { backgroundColor: currentTheme.card, borderBottomColor: currentTheme.border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'inventories' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
            onPress={() => setActiveTab('inventories')}
          >
            <Ionicons
              name="file-tray-stacked-outline"
              size={16}
              color={activeTab === 'inventories' ? currentTheme.primary : currentTheme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabLabel, { color: activeTab === 'inventories' ? currentTheme.primary : currentTheme.textSecondary }]}>
              Lotes ({counts.inventories})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'boxes' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
            onPress={() => setActiveTab('boxes')}
          >
            <Ionicons
              name="archive-outline"
              size={16}
              color={activeTab === 'boxes' ? currentTheme.primary : currentTheme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabLabel, { color: activeTab === 'boxes' ? currentTheme.primary : currentTheme.textSecondary }]}>
              Cajas ({counts.boxes})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'garments' && { backgroundColor: currentTheme.primary + '25', borderColor: currentTheme.primary }]}
            onPress={() => setActiveTab('garments')}
          >
            <Ionicons
              name="shirt-outline"
              size={16}
              color={activeTab === 'garments' ? currentTheme.primary : currentTheme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabLabel, { color: activeTab === 'garments' ? currentTheme.primary : currentTheme.textSecondary }]}>
              Prendas ({counts.garments})
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={currentTheme.primary} />
            <Text style={{ color: currentTheme.textSecondary, marginTop: 12 }}>Cargando papelera...</Text>
          </View>
        ) : displayedItems.length === 0 ? (
          <EmptyState
            iconName="trash-outline"
            title={`Sin ${activeTab === 'inventories' ? 'Lotes' : activeTab === 'boxes' ? 'Cajas' : 'Prendas'} en Papelera`}
            description={`No hay ${activeTab === 'inventories' ? 'lotes' : activeTab === 'boxes' ? 'cajas' : 'prendas'} eliminados en este apartado.`}
            currentTheme={currentTheme}
            delay={100}
          />
        ) : (
          <FlatList
            data={displayedItems}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: currentTheme.primary + '20' }]}>
                    <Ionicons name={getEntityIcon(item.tableName) as any} size={22} color={currentTheme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: currentTheme.text }]}>{item.title || getEntityName(item.tableName)}</Text>
                    <Text style={[styles.cardSub, { color: currentTheme.textSecondary }]}>{getEntityName(item.tableName)} (ID: {item.recordId})</Text>
                    <Text style={[styles.cardDate, { color: '#F59E0B', fontWeight: '600' }]}>
                      ⏳ {computeRemainingTime(item.deletedAt)}
                    </Text>
                  </View>
                </View>

                {/* Acciones */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.btnRestore, { backgroundColor: currentTheme.primary + '15' }]}
                    onPress={() => handleRestore(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="refresh-outline" size={16} color={currentTheme.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.btnRestoreText, { color: currentTheme.primary }]}>Restaurar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnDelete, { backgroundColor: '#EF444415' }]}
                    onPress={() => handlePermanentDelete(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.btnDeleteText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>

                {processingId === item.id && (
                  <View style={styles.cardOverlay}>
                    <ActivityIndicator size="small" color={currentTheme.primary} />
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    </RoleGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
  },
  emptyTrashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  emptyTrashText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    position: 'relative',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 11,
    fontFamily: 'Platform',
    marginTop: 2,
  },
  cardDate: {
    fontSize: 11,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  btnRestore: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRestoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnDelete: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeleteText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
