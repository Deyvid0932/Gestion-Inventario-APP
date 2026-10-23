import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList, BoxWithStats } from '../types';
import { Navbar, SkeletonLoader, EmptyState, BoxCard } from '../components';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useBoxesScreen } from '../hooks';

type BoxesRouteProp = RouteProp<RootStackParamList, 'Boxes'>;

export const BoxesScreen = () => {
  const route = useRoute<BoxesRouteProp>();
  const insets = useSafeAreaInsets();
  const inventoryId = route.params?.inventoryId || (route.params as any)?.inventarioId;
  const inventoryName = route.params?.inventoryName || (route.params as any)?.nombreInventario || 'Cajas';
  const expectedBoxCount = route.params?.boxCount;

  const { state, computed, handlers } = useBoxesScreen(inventoryId, inventoryName);
  const { refreshing, isUpdatingOrder, isDragging, search } = state;
  const { currentTheme, themeMode, canEdit, filteredBoxes, showSkeleton } = computed;
  const {
    setSearch,
    onRefresh,
    handleDragEnd,
    setIsDragging,
    deleteBox,
    handleCardPress,
    handleCardEdit,
    handleCreateBox,
  } = handlers;

  const isSearchActive = search.trim().length > 0;
  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<BoxWithStats>) => (
    <BoxCard
      item={item}
      theme={currentTheme}
      canEdit={canEdit}
      onPress={handleCardPress}
      onEdit={handleCardEdit}
      onDelete={deleteBox}
      drag={!isSearchActive ? drag : undefined}
      isActive={isActive}
    />
  ), [currentTheme, handleCardPress, handleCardEdit, deleteBox, canEdit, isSearchActive]);

  const bottomSafePadding = insets.bottom;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={{ flex: 1, backgroundColor: currentTheme.background, paddingBottom: bottomSafePadding }}>
        <Navbar title={inventoryName} showBackButton isLoading={isUpdatingOrder} />

        {/* TOP BAR: SEARCH + NEW BOX BUTTON */}
        <View style={styles.topActionsBar}>
          <View style={[styles.searchContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
            <Ionicons name="search-outline" size={18} color={currentTheme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: currentTheme.text }]}
              placeholder="Buscar cajas..."
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
              style={[styles.nuevoBtn, { backgroundColor: currentTheme.primary }]}
              onPress={handleCreateBox}
            >
              <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.nuevoBtnText}>Nueva</Text>
            </TouchableOpacity>
          )}
        </View>

        {showSkeleton ? (
          <SkeletonLoader theme={currentTheme} count={expectedBoxCount} />
        ) : (
          <View style={{ flex: 1 }}>
            <DraggableFlatList
              key={`cajas-${themeMode}`}
              extraData={themeMode}
              data={filteredBoxes}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              onDragBegin={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              contentContainerStyle={[
                styles.listContent,
                filteredBoxes.length === 0 && { flexGrow: 1, paddingTop: 40 }
              ]}
              containerStyle={{ flex: 1, overflow: 'visible' }}
              animationConfig={{ damping: 20, stiffness: 200, mass: 0.8 }}
              autoscrollSpeed={200}
              autoscrollThreshold={80}
              dragHitSlop={{ top: -4, bottom: -4, left: 0, right: 0 }}
              showsVerticalScrollIndicator={false}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={currentTheme.primary}
                  enabled={!isDragging && !refreshing}
                />
              }
              ListEmptyComponent={
                <EmptyState
                  title={search ? "Sin resultados" : "No hay cajas creadas"}
                  description={
                    search
                      ? "Intenta con otro término de búsqueda"
                      : "Crea tu primera caja para comenzar a organizar prendas en este lote"
                  }
                  iconName="cube-outline"
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
  nuevoBtn: {
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
  nuevoBtnText: {
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

export const CajasScreen = BoxesScreen;
export default BoxesScreen;
