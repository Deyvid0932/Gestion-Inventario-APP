import React, { useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Navbar, SkeletonLoader, InventoryCard, EmptyState } from '../components';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { InventoryStats } from '../types';
import { useInventoriesScreen } from '../hooks';

export const InventoriesScreen = () => {
  const { state, computed, handlers } = useInventoriesScreen();
  const { loading, refreshing, isDragging, search } = state;
  const { currentTheme, themeMode, canEdit, filteredInventories } = computed;
  const {
    setSearch,
    handleRefreshOrSync,
    handleDragEnd,
    setIsDragging,
    handleCardPress,
    handleCardEdit,
    deleteInventory,
    handleCreateInventory,
  } = handlers;

  const isSearchActive = search.trim().length > 0;
  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<InventoryStats>) => (
    <InventoryCard
      item={item}
      theme={currentTheme}
      canEdit={canEdit}
      drag={!isSearchActive ? drag : undefined}
      isActive={isActive}
      onPress={() => handleCardPress(item.id, item.name || (item as any).nombre, item.totalBoxes)}
      onEdit={() => handleCardEdit(item.id, item.name || (item as any).nombre, item.description || (item as any).descripcion || '')}
      onDelete={() => deleteInventory(item.id)}
    />
  ), [currentTheme, canEdit, isSearchActive, handleCardPress, handleCardEdit, deleteInventory]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
        <Navbar title="Lotes de Trabajo" />

        {/* BARRA SUPERIOR: BUSCADOR + BOTÓN NUEVO */}
        <View style={styles.topActionsBar}>
          <View style={[styles.searchContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
            <Ionicons name="search-outline" size={18} color={currentTheme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.text }]}
              placeholder="Buscar lotes..."
              placeholderTextColor={currentTheme.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={16} color={currentTheme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {canEdit && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.newBatchBtn, { backgroundColor: currentTheme.primary }]}
              onPress={handleCreateInventory}
            >
              <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.newBatchBtnText}>Nuevo</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <SkeletonLoader theme={currentTheme} count={1} />
        ) : (
          <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
            <DraggableFlatList
              key={`inventarios-${themeMode}`}
              showsVerticalScrollIndicator={false}
              extraData={themeMode}
              data={filteredInventories}
              renderItem={renderItem}
              keyExtractor={item => item.id}
              onDragBegin={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              containerStyle={{ flex: 1, overflow: 'visible' }}
              animationConfig={{ damping: 20, stiffness: 200, mass: 0.8 }}
              autoscrollSpeed={200}
              autoscrollThreshold={80}
              dragHitSlop={{ top: -4, bottom: -4, left: 0, right: 0 }}
              contentContainerStyle={[
                styles.listContent,
                filteredInventories.length === 0 && { flexGrow: 1, paddingTop: 40 }
              ]}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              refreshControl={
                <RefreshControl
                  enabled={!isDragging && !refreshing}
                  refreshing={refreshing}
                  onRefresh={handleRefreshOrSync}
                  tintColor={currentTheme.primary}
                  colors={[currentTheme.primary]}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  title={search ? "Sin resultados" : "No hay lotes creados"}
                  description={
                    search
                      ? "Intenta con otro término de búsqueda"
                      : "Crea tu primer lote de trabajo para comenzar a gestionar el inventario"
                  }
                  iconName="albums-outline"
                  currentTheme={currentTheme}
                />
              }
            />
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

export const InventariosScreen = InventoriesScreen;

const styles = StyleSheet.create({
  topActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  newBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  newBatchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 40,
  },
});

export default InventoriesScreen;
