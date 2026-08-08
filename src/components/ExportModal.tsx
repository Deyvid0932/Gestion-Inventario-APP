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
          ORDER BY i.nombre ASC, c.nombre ASC, p.fechaCreacion DESC
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

  // Estructura jerárquica: Inventario -> Cajas -> Prendas
  const inventariosGrouped = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    exportData.forEach(item => {
      const invName = item.inventarioNombre || 'Inventario Sin Nombre';
      const boxName = item.cajaNombre || 'Caja Sin Nombre';

      if (!map.has(invName)) {
        map.set(invName, new Map<string, number>());
      }
      const boxMap = map.get(invName)!;
      boxMap.set(boxName, (boxMap.get(boxName) || 0) + 1);
    });

    const result: {
      nombre: string;
      totalPrendas: number;
      cajas: { nombre: string; prendaCount: number; key: string }[];
    }[] = [];

    map.forEach((boxMap, invName) => {
      const cajas: { nombre: string; prendaCount: number; key: string }[] = [];
      let totalPrendas = 0;

      boxMap.forEach((count, boxName) => {
        cajas.push({
          nombre: boxName,
          prendaCount: count,
          key: `${invName}___${boxName}`,
        });
        totalPrendas += count;
      });

      result.push({
        nombre: invName,
        totalPrendas,
        cajas,
      });
    });

    return result;
  }, [exportData]);

  // Claves compuestas de todas las cajas disponibles
  const allBoxKeys = useMemo(() => {
    const keys: string[] = [];
    inventariosGrouped.forEach(inv => {
      inv.cajas.forEach(c => keys.push(c.key));
    });
    return keys;
  }, [inventariosGrouped]);

  const [selectedBoxKeys, setSelectedBoxKeys] = useState<string[]>([]);
  const [expandedInventarios, setExpandedInventarios] = useState<string[]>([]);
  const [separateBySheet, setSeparateBySheet] = useState(false);
  const [customInvOrder, setCustomInvOrder] = useState<string[]>([]);

  // Sincronizar el orden de inventarios cuando cambian los datos
  useEffect(() => {
    if (inventariosGrouped.length > 0) {
      setCustomInvOrder(prev => {
        const names = inventariosGrouped.map(g => g.nombre);
        if (prev.length === 0) return names;
        const newNames = names.filter(n => !prev.includes(n));
        return [...prev.filter(n => names.includes(n)), ...newNames];
      });
    }
  }, [inventariosGrouped]);

  const orderedInventariosGrouped = useMemo(() => {
    if (customInvOrder.length === 0) return inventariosGrouped;
    const map = new Map(inventariosGrouped.map(g => [g.nombre, g]));
    const result: typeof inventariosGrouped = [];
    customInvOrder.forEach(name => {
      const g = map.get(name);
      if (g) result.push(g);
    });
    inventariosGrouped.forEach(g => {
      if (!result.includes(g)) result.push(g);
    });
    return result;
  }, [inventariosGrouped, customInvOrder]);

  const moveInventarioPosition = (index: number, direction: 'up' | 'down') => {
    const newOrder = orderedInventariosGrouped.map(g => g.nombre);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setCustomInvOrder(newOrder);
  };

  useEffect(() => {
    if (visible && allBoxKeys.length > 0) {
      setSelectedBoxKeys(allBoxKeys);
      setExpandedInventarios([]);
    }
  }, [visible, allBoxKeys]);

  const [selectedColumns, selectSetColumns] = useState({
    op: false,
    estilo: true,
    color: true,
    ubicacion: true,
    estado: false,
  });

  const toggleColumn = (key: keyof typeof selectedColumns) => {
    selectSetColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleInventarioExpand = (invName: string) => {
    setExpandedInventarios(prev =>
      prev.includes(invName) ? prev.filter(name => name !== invName) : [...prev, invName]
    );
  };

  const toggleSingleBox = (key: string) => {
    setSelectedBoxKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleEntireInventarioSelection = (invName: string) => {
    const invGroup = inventariosGrouped.find(g => g.nombre === invName);
    if (!invGroup) return;

    const invKeys = invGroup.cajas.map(c => c.key);
    const allSelected = invKeys.every(k => selectedBoxKeys.includes(k));

    if (allSelected) {
      setSelectedBoxKeys(prev => prev.filter(k => !invKeys.includes(k)));
    } else {
      setSelectedBoxKeys(prev => Array.from(new Set([...prev, ...invKeys])));
    }
  };

  const selectAllEverything = () => {
    if (selectedBoxKeys.length === allBoxKeys.length) {
      setSelectedBoxKeys([]);
    } else {
      setSelectedBoxKeys(allBoxKeys);
    }
  };

  const handleExport = () => {
    if (selectedBoxKeys.length === 0) {
      Alert.alert('Atención', 'Selecciona al menos una caja para generar la exportación.');
      return;
    }

    const dataFiltrada = exportData.filter(item => {
      const invName = item.inventarioNombre || 'Inventario Sin Nombre';
      const boxName = item.cajaNombre || 'Caja Sin Nombre';
      return selectedBoxKeys.includes(`${invName}___${boxName}`);
    });

    if (dataFiltrada.length === 0) {
      Alert.alert('Sin Datos', 'No hay prendas para exportar en la selección actual.');
      return;
    }

    const nombreArchivo = `Reporte_Inventario_${selectedBoxKeys.length}_Cajas`;

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
                      Exportación Profesional
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: currentTheme.textSecondary }]}>
                      Selecciona inventarios, cajas y columnas
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
                    Cargando estructura de inventarios...
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                  {/* Sección: Inventarios y Cajas Acordeón */}
                  <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="layers-outline" size={16} color={currentTheme.primary} />
                      <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginBottom: 0 }]}>
                        INVENTARIOS Y CAJAS ({inventariosGrouped.length} lotes)
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

                  {orderedInventariosGrouped.length === 0 ? (
                    <View style={[styles.emptyBoxCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      <Ionicons name="cube-outline" size={32} color={currentTheme.textSecondary} style={{ marginBottom: 6 }} />
                      <Text style={[styles.emptyBoxText, { color: currentTheme.textSecondary }]}>
                        No hay prendas o cajas registradas en la base de datos para exportar.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.accordionContainer}>
                      {orderedInventariosGrouped.map((inv, index) => {
                        const isExpanded = expandedInventarios.includes(inv.nombre);
                        const invKeys = inv.cajas.map(c => c.key);
                        const selectedCountInInv = invKeys.filter(k => selectedBoxKeys.includes(k)).length;
                        const isFullySelected = selectedCountInInv === invKeys.length;
                        const isPartiallySelected = selectedCountInInv > 0 && selectedCountInInv < invKeys.length;

                        return (
                          <View
                            key={inv.nombre}
                            style={[
                              styles.inventoryCard,
                              {
                                backgroundColor: currentTheme.background,
                                borderColor: isExpanded ? currentTheme.primary + '50' : currentTheme.border,
                              },
                            ]}
                          >
                            {/* Encabezado del Inventario / Lote */}
                            <View style={styles.inventoryHeader}>
                              {/* Controles de posición (Subir / Bajar) */}
                              {orderedInventariosGrouped.length > 1 && (
                                <View style={styles.reorderBtnsColumn}>
                                  <TouchableOpacity
                                    disabled={index === 0}
                                    onPress={() => moveInventarioPosition(index, 'up')}
                                    style={[styles.reorderBtn, { opacity: index === 0 ? 0.25 : 1 }]}
                                    accessibilityLabel="Mover lote arriba"
                                  >
                                    <Ionicons name="chevron-up" size={14} color={currentTheme.primary} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    disabled={index === orderedInventariosGrouped.length - 1}
                                    onPress={() => moveInventarioPosition(index, 'down')}
                                    style={[styles.reorderBtn, { opacity: index === orderedInventariosGrouped.length - 1 ? 0.25 : 1 }]}
                                    accessibilityLabel="Mover lote abajo"
                                  >
                                    <Ionicons name="chevron-down" size={14} color={currentTheme.primary} />
                                  </TouchableOpacity>
                                </View>
                              )}

                              {/* Checkbox de selección completa de inventario */}
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => toggleEntireInventarioSelection(inv.nombre)}
                                style={styles.invCheckboxTouch}
                              >
                                <Ionicons
                                  name={
                                    isFullySelected
                                      ? 'checkbox'
                                      : isPartiallySelected
                                      ? 'remove-circle'
                                      : 'square-outline'
                                  }
                                  size={22}
                                  color={
                                    isFullySelected || isPartiallySelected
                                      ? currentTheme.primary
                                      : currentTheme.textSecondary
                                  }
                                />
                              </TouchableOpacity>

                              {/* Título y badge interactivos para expandir/colapsar */}
                              <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => toggleInventarioExpand(inv.nombre)}
                                style={styles.invTitleArea}
                              >
                                <Ionicons name="folder-open" size={18} color={currentTheme.primary} style={{ marginRight: 8 }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.inventoryTitle, { color: currentTheme.text }]} numberOfLines={1}>
                                    {inv.nombre}
                                  </Text>
                                  <Text style={[styles.inventoryMeta, { color: currentTheme.textSecondary }]}>
                                    {inv.cajas.length} caja{inv.cajas.length !== 1 ? 's' : ''} · {inv.totalPrendas} prenda{inv.totalPrendas !== 1 ? 's' : ''}
                                  </Text>
                                </View>

                                {/* Badge numérico de cajas seleccionadas */}
                                <View style={[styles.countBadge, { backgroundColor: currentTheme.primary + '15' }]}>
                                  <Text style={[styles.countBadgeText, { color: currentTheme.primary }]}>
                                    {selectedCountInInv}/{inv.cajas.length}
                                  </Text>
                                </View>

                                {/* Chevron de expansión */}
                                <Ionicons
                                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                  size={18}
                                  color={currentTheme.textSecondary}
                                  style={{ marginLeft: 6 }}
                                />
                              </TouchableOpacity>
                            </View>

                            {/* Cajas hijas dentro del Inventario (Desplegable) */}
                            {isExpanded && (
                              <View style={[styles.boxesSubContainer, { borderTopColor: currentTheme.border }]}>
                                {inv.cajas.map(box => {
                                  const isBoxSelected = selectedBoxKeys.includes(box.key);
                                  return (
                                    <TouchableOpacity
                                      key={box.key}
                                      activeOpacity={0.7}
                                      onPress={() => toggleSingleBox(box.key)}
                                      style={[
                                        styles.boxRow,
                                        {
                                          backgroundColor: isBoxSelected
                                            ? currentTheme.primary + '12'
                                            : currentTheme.card,
                                          borderColor: isBoxSelected ? currentTheme.primary + '40' : currentTheme.border,
                                        },
                                      ]}
                                    >
                                      <Ionicons
                                        name={isBoxSelected ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={18}
                                        color={isBoxSelected ? currentTheme.primary : currentTheme.textSecondary}
                                        style={{ marginRight: 8 }}
                                      />
                                      <Ionicons name="cube-outline" size={16} color={currentTheme.textSecondary} style={{ marginRight: 6 }} />
                                      <Text
                                        style={[
                                          styles.boxRowText,
                                          {
                                            color: isBoxSelected ? currentTheme.primary : currentTheme.text,
                                            fontWeight: isBoxSelected ? '700' : '500',
                                          },
                                        ]}
                                        numberOfLines={1}
                                      >
                                        {box.nombre}
                                      </Text>

                                      <View style={[styles.prendaCountChip, { backgroundColor: currentTheme.border + '40' }]}>
                                        <Text style={[styles.prendaCountText, { color: currentTheme.textSecondary }]}>
                                          {box.prendaCount} p.
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Sección: Columnas del Reporte */}
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary, marginTop: 18 }]}>
                    COLUMNAS DEL REPORTE EXCEL
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
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>OPCIONES AVANZADAS</Text>
                  <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                    <View style={styles.switchRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.switchTitle, { color: currentTheme.text }]}>Separar por Hojas (Pestañas)</Text>
                        <Text style={[styles.switchSubtitle, { color: currentTheme.textSecondary }]}>
                          Crea una pestaña individual en Excel por cada caja seleccionada
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
                        backgroundColor: selectedBoxKeys.length > 0 ? currentTheme.primary : currentTheme.border,
                      },
                    ]}
                    onPress={handleExport}
                    disabled={selectedBoxKeys.length === 0}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="document-text" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.exportBtnText}>
                      {selectedBoxKeys.length > 0
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
  inventoryCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  reorderBtnsColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 6,
    gap: 2,
  },
  reorderBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invCheckboxTouch: {
    paddingRight: 8,
  },
  invTitleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inventoryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  inventoryMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 4,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  boxesSubContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  boxRowText: {
    flex: 1,
    fontSize: 13,
  },
  prendaCountChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prendaCountText: {
    fontSize: 10,
    fontWeight: '600',
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
