import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
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

export const ExportModal: React.FC<ExportModalProps> = ({ visible, onClose, data: propData, selection, title, onExportSuccess }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();

  const {
    loadingData,
    exportData,
    orderedInventoriesGrouped,
    allBoxKeys,
    selectedBoxKeys,
    expandedInventories,
    separateBySheet,
    setSeparateBySheet,
    selectedColumns,
    fileName,
    setFileName,
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                  maxHeight: '88%',
                  paddingBottom: Math.max(insets.bottom + 16, 24),
                },
              ]}
            >
              <View style={styles.dragIndicator} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                  <View style={[styles.headerIconCircle, { backgroundColor: currentTheme.primary + '18' }]}>
                    <Ionicons name="stats-chart" size={20} color={currentTheme.primary} />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                      {title || (selection ? 'Exportar selección' : 'Exportación Profesional')}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: currentTheme.textSecondary }]}>
                      {selection
                        ? `${selection.garmentIds.length} prendas de ${selectedBoxCount} caja${selectedBoxCount === 1 ? '' : 's'}`
                        : 'Selecciona inventarios, cajas y columnas'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
                  accessibilityLabel="Cerrar modal"
                >
                  <Ionicons name="close" size={20} color={currentTheme.text} />
                </TouchableOpacity>
              </View>

              {loadingData ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={currentTheme.primary} />
                  <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                    {selection ? 'Preparando prendas seleccionadas...' : 'Cargando estructura de inventarios...'}
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                  {!selection && <>
                  {/* Sección: Inventarios y Cajas Acordeón */}
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

                  {orderedInventoriesGrouped.length === 0 ? (
                    <View style={[styles.emptyBoxCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      <Ionicons name="cube-outline" size={32} color={currentTheme.textSecondary} style={{ marginBottom: 6 }} />
                      <Text style={[styles.emptyBoxText, { color: currentTheme.textSecondary }]}>
                        No hay prendas o cajas registradas en la base de datos para exportar.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.accordionContainer}>
                      {orderedInventoriesGrouped.map((inv, index) => (
                        <ExportInventoryAccordion
                          key={inv.name}
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
                  </>}

                  {selection && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>NOMBRE DEL ARCHIVO</Text>
                      <TextInput
                        value={fileName}
                        onChangeText={setFileName}
                        placeholder="Nombre del Excel"
                        placeholderTextColor={currentTheme.textSecondary}
                        autoCapitalize="sentences"
                        style={[styles.fileNameInput, { color: currentTheme.text, backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}
                      />
                    </View>
                  )}

                  {selection && (
                    <TouchableOpacity
                      onPress={onClose}
                      style={[styles.continueSelectingButton, { borderColor: currentTheme.primary }]}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="arrow-back" size={17} color={currentTheme.primary} />
                      <Text style={[styles.continueSelectingText, { color: currentTheme.primary }]}>
                        Volver a cajas y seguir seleccionando
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Sección: Columnas del Reporte */}
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginTop: 18 }]}>
                    COLUMNAS DEL REPORTE EXCEL
                  </Text>
                  <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    {[
                      { label: 'Orden de Producción (OP)', key: 'op', icon: 'barcode-outline' },
                      { label: 'Estilo de Prenda', key: 'style', icon: 'shirt-outline' },
                      { label: 'Color de Prenda', key: 'color', icon: 'color-palette-outline' },
                      { label: 'Ubicación (Lote y Caja)', key: 'location', icon: 'location-outline' },
                      { label: 'Estado (Activo / Inactivo)', key: 'status', icon: 'checkmark-circle-outline' },
                    ].map((col, index, arr) => {
                      const isChecked = selectedColumns[col.key as keyof typeof selectedColumns];
                      const label = selection && col.key === 'location' ? 'Caja' : col.label;
                      return (
                        <React.Fragment key={col.key}>
                          <TouchableOpacity
                            style={styles.checkRow}
                            onPress={() => toggleColumn(col.key as any)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={col.icon as any} size={20} color={currentTheme.primary} style={styles.menuIcon} />
                            <Text style={[styles.checkLabel, { color: currentTheme.text }]}>{label}</Text>
                            <Ionicons
                              name={isChecked ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={isChecked ? currentTheme.primary : currentTheme.textSecondary}
                            />
                          </TouchableOpacity>
                          {index < arr.length - 1 && <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />}
                        </React.Fragment>
                      );
                    })}
                  </View>

                  {!selection && <>
                  {/* Sección: Opciones Avanzadas */}
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>OPCIONES AVANZADAS</Text>
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
                  </>}

                  {/* Botón de Generar Reporte */}
                  <TouchableOpacity
                    style={[
                      styles.exportBtn,
                      {
                         backgroundColor: (selection ? selection.garmentIds.length > 0 : selectedBoxKeys.length > 0) ? currentTheme.primary : currentTheme.border,
                      },
                    ]}
                    onPress={handleExport}
                    disabled={loadingData || (selection ? selection.garmentIds.length === 0 : selectedBoxKeys.length === 0)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="document-text" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.exportBtnText}>
                      {selection
                        ? `Exportar Excel (${selection.garmentIds.length})`
                        : selectedBoxKeys.length > 0
                        ? `Exportar Excel (${selectedBoxKeys.length} caja${selectedBoxKeys.length !== 1 ? 's' : ''})`
                        : 'Selecciona al menos una caja'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    elevation: 10,
  },
  dragIndicator: {
    width: 38,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  loadingContainer: {
    paddingVertical: 40,
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
    fontSize: 11,
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
    gap: 10,
    marginBottom: 12,
  },
  menuGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuIcon: {
    marginRight: 12,
    width: 22,
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
  continueSelectingButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  continueSelectingText: {
    fontSize: 13,
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
    fontSize: 11,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  exportBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
