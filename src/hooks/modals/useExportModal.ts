import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { HistoryItem } from '../../types';
import { exportToExcel } from '../../utils/export';
import { useAppStore } from '../../store/useAppStore';

export interface BoxItem {
  name: string;
  garmentCount: number;
  key: string;
}

export interface InventoryGroup {
  name: string;
  totalGarments: number;
  boxes: BoxItem[];
}

export interface SelectedColumns {
  op: boolean;
  style: boolean;
  color: boolean;
  location: boolean;
  status: boolean;
}

interface UseExportModalProps {
  visible: boolean;
  onClose: () => void;
  onExportSuccess?: () => void;
  data?: HistoryItem[];
  selection?: { garmentIds: string[] } | null;
}

export const useExportModal = ({ visible, onClose, onExportSuccess, data: propData, selection }: UseExportModalProps) => {
  const db = useSQLiteContext();
  const exportSelectionDraft = useAppStore(state => state.exportSelectionDraft);
  const setExportSelectionDraft = useAppStore(state => state.setExportSelectionDraft);

  const [exportData, setExportData] = useState<HistoryItem[]>(propData || []);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedBoxKeys, setSelectedBoxKeys] = useState<string[]>([]);
  const [expandedInventories, setExpandedInventories] = useState<string[]>([]);
  const [separateBySheet, setSeparateBySheet] = useState(true);
  const [customInvOrder, setCustomInvOrder] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const selectionIdsKey = selection?.garmentIds.join('|') || '';
  const [selectedColumns, setSelectedColumns] = useState<SelectedColumns>({
    op: true,
    style: true,
    color: true,
    location: false,
    status: false,
  });

  useEffect(() => {
    if (!visible || !selection) return;
    if (exportSelectionDraft) {
      const savedColumns = exportSelectionDraft.selectedColumns;
      const savedSelectionColumns = exportSelectionDraft.formatVersion !== 2
        ? { op: true, style: true, color: true, location: false, status: false }
        : savedColumns;
      setSelectedColumns(savedSelectionColumns);
      setSeparateBySheet(false);
      setFileName(exportSelectionDraft.fileName);
      if (savedSelectionColumns !== savedColumns) {
        setExportSelectionDraft({ ...exportSelectionDraft, selectedColumns: savedSelectionColumns, separateBySheet: false, formatVersion: 2 });
      }
      return;
    }

    const defaultColumns = { op: true, style: true, color: true, location: false, status: false };
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const defaultFileName = `Prendas_${localDate}`;
    setSelectedColumns(defaultColumns);
    setSeparateBySheet(false);
    setFileName(defaultFileName);
    setExportSelectionDraft({ fileName: defaultFileName, selectedColumns: defaultColumns, separateBySheet: false, formatVersion: 2 });
  }, [visible, selectionIdsKey, exportSelectionDraft, setExportSelectionDraft]);

  useEffect(() => {
    if (visible) {
      if (selection) {
        const ids = selection.garmentIds;
        if (ids.length === 0) {
          setExportData([]);
          setLoadingData(false);
          return;
        }

        setLoadingData(true);
        const loadSelected = async () => {
          try {
            const rows: HistoryItem[] = [];
            for (let i = 0; i < ids.length; i += 500) {
              const chunk = ids.slice(i, i + 500);
              const placeholders = chunk.map(() => '?').join(',');
              const chunkRows = await db.getAllAsync<HistoryItem>(`
                SELECT g.*, b.name AS box_name, i.name AS inventory_name
                FROM garments g
                JOIN boxes b ON b.id = g.box_id
                JOIN inventories i ON i.id = b.inventory_id
                WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
                  AND g.id IN (${placeholders})
                ORDER BY g.created_at DESC
              `, chunk);
              rows.push(...chunkRows);
            }
            setExportData(rows);
          } catch (e) {
            console.error('Error al cargar prendas seleccionadas para exportación:', e);
            setExportData([]);
          } finally {
            setLoadingData(false);
          }
        };
        void loadSelected();
      } else if (propData && propData.length > 0) {
        setExportData(propData);
      } else if (db) {
        setLoadingData(true);
        db.getAllAsync<HistoryItem>(`
          SELECT g.id, g.box_id, g.op, g.style, g.color, g.status, g.created_at,
                 ga.alarm_datetime,
                 b.name as box_name, i.name as inventory_name
          FROM garments g
          JOIN boxes b ON g.box_id = b.id
          JOIN inventories i ON b.inventory_id = i.id
          LEFT JOIN garment_alarms ga ON ga.garment_id = g.id AND ga.deleted_at IS NULL
          WHERE g.deleted_at IS NULL AND b.deleted_at IS NULL AND i.deleted_at IS NULL
          ORDER BY i.name ASC, b.name ASC, g.created_at DESC
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
  }, [visible, propData, db, selectionIdsKey]);

  // Estructura jerárquica: Inventario -> Cajas -> Prendas
  const inventoriesGrouped = useMemo<InventoryGroup[]>(() => {
    const map = new Map<string, Map<string, number>>();

    exportData.forEach(item => {
      const invName = item.inventory_name || 'Inventario Sin Nombre';
      const boxName = item.box_name || 'Caja Sin Nombre';

      if (!map.has(invName)) {
        map.set(invName, new Map<string, number>());
      }
      const boxMap = map.get(invName)!;
      boxMap.set(boxName, (boxMap.get(boxName) || 0) + 1);
    });

    const result: InventoryGroup[] = [];

    map.forEach((boxMap, invName) => {
      const boxes: BoxItem[] = [];
      let totalGarments = 0;

      boxMap.forEach((count, boxName) => {
        boxes.push({
          name: boxName,
          garmentCount: count,
          key: `${invName}___${boxName}`,
        });
        totalGarments += count;
      });

      result.push({
        name: invName,
        totalGarments,
        boxes,
      });
    });

    return result;
  }, [exportData]);

  // Claves compuestas de todas las cajas disponibles
  const allBoxKeys = useMemo(() => {
    const keys: string[] = [];
    inventoriesGrouped.forEach(inv => {
      inv.boxes.forEach(c => keys.push(c.key));
    });
    return keys;
  }, [inventoriesGrouped]);

  // Sincronizar el orden de inventarios cuando cambian los datos
  useEffect(() => {
    if (inventoriesGrouped.length > 0) {
      setCustomInvOrder(prev => {
        const names = inventoriesGrouped.map(g => g.name);
        if (prev.length === 0) return names;
        const newNames = names.filter(n => !prev.includes(n));
        return [...prev.filter(n => names.includes(n)), ...newNames];
      });
    }
  }, [inventoriesGrouped]);

  const orderedInventoriesGrouped = useMemo(() => {
    if (customInvOrder.length === 0) return inventoriesGrouped;
    const map = new Map(inventoriesGrouped.map(g => [g.name, g]));
    const result: typeof inventoriesGrouped = [];
    customInvOrder.forEach(name => {
      const g = map.get(name);
      if (g) result.push(g);
    });
    inventoriesGrouped.forEach(g => {
      if (!result.includes(g)) result.push(g);
    });
    return result;
  }, [inventoriesGrouped, customInvOrder]);

  // Seleccionar todas las cajas por defecto al abrir
  useEffect(() => {
    if (visible && allBoxKeys.length > 0) {
      setSelectedBoxKeys(allBoxKeys);
      setExpandedInventories([]);
    }
  }, [visible, allBoxKeys]);

  const moveInventoryPosition = useCallback((index: number, direction: 'up' | 'down') => {
    const newOrder = orderedInventoriesGrouped.map(g => g.name);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setCustomInvOrder(newOrder);
  }, [orderedInventoriesGrouped]);

  const toggleColumn = useCallback((key: keyof SelectedColumns) => {
    setSelectedColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (selection) setExportSelectionDraft({ fileName, selectedColumns: next, separateBySheet: false, formatVersion: 2 });
      return next;
    });
  }, [fileName, selection, setExportSelectionDraft]);

  const updateFileName = useCallback((value: string) => {
    setFileName(value);
    if (selection) setExportSelectionDraft({ fileName: value, selectedColumns, separateBySheet: false, formatVersion: 2 });
  }, [selectedColumns, selection, setExportSelectionDraft]);

  const updateSeparateBySheet = useCallback((value: boolean) => {
    setSeparateBySheet(value);
  }, []);

  const toggleInventoryExpand = useCallback((invName: string) => {
    setExpandedInventories(prev =>
      prev.includes(invName) ? prev.filter(name => name !== invName) : [...prev, invName]
    );
  }, []);

  const toggleSingleBox = useCallback((key: string) => {
    setSelectedBoxKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const toggleEntireInventorySelection = useCallback((invName: string) => {
    const invGroup = inventoriesGrouped.find(g => g.name === invName);
    if (!invGroup) return;

    const invKeys = invGroup.boxes.map(c => c.key);
    const allSelected = invKeys.every(k => selectedBoxKeys.includes(k));

    if (allSelected) {
      setSelectedBoxKeys(prev => prev.filter(k => !invKeys.includes(k)));
    } else {
      setSelectedBoxKeys(prev => Array.from(new Set([...prev, ...invKeys])));
    }
  }, [inventoriesGrouped, selectedBoxKeys]);

  const selectAllEverything = useCallback(() => {
    if (selectedBoxKeys.length === allBoxKeys.length) {
      setSelectedBoxKeys([]);
    } else {
      setSelectedBoxKeys(allBoxKeys);
    }
  }, [selectedBoxKeys.length, allBoxKeys]);

  const handleExport = useCallback(async () => {
    if (!selection && selectedBoxKeys.length === 0) {
      Alert.alert('Atención', 'Selecciona al menos una caja para generar la exportación.');
      return;
    }

    if (!Object.values(selectedColumns).some(Boolean)) {
      Alert.alert('Atención', 'Selecciona al menos una columna para exportar.');
      return;
    }

    const dataFiltrada = selection ? exportData : exportData.filter(item => {
      const invName = item.inventory_name || 'Inventario Sin Nombre';
      const boxName = item.box_name || 'Caja Sin Nombre';
      return selectedBoxKeys.includes(`${invName}___${boxName}`);
    });

    if (dataFiltrada.length === 0) {
      Alert.alert('Sin Datos', 'No hay prendas para exportar en la selección actual.');
      return;
    }

    const nombreArchivo = selection ? fileName.trim() : `Reporte_Inventario_${selectedBoxKeys.length}_Cajas`;
    if (selection && !nombreArchivo) {
      Alert.alert('Atención', 'Escribe un nombre para el archivo Excel.');
      return;
    }

    const boxesByName = new Map<string, Set<string>>();
    dataFiltrada.forEach(item => {
      const boxName = item.box_name || 'Caja Sin Nombre';
      const identity = String(item.box_id || `${item.inventory_name || ''}___${boxName}`);
      if (!boxesByName.has(boxName)) boxesByName.set(boxName, new Set());
      boxesByName.get(boxName)!.add(identity);
    });

    const dataFinal = dataFiltrada.map(item => {
      const row: any = {};
      const boxName = item.box_name || 'Caja Sin Nombre';
      row['_box_name'] = selection
        ? 'PRUEBA TESTING'
        : (boxesByName.get(boxName)?.size || 0) > 1
          ? `${item.inventory_name || 'Inventario'} - ${boxName}`
          : boxName;
      if (selection) {
        row['_box_title'] = 'PRUEBA TESTING';
        row['_sheet_name'] = 'PRUEBA TESTING';
        row['_hide_column_headers'] = true;
        row['_merge_box_title'] = true;
        row['_center_box_title'] = true;
      }

      if (selectedColumns.style) row['Estilo'] = item.style;
      if (selectedColumns.op) row['OP'] = item.op || 'S/N';
      if (selectedColumns.color) row['Color'] = item.color;
      if (selectedColumns.location) {
        if (!selection) row['Inventario'] = item.inventory_name;
        row['Caja'] = item.box_name;
      }
      if (selectedColumns.status) {
        row['Estado'] = item.status === 1 ? 'Activo' : 'Inactivo';
      }
      return row;
    });

    const exported = await exportToExcel(dataFinal, nombreArchivo, selection ? false : separateBySheet);
    if (exported) {
      // expo-sharing no informa si el usuario compartió el archivo o cerró la hoja.
      // Conservamos prendas y configuración para que cerrar o solo abrir Excel no borre la selección.
      if (!selection) onExportSuccess?.();
      onClose();
    }
  }, [selection, selectedBoxKeys, exportData, selectedColumns, fileName, separateBySheet, onClose, onExportSuccess, setExportSelectionDraft]);

  return {
    exportData,
    loadingData,
    inventoriesGrouped,
    orderedInventoriesGrouped,
    allBoxKeys,
    selectedBoxKeys,
    expandedInventories,
    separateBySheet,
    selectedColumns,
    fileName,
    setFileName: updateFileName,
    setSeparateBySheet: updateSeparateBySheet,
    moveInventoryPosition,
    toggleColumn,
    toggleInventoryExpand,
    toggleSingleBox,
    toggleEntireInventorySelection,
    selectAllEverything,
    handleExport,
  };
};
