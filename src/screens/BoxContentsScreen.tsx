import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { RootStackParamList, Garment } from '../types';
import {
  Navbar,
  GarmentCard,
  SkeletonLoader,
  EmptyState,
  ImagePreviewModal,
  MoveGarmentModal,
  SuccessModal,
  ExportModal,
} from '../components';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, FlatList } from 'react-native-gesture-handler';
import { GarmentService } from '../services';
import { useBoxContentsScreen } from '../hooks';

type BoxContentsRouteProp = RouteProp<RootStackParamList, 'BoxContents'>;

export const BoxContentsScreen = () => {
  const route = useRoute<BoxContentsRouteProp>();
  const insets = useSafeAreaInsets();
  const boxId = route.params?.boxId;
  const boxName = route.params?.boxName || 'Caja';
  const db = useSQLiteContext();
  const [exportSelectionVisible, setExportSelectionVisible] = useState(false);

  const { state, computed, refs, handlers } = useBoxContentsScreen(boxId, boxName);
  const {
    search,
    activeFilter,
    refreshing,
    highlightedId,
    isModalVisible,
    currentImage,
    moveModalVisible,
    garmentToMove,
    successModalConfig,
  } = state;

  const {
    currentTheme,
    themeMode,
    canEdit,
    filteredGarments,
    filterCounts,
    selectedCount,
    selectedGarments,
    showSkeleton,
  } = computed;

  const { flatListRef, fadeAnim } = refs;

  const {
    setSearch,
    setActiveFilter,
    onRefresh,
    handleNew,
    handleCameraScan,
    handleBulkDelete,
    handleItemPress,
    deleteGarment,
    toggleGarmentStatus,
    fetchGarments,
    setMoveModalVisible,
    setGarmentToMove,
    setModalVisible,
    setCurrentImage,
    setSuccessModalConfig,
    toggleSelectGarment,
    clearSelectedGarments,
  } = handlers;
  const selectedGarmentIds = useMemo(
    () => Object.keys(selectedGarments).filter(id => selectedGarments[id]),
    [selectedGarments]
  );

  const handleItemPressStable = useCallback((item: Garment) => {
    handleItemPress(item);
  }, [handleItemPress]);

  const handleLongPressStable = useCallback((item: Garment) => {
    toggleSelectGarment(item.id);
  }, [toggleSelectGarment]);

  const handleDeleteStable = useCallback((item: Garment) => {
    deleteGarment(item.id);
  }, [deleteGarment]);

  const handleToggleStatusStable = useCallback((item: Garment) => {
    if (!canEdit) {
      Alert.alert('Acceso Restringido', 'Tu rol actual solo permite lectura.');
      return;
    }
    const currentStatus = item.status ?? (item as any).estado ?? 1;
    const nextStatusLabel = currentStatus === 1 ? 'Inactivo' : 'Activo';
    Alert.alert("Estado", `¿Marcar como ${nextStatusLabel}?`, [
      { text: "Cancelar" },
      {
        text: "Confirmar",
        onPress: async () => {
          await toggleGarmentStatus(item.id);
          fetchGarments(false);
        }
      }
    ]);
  }, [canEdit, toggleGarmentStatus, fetchGarments]);

  const handleMoveStable = useCallback((item: Garment) => {
    if (!canEdit) {
      Alert.alert('Acceso Restringido', 'Tu rol actual solo permite lectura.');
      return;
    }
    setGarmentToMove(item.id);
    setMoveModalVisible(true);
  }, [canEdit, setGarmentToMove, setMoveModalVisible]);

  const handleImagePressStable = useCallback((uri: string | null | undefined) => {
    if (uri) {
      setModalVisible(true);
      setCurrentImage(uri);
    }
  }, [setModalVisible, setCurrentImage]);

  const renderItem = useCallback(({ item }: { item: Garment }) => (
    <GarmentCard
      item={item}
      theme={currentTheme}
      isSelected={!!selectedGarments[item.id]}
      isHighlighted={item.id === highlightedId}
      canEdit={canEdit}
      onPress={handleItemPressStable}
      onLongPress={handleLongPressStable}
      onDelete={handleDeleteStable}
      onToggleStatus={handleToggleStatusStable}
      onMove={handleMoveStable}
      onImagePress={handleImagePressStable}
    />
  ), [
    currentTheme,
    selectedGarments,
    highlightedId,
    canEdit,
    handleItemPressStable,
    handleLongPressStable,
    handleDeleteStable,
    handleToggleStatusStable,
    handleMoveStable,
    handleImagePressStable,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
        <Navbar title={boxName} showBackButton />

        <View style={{ backgroundColor: currentTheme.background, zIndex: 10 }}>
          {selectedCount > 0 ? (
            <View style={styles.bulkDeleteContainer}>
              <View style={styles.bulkActionsRow}>
                <TouchableOpacity
                  onPress={() => setExportSelectionVisible(true)}
                  style={[styles.bulkActionButton, { backgroundColor: currentTheme.primary }]}
                  activeOpacity={0.82}
                >
                  <Ionicons name="document-text-outline" size={18} color={currentTheme.primaryText || '#FFF'} />
                  <Text style={[styles.bulkActionText, { color: currentTheme.primaryText || '#FFF' }]} numberOfLines={1}>
                    Excel ({selectedCount})
                  </Text>
                </TouchableOpacity>
                {canEdit && (
                  <TouchableOpacity
                    onPress={handleBulkDelete}
                    style={[styles.bulkActionButton, { backgroundColor: '#ef4444' }]}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="trash" size={18} color="#FFF" />
                    <Text style={[styles.bulkActionText, { color: '#FFF' }]} numberOfLines={1}>
                      Eliminar ({selectedCount})
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={clearSelectedGarments}
                  style={[styles.clearSelectionButton, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                  accessibilityLabel="Limpiar selección"
                >
                  <Ionicons name="close" size={20} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.topActionsBar}>
              <View style={[styles.searchContainer, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                <Ionicons name="search-outline" size={16} color={currentTheme.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: currentTheme.text }]}
                  placeholder="Filtrar prendas..."
                  placeholderTextColor={currentTheme.textSecondary}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={15} color={currentTheme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {canEdit && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.actionBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                    onPress={handleCameraScan}
                  >
                    <Ionicons name="camera-outline" size={17} color={currentTheme.text} />
                    <Text style={[styles.actionBtnText, { color: currentTheme.text }]}>OCR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.actionBtn, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}
                    onPress={handleNew}
                  >
                    <Ionicons name="add" size={18} color={currentTheme.primaryText || '#fff'} />
                    <Text style={[styles.actionBtnText, { color: currentTheme.primaryText || '#fff' }]}>Nuevo</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* FILTER CHIPS */}
          <View style={{ height: 36, marginBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveFilter('ALL')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === 'ALL' ? currentTheme.primary : currentTheme.card,
                    borderColor: activeFilter === 'ALL' ? currentTheme.primary : currentTheme.border,
                  }
                ]}
              >
                <Text style={[styles.filterChipText, { color: activeFilter === 'ALL' ? currentTheme.primaryText : currentTheme.text }]}>
                  Todas ({filterCounts.all})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveFilter('ALARM')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === 'ALARM' ? currentTheme.primary : currentTheme.card,
                    borderColor: activeFilter === 'ALARM' ? currentTheme.primary : currentTheme.border,
                  }
                ]}
              >
                <Text style={[styles.filterChipText, { color: activeFilter === 'ALARM' ? currentTheme.primaryText : currentTheme.text }]}>
                  Con Alarma ({filterCounts.alarm})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveFilter('PHOTOS')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === 'PHOTOS' ? currentTheme.primary : currentTheme.card,
                    borderColor: activeFilter === 'PHOTOS' ? currentTheme.primary : currentTheme.border,
                  }
                ]}
              >
                <Text style={[styles.filterChipText, { color: activeFilter === 'PHOTOS' ? currentTheme.primaryText : currentTheme.text }]}>
                  Con Fotos ({filterCounts.photos})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setActiveFilter('INACTIVE')}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeFilter === 'INACTIVE' ? '#64748B' : currentTheme.card,
                    borderColor: activeFilter === 'INACTIVE' ? '#64748B' : currentTheme.border,
                  }
                ]}
              >
                <Text style={[styles.filterChipText, { color: activeFilter === 'INACTIVE' ? '#FFF' : currentTheme.text }]}>
                  Inactivas ({filterCounts.inactive})
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* GARMENTS LIST */}
        <View style={{ flex: 1 }}>
          {showSkeleton ? (
            <SkeletonLoader theme={currentTheme} />
          ) : (
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
              <FlatList
                key={`garments-${themeMode}`}
                extraData={themeMode}
                ref={flatListRef}
                data={filteredGarments}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: Math.max(insets.bottom, 24) + 16 }
                ]}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0.5,
                    });
                  }, 100);
                }}
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
                    iconName="shirt-outline"
                    title="¡Sin Prendas!"
                    description="Toca 'Nuevo' o usa el OCR para comenzar."
                    currentTheme={currentTheme}
                    delay={100}
                  />
                }
                ListFooterComponent={<View style={{ height: 8 }} />}
              />
            </Animated.View>
          )}
        </View>

        <MoveGarmentModal
          isVisible={moveModalVisible}
          onClose={() => setMoveModalVisible(false)}
          currentBoxId={boxId}
          onSelectBox={async (newBoxId, destinationBoxName) => {
            if (garmentToMove && db) {
              setMoveModalVisible(false);
              const result = await GarmentService.moveGarment(db, garmentToMove, newBoxId);
              if (result.success) {
                fetchGarments(false);
                setSuccessModalConfig({
                  isVisible: true,
                  title: '¡Prenda Movida con Éxito! 📦',
                  message: `La prenda se trasladó a la "${destinationBoxName}" correctamente.`
                });
              } else {
                Alert.alert("Error", result.error || "No se pudo mover la prenda");
              }
            }
          }}
        />

        <SuccessModal
          isVisible={successModalConfig.isVisible}
          title={successModalConfig.title}
          message={successModalConfig.message}
          onClose={() => setSuccessModalConfig(prev => ({ ...prev, isVisible: false }))}
        />

        <ImagePreviewModal
          visible={isModalVisible}
          uri={currentImage}
          onClose={() => setModalVisible(false)}
        />

        <ExportModal
          visible={exportSelectionVisible}
          onClose={() => setExportSelectionVisible(false)}
          onExportSuccess={clearSelectedGarments}
          selection={exportSelectionVisible ? { garmentIds: selectedGarmentIds } : null}
          title="Excel de prendas seleccionadas"
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  topActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  ocrBtn: {
    borderWidth: 0,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  bulkDeleteContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  bulkActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkActionButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    paddingHorizontal: 8,
  },
  bulkActionText: { fontSize: 12, fontWeight: '700' },
  clearSelectionButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 40,
  },
});

export const CajaContentsScreen = BoxContentsScreen;
export default BoxContentsScreen;
