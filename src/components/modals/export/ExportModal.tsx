import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HistoryItem } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';
import { clayStyles } from '../../../styles/theme';
import { useExportModal } from '../../../hooks';
import { ExportInventoryAccordion } from './ExportInventoryAccordion';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  data?: HistoryItem[];
  title?: string;
  onExportSuccess?: () => void;
  selection?: { garmentIds: string[] } | null;
}

export const ExportModal: React.FC<ExportModalProps> = (props) => {
  if (!props.visible) return null;
  return <ExportModalContent {...props} />;
};

const ExportModalContent: React.FC<ExportModalProps> = ({ visible, onClose, data: propData, selection, title, onExportSuccess }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();

  const {
    loadingData,
    exporting,
    exportData,
    orderedInventoriesGrouped,
    allBoxKeys,
    selectedBoxKeys,
    expandedInventories,
    separateBySheet,
    setSeparateBySheet,
    selectedColumns,
    fileName,
    updateFileName,
    quantity,
    updateQuantity,
    moveInventoryPosition,
    toggleColumn,
    toggleInventoryExpand,
    toggleSingleBox,
    toggleEntireInventorySelection,
    selectAllEverything,
    handleExport,
  } = useExportModal({ visible, onClose, onExportSuccess, data: propData, selection });

  const selectedBoxCount = new Set(exportData.map(item => item.box_id).filter(Boolean)).size;

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Cerrar configurar reporte Excel"
        />
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: currentTheme.card,
              paddingBottom: Math.max(insets.bottom + 12, 16),
            },
          ]}
        >
          {/* Indicador de arrastre */}
          <View style={styles.dragIndicator} />

          {/* Encabezado */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <View style={[styles.headerIconCircle, { backgroundColor: currentTheme.primary + '18' }]}>
                <Ionicons name="document-text-outline" size={20} color={currentTheme.primary} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: currentTheme.text }]}>
                  {selection ? 'Excel de prendas seleccionadas' : (title || 'Configurar Reporte Excel')}
                </Text>
                <Text style={[styles.modalSubtitle, { color: currentTheme.textSecondary }]}>
                  {selection
                    ? `${selection.garmentIds.length} prenda${selection.garmentIds.length !== 1 ? 's' : ''} de ${selectedBoxCount} caja${selectedBoxCount !== 1 ? 's' : ''}`
                    : `${orderedInventoriesGrouped.length} lotes listos para exportar`}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: currentTheme.border + '35' }]}>
              <Ionicons name="close" size={18} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {loadingData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
              <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>Cargando datos para exportar...</Text>
            </View>
          ) : (
            <View style={styles.bodyContainer}>
              {!selection ? (
                <View style={styles.lotsSection}>
                  {/* Sección: Inventarios y Cajas Acordeón (Scroll exclusivo) */}
                  <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="layers-outline" size={16} color={currentTheme.primary} />
                      <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginBottom: 0 }]}>
                        INVENTARIOS Y CAJAS ({orderedInventoriesGrouped.length} lotes)
                      </Text>
                    </View>
                    {allBoxKeys.length > 0 && (
                      <TouchableOpacity onPress={selectAllEverything}>
                        <Text style={[styles.selectAllText, { color: currentTheme.primary }]}>
                          {selectedBoxKeys.length === allBoxKeys.length ? 'Desmarcar todo' : 'Marcar todo'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView
                    style={styles.lotsScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.lotsScrollContent}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {orderedInventoriesGrouped.length === 0 ? (
                      <View style={[styles.emptyBoxCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                        <Ionicons name="cube-outline" size={30} color={currentTheme.textSecondary} style={{ marginBottom: 6 }} />
                        <Text style={[styles.emptyBoxText, { color: currentTheme.textSecondary }]}>
                          No hay lotes ni cajas con prendas activas para exportar.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.accordionContainer}>
                        {orderedInventoriesGrouped.map((inv, index) => (
                          <ExportInventoryAccordion
                            key={`${inv.name}-${index}`}
                            inv={inv}
                            index={index}
                            totalItems={orderedInventoriesGrouped.length}
                            isExpanded={expandedInventories.includes(inv.name)}
                            selectedBoxKeys={selectedBoxKeys}
                            currentTheme={currentTheme}
                            onMovePosition={dir => moveInventoryPosition(index, dir)}
                            onToggleExpand={() => toggleInventoryExpand(inv.name)}
                            onToggleEntireSelection={() => toggleEntireInventorySelection(inv.name)}
                            onToggleSingleBox={key => toggleSingleBox(key)}
                          />
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={{ marginBottom: 6 }}>
                    <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginBottom: 4 }]}>
                      NOMBRE DEL ARCHIVO
                    </Text>
                    <TextInput
                      value={fileName}
                      onChangeText={updateFileName}
                      placeholder="Nombre del Excel"
                      placeholderTextColor={currentTheme.textSecondary}
                      autoCapitalize="sentences"
                      style={[
                        styles.fileNameInput,
                        styles.compactInput,
                        { color: currentTheme.text, backgroundColor: currentTheme.background, borderColor: currentTheme.border },
                      ]}
                    />
                  </View>

                  {Boolean(selectedColumns.quantity) && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginBottom: 4 }]}>
                        CANTIDAD POR DEFECTO
                      </Text>
                      <TextInput
                        value={quantity}
                        onChangeText={updateQuantity}
                        placeholder="Ej. 2P"
                        placeholderTextColor={currentTheme.textSecondary}
                        autoCapitalize="characters"
                        style={[
                          styles.fileNameInput,
                          styles.compactInput,
                          { color: currentTheme.text, backgroundColor: currentTheme.background, borderColor: currentTheme.border },
                        ]}
                      />
                    </View>
                  )}


                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: currentTheme.textSecondary, marginTop: 6, marginBottom: 6 },
                    ]}
                  >
                    COLUMNAS DEL REPORTE EXCEL
                  </Text>
                  <View style={styles.selectionColumnsList}>
                    {[
                      { label: 'OP', key: 'op', icon: 'barcode-outline' },
                      { label: 'Estilo', key: 'style', icon: 'shirt-outline' },
                      { label: 'Color', key: 'color', icon: 'color-palette-outline' },
                      { label: `Cantidad (${quantity || '2P'})`, key: 'quantity', icon: 'layers-outline' },
                      { label: 'Caja', key: 'location', icon: 'location-outline' },
                      { label: 'Estado', key: 'status', icon: 'checkmark-circle-outline' },
                      { label: 'Imagen', key: 'image', icon: 'image-outline' },
                    ].map(col => {
                      const isChecked = !!selectedColumns[col.key as keyof typeof selectedColumns];
                      return (
                        <TouchableOpacity
                          key={col.key}
                          style={[
                            styles.selectionColumnItem,
                            {
                              backgroundColor: isChecked ? currentTheme.primary + '12' : currentTheme.background,
                              borderColor: isChecked ? currentTheme.primary : currentTheme.border,
                            },
                          ]}
                          onPress={() => toggleColumn(col.key as any)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={col.icon as any} size={18} color={currentTheme.primary} />
                          <Text style={[styles.selectionColumnLabel, { color: currentTheme.text }]} numberOfLines={1}>
                            {col.label}
                          </Text>
                          <Ionicons
                            name={isChecked ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isChecked ? currentTheme.primary : currentTheme.textSecondary}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Resumen de exportación */}
                  <View style={[styles.selectionSummaryCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    <Ionicons name="information-circle-outline" size={18} color={currentTheme.primary} style={{ marginRight: 8, marginTop: 1 }} />
                    <Text style={[styles.selectionSummaryText, { color: currentTheme.textSecondary }]}>
                      Se exportarán{' '}
                      <Text style={{ color: currentTheme.text, fontWeight: '700' }}>
                        {selection.garmentIds.length} prenda{selection.garmentIds.length !== 1 ? 's' : ''}
                      </Text>
                      {' '}de {selectedBoxCount} caja{selectedBoxCount !== 1 ? 's' : ''} con{' '}
                      <Text style={{ color: currentTheme.primary, fontWeight: '700' }}>
                        {Object.values(selectedColumns).filter(Boolean).length} columnas
                      </Text>
                      {' '}en una hoja de Excel.
                    </Text>
                  </View>
                </ScrollView>
              )}

              {/* Pie fijo: Columnas + Opciones (en modo general) + Botón Exportar siempre visible */}
              <View style={[styles.footerSection, !selection && { borderTopWidth: 1, borderTopColor: currentTheme.border }]}>
                {!selection && (
                  <>
                    <Text
                      style={[
                        styles.sectionSubtitle,
                        { color: currentTheme.textSecondary, marginBottom: 6 },
                      ]}
                    >
                      COLUMNAS DEL REPORTE EXCEL
                    </Text>
                    <View style={styles.columnsGrid}>
                      {[
                        { label: 'OP', key: 'op', icon: 'barcode-outline' },
                        { label: 'Estilo', key: 'style', icon: 'shirt-outline' },
                        { label: 'Color', key: 'color', icon: 'color-palette-outline' },
                        { label: 'Ubicación', key: 'location', icon: 'location-outline' },
                        { label: 'Estado', key: 'status', icon: 'checkmark-circle-outline' },
                        { label: 'Imagen', key: 'image', icon: 'image-outline' },
                      ].map(col => {
                        const isChecked = !!selectedColumns[col.key as keyof typeof selectedColumns];
                        return (
                          <TouchableOpacity
                            key={col.key}
                            style={[
                              styles.columnGridItem,
                              {
                                backgroundColor: isChecked ? currentTheme.primary + '12' : currentTheme.background,
                                borderColor: isChecked ? currentTheme.primary : currentTheme.border,
                              },
                            ]}
                            onPress={() => toggleColumn(col.key as any)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={col.icon as any} size={16} color={currentTheme.primary} />
                            <Text style={[styles.columnGridLabel, { color: currentTheme.text }]} numberOfLines={1}>
                              {col.label}
                            </Text>
                            <Ionicons
                              name={isChecked ? 'checkbox' : 'square-outline'}
                              size={18}
                              color={isChecked ? currentTheme.primary : currentTheme.textSecondary}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      <View style={styles.switchRow}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={[styles.switchTitle, { color: currentTheme.text }]}>Separar cajas en hojas</Text>
                          <Text style={[styles.switchSubtitle, { color: currentTheme.textSecondary }]}>
                            Cada caja seleccionada se exporta en su propia pestaña de Excel.
                          </Text>
                        </View>
                        <Switch
                          value={separateBySheet}
                          onValueChange={setSeparateBySheet}
                          trackColor={{ false: currentTheme.border, true: currentTheme.primary + '80' }}
                          thumbColor={separateBySheet ? currentTheme.primary : '#F4F3F4'}
                        />
                      </View>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[
                    styles.exportBtn,
                    selection && { height: 44, marginTop: 2 },
                    {
                      backgroundColor: (selection ? selection.garmentIds.length > 0 : selectedBoxKeys.length > 0) ? currentTheme.primary : currentTheme.border,
                    },
                  ]}
                  onPress={handleExport}
                  disabled={loadingData || exporting || (selection ? selection.garmentIds.length === 0 : selectedBoxKeys.length === 0)}
                  activeOpacity={0.8}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="document-text" size={19} color="#FFF" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.exportBtnText}>
                    {exporting
                      ? 'Generando Excel...'
                      : selection
                        ? `Exportar Excel (${selection.garmentIds.length})`
                        : selectedBoxKeys.length > 0
                          ? `Exportar Excel (${selectedBoxKeys.length} caja${selectedBoxKeys.length !== 1 ? 's' : ''})`
                          : 'Selecciona al menos una caja'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    paddingTop: 100,
  },
  sheetContainer: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    elevation: 10,
  },
  dragIndicator: {
    width: 38,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyContainer: {
    flex: 1,
  },
  lotsSection: {
    flex: 1,
    minHeight: 120,
  },
  lotsScroll: {
    flex: 1,
  },
  lotsScrollContent: {
    paddingBottom: 6,
  },
  footerSection: {
    paddingTop: 10,
  },
  scrollContent: {
    paddingBottom: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBoxCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyBoxText: {
    fontSize: 13,
    textAlign: 'center',
  },
  accordionContainer: {
    gap: 8,
    marginBottom: 8,
  },
  columnsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  columnGridItem: {
    flexGrow: 1,
    flexBasis: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 18,
    minHeight: 56,
    borderRadius: 13,
    borderWidth: 1,
    gap: 8,
  },
  columnGridLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  selectionColumnsList: {
    gap: 5.5,
    marginBottom: 8,
  },
  selectionColumnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8.5,
    borderRadius: 11,
    borderWidth: 1,
    gap: 10,
  },
  selectionColumnLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  selectionSummaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  selectionSummaryText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  menuGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  compactCheckRow: {
    paddingHorizontal: 12,
    paddingVertical: 8.5,
  },
  menuIcon: {
    marginRight: 10,
    width: 20,
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  fileNameInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  compactInput: {
    minHeight: 38,
    paddingVertical: 6,
    fontSize: 13.5,
  },
  continueSelectingButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  continueSelectingText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  exportBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14.5,
  },
});
