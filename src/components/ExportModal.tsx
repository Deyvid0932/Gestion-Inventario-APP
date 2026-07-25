import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { HistoryItem } from '../types';
import { exportToExcel } from '../utils/export';
import { useAppStore } from '../store/useAppStore';
import { clayStyles } from '../style/theme';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  data?: HistoryItem[];
  title?: string;
}

export const ExportModal = ({ visible, onClose, data: propData }: ExportModalProps) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const insets = useSafeAreaInsets();

  const [exportData, setExportData] = useState<HistoryItem[]>(propData || []);
  const [loadingData, setLoadingData] = useState(false);

  // Obtener datos si no se pasaron por props
  useEffect(() => {
    if (visible) {
      if (propData && propData.length > 0) {
        setExportData(propData);
      } else if (db) {
        setLoadingData(true);
        db.getAllAsync<HistoryItem>(`
          SELECT p.id, p.cajaId, p.op, p.estilo, p.color, p.estado, p.fechaCreacion, p.alarmaFechaHora,
                 c.nombre as cajaNombre, i.nombre as inventarioNombre
          FROM prendas p
          JOIN cajas c ON p.cajaId = c.id
          JOIN inventarios i ON c.inventarioId = i.id
          ORDER BY c.nombre ASC, p.fechaCreacion DESC
        `)
          .then(rows => {
            setExportData(rows || []);
          })
          .catch(e => {
            console.error('Error al cargar prendas para exportación:', e);
            setExportData([]);
          })
          .finally(() => {
            setLoadingData(false);
          });
      }
    }
  }, [visible, propData, db]);

  // Cajas disponibles a partir de los datos
  const availableBoxes = useMemo(() => {
    return Array.from(new Set(exportData.map(item => item.cajaNombre))).filter(Boolean);
  }, [exportData]);

  const [selectedBoxes, setSelectedBoxes] = useState<string[]>([]);
  const [separateBySheet, setSeparateBySheet] = useState(false);

  // Auto-seleccionar todas las cajas cuando se cargan los datos o abre el modal
  useEffect(() => {
    if (visible && availableBoxes.length > 0) {
      setSelectedBoxes(availableBoxes);
    }
  }, [visible, availableBoxes]);

  const [selectedColumns, selectSetColumns] = useState({
    op: false,
    estilo: true,
    color: true,
    ubicacion: false,
    estado: false,
  });

  const toggleColumn = (key: keyof typeof selectedColumns) => {
    selectSetColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBox = (boxName: string) => {
    if (selectedBoxes.includes(boxName)) {
      setSelectedBoxes(prev => prev.filter(name => name !== boxName));
    } else {
      setSelectedBoxes(prev => [...prev, boxName]);
    }
  };

  const selectAllBoxes = () => {
    if (selectedBoxes.length === availableBoxes.length) {
      setSelectedBoxes([]);
    } else {
      setSelectedBoxes(availableBoxes);
    }
  };

  const handleExport = () => {
    if (selectedBoxes.length === 0) {
      Alert.alert('Atención', 'Selecciona al menos una caja para generar la exportación.');
      return;
    }

    const dataFiltrada = exportData.filter(item => selectedBoxes.includes(item.cajaNombre));

    if (dataFiltrada.length === 0) {
      Alert.alert('Sin Datos', 'No hay prendas para exportar en las cajas seleccionadas.');
      return;
    }

    let nombreArchivo = '';
    if (selectedBoxes.length === 1) {
      nombreArchivo = `Reporte_${selectedBoxes[0]}`;
    } else {
      nombreArchivo = `Reporte_Inventario_${selectedBoxes.length}_Cajas`;
    }

    const dataFinal = dataFiltrada.map(item => {
      const row: any = {};
      row['_cajaNombre'] = item.cajaNombre;

      if (selectedColumns.op) row['OP'] = item.op || 'S/N';
      if (selectedColumns.estilo) row['Estilo'] = item.estilo;
      if (selectedColumns.color) row['Color'] = item.color;
      if (selectedColumns.ubicacion) {
        row['Inventario'] = item.inventarioNombre;
        row['Caja'] = item.cajaNombre;
      }
      if (selectedColumns.estado) {
        row['Estado'] = item.estado === 1 ? 'Activo' : 'Inactivo';
      }
      return row;
    });

    exportToExcel(dataFinal, nombreArchivo, separateBySheet);
    onClose();
  };

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
                  maxHeight: '85%',
                  paddingBottom: Math.max(insets.bottom + 16, 24),
                },
              ]}
            >
              <View style={styles.dragIndicator} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                  <Ionicons name="document-text-outline" size={24} color={currentTheme.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                    Exportar a Excel
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
                  accessibilityLabel="Cerrar modal de exportación"
                >
                  <Ionicons name="close" size={20} color={currentTheme.text} />
                </TouchableOpacity>
              </View>

              {loadingData ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={currentTheme.primary} />
                  <Text style={[styles.loadingText, { color: currentTheme.textSecondary }]}>
                    Cargando inventario para exportar...
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                  {/* Sección: Cajas */}
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>
                      CAJAS A INCLUIR ({availableBoxes.length})
                    </Text>
                    {availableBoxes.length > 0 && (
                      <TouchableOpacity onPress={selectAllBoxes}>
                        <Text style={[styles.selectAllText, { color: currentTheme.primary }]}>
                          {selectedBoxes.length === availableBoxes.length ? 'Desmarcar todas' : 'Todas'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {availableBoxes.length === 0 ? (
                    <View style={[styles.emptyBoxCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      <Ionicons name="cube-outline" size={32} color={currentTheme.textSecondary} style={{ marginBottom: 6 }} />
                      <Text style={[styles.emptyBoxText, { color: currentTheme.textSecondary }]}>
                        No hay prendas registradas en la base de datos para exportar.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.chipsContainer}>
                      {availableBoxes.map(box => {
                        const isSelected = selectedBoxes.includes(box);
                        return (
                          <TouchableOpacity
                            key={box}
                            onPress={() => toggleBox(box)}
                            activeOpacity={0.7}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: isSelected ? currentTheme.primary + '18' : currentTheme.background,
                                borderColor: isSelected ? currentTheme.primary : currentTheme.border,
                              },
                            ]}
                          >
                            <Ionicons
                              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={isSelected ? currentTheme.primary : currentTheme.textSecondary}
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                styles.chipText,
                                {
                                  color: isSelected ? currentTheme.primary : currentTheme.text,
                                  fontWeight: isSelected ? '700' : '500',
                                },
                              ]}
                            >
                              {box}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Sección: Columnas del Reporte */}
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginTop: 18 }]}>
                    COLUMNAS DEL REPORTE
                  </Text>
                  <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    {[
                      { label: 'Orden de Producción (OP)', key: 'op', icon: 'barcode-outline' },
                      { label: 'Estilo de Prenda', key: 'estilo', icon: 'shirt-outline' },
                      { label: 'Color de Prenda', key: 'color', icon: 'color-palette-outline' },
                      { label: 'Ubicación (Lote y Caja)', key: 'ubicacion', icon: 'location-outline' },
                      { label: 'Estado (Activo / Inactivo)', key: 'estado', icon: 'checkmark-circle-outline' },
                    ].map((col, index, arr) => {
                      const isChecked = selectedColumns[col.key as keyof typeof selectedColumns];
                      return (
                        <React.Fragment key={col.key}>
                          <TouchableOpacity
                            style={styles.checkRow}
                            onPress={() => toggleColumn(col.key as any)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={col.icon as any} size={20} color={currentTheme.primary} style={styles.menuIcon} />
                            <Text style={[styles.checkLabel, { color: currentTheme.text }]}>{col.label}</Text>
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

                  {/* Sección: Opciones Avanzadas */}
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>OPCIONES DE EXCEL</Text>
                  <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    <View style={styles.switchRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.switchTitle, { color: currentTheme.text }]}>Separar por Hojas</Text>
                        <Text style={[styles.switchSubtitle, { color: currentTheme.textSecondary }]}>
                          Crea una pestaña individual en el archivo Excel por cada caja
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

                  {/* Botón de Generar Reporte */}
                  <TouchableOpacity
                    style={[
                      styles.exportBtn,
                      {
                        backgroundColor: availableBoxes.length > 0 && selectedBoxes.length > 0 ? currentTheme.primary : currentTheme.border,
                      },
                    ]}
                    onPress={handleExport}
                    disabled={availableBoxes.length === 0 || selectedBoxes.length === 0}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="stats-chart-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.exportBtnText}>Generar Reporte Excel</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    width: 36,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
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
    marginBottom: 8,
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
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
