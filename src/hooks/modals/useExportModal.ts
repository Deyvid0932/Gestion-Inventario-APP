import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as ImageManipulator from 'expo-image-manipulator';
import { HistoryItem } from '../../types';
import { exportToExcel } from '../../utils/export';
import { useAppStore } from '../../store/useAppStore';
import { R2Service } from '../../services';

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
  quantity?: boolean;
  location: boolean;
  status: boolean;
  image?: boolean;
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
  const [exporting, setExporting] = useState(false);
  const [selectedBoxKeys, setSelectedBoxKeys] = useState<string[]>([]);
  const [expandedInventories, setExpandedInventories] = useState<string[]>([]);
  const [separateBySheet, setSeparateBySheet] = useState(true);
  const [customInvOrder, setCustomInvOrder] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [quantity, setQuantity] = useState('2P');
  const isInitializedRef = useRef(false);

  const [selectedColumns, setSelectedColumns] = useState<SelectedColumns>({
    op: true,
    style: true,
    color: true,
    quantity: false,
    location: false,
    status: false,
    image: false,
  });

  useEffect(() => {
    if (!visible) {
      isInitializedRef.current = false;
      return;
    }
    if (!selection) return;

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      if (exportSelectionDraft) {
        const savedColumns = exportSelectionDraft.selectedColumns;
        const savedSelectionColumns = exportSelectionDraft.formatVersion !== 4
          ? { op: true, style: true, color: true, quantity: false, location: false, status: false, image: false }
          : { image: false, ...savedColumns };
        setSelectedColumns(savedSelectionColumns);
        setSeparateBySheet(false);
        const savedFileName = exportSelectionDraft.fileName?.trim() ? exportSelectionDraft.fileName : 'Prendas para testing';
        const savedQuantity = exportSelectionDraft.quantity?.trim() ? exportSelectionDraft.quantity : '2P';
        setFileName(savedFileName);
        setQuantity(savedQuantity);
        if (savedSelectionColumns !== savedColumns || exportSelectionDraft.formatVersion !== 4) {
          setExportSelectionDraft({ ...exportSelectionDraft, fileName: savedFileName, quantity: savedQuantity, selectedColumns: savedSelectionColumns, separateBySheet: false, formatVersion: 4 });
        }
      } else {
        const defaultColumns = { op: true, style: true, color: true, quantity: false, location: false, status: false, image: false };
        const defaultFileName = 'Prendas para testing';
        const defaultQuantity = '2P';
        setSelectedColumns(defaultColumns);
        setSeparateBySheet(false);
        setFileName(defaultFileName);
        setQuantity(defaultQuantity);
        setExportSelectionDraft({ fileName: defaultFileName, quantity: defaultQuantity, selectedColumns: defaultColumns, separateBySheet: false, formatVersion: 4 });
      }
    }
  }, [visible, selection, exportSelectionDraft, setExportSelectionDraft]);

  const selectionIdsKey = selection?.garmentIds.join('|') || '';

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
      let totalGarments = 0;
      const boxes: BoxItem[] = [];

      boxMap.forEach((count, boxName) => {
        totalGarments += count;
        boxes.push({
          name: boxName,
          garmentCount: count,
          key: `${invName}___${boxName}`,
        });
      });

      result.push({
        name: invName,
        totalGarments,
        boxes,
      });
    });

    return result;
  }, [exportData]);

  const allBoxKeys = useMemo(() => {
    const keys: string[] = [];
    inventoriesGrouped.forEach(inv => {
      inv.boxes.forEach(c => keys.push(c.key));
    });
    return keys;
  }, [inventoriesGrouped]);

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
      if (selection) setExportSelectionDraft({ fileName, quantity, selectedColumns: next, separateBySheet: false, formatVersion: 4 });
      return next;
    });
  }, [fileName, quantity, selection, setExportSelectionDraft]);

  const updateFileName = useCallback((value: string) => {
    setFileName(value);
    if (selection) setExportSelectionDraft({ fileName: value, quantity, selectedColumns, separateBySheet: false, formatVersion: 4 });
  }, [quantity, selectedColumns, selection, setExportSelectionDraft]);

  const updateQuantity = useCallback((value: string) => {
    setQuantity(value);
    if (selection) setExportSelectionDraft({ fileName, quantity: value, selectedColumns, separateBySheet: false, formatVersion: 4 });
  }, [fileName, selectedColumns, selection, setExportSelectionDraft]);

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
    const dataFiltrada = selection
      ? exportData
      : exportData.filter(item => {
          const boxName = item.box_name || 'Caja Sin Nombre';
          const identity = String(item.box_id || `${item.inventory_name || ''}___${boxName}`);
          return selectedBoxKeys.includes(identity) || selectedBoxKeys.includes(`${item.inventory_name || ''}___${boxName}`);
        });

    if (dataFiltrada.length === 0) {
      Alert.alert('Sin Datos', 'No hay prendas para exportar en la selección actual.');
      return;
    }

    const nombreArchivo = selection ? (fileName.trim() || 'Prendas para testing') : `Reporte_Inventario_${selectedBoxKeys.length}_Cajas`;

    const boxesByName = new Map<string, Set<string>>();
    dataFiltrada.forEach(item => {
      const boxName = item.box_name || 'Caja Sin Nombre';
      const identity = String(item.box_id || `${item.inventory_name || ''}___${boxName}`);
      if (!boxesByName.has(boxName)) boxesByName.set(boxName, new Set());
      boxesByName.get(boxName)!.add(identity);
    });

    const normalizedQuantity = quantity.trim() ? quantity.trim() : '2P';

    setExporting(true);
    try {
      const imagesMetaById = new Map<string, Array<{ base64: string; width: number; height: number }>>();
      if (selectedColumns.image && db) {
        const imgLookup = new Map<string, Array<{ uri: string | null; storage_key: string | null }>>();
        const seenOrderByGarment = new Map<string, Set<number>>();
        const ids = dataFiltrada.map(i => i.id);
        for (let i = 0; i < ids.length; i += 400) {
          const chunk = ids.slice(i, i + 400);
          const placeholders = chunk.map(() => '?').join(',');
          const imgRows = await db.getAllAsync<{
            garment_id: string;
            uri: string | null;
            storage_key: string | null;
            order_index: number;
          }>(
            `SELECT garment_id, uri, storage_key, order_index
             FROM garment_images
             WHERE garment_id IN (${placeholders}) AND deleted_at IS NULL
             ORDER BY order_index ASC, updated_at DESC, id DESC`,
            chunk
          );
          for (const r of imgRows) {
            let seenOrders = seenOrderByGarment.get(r.garment_id);
            if (!seenOrders) {
              seenOrders = new Set<number>();
              seenOrderByGarment.set(r.garment_id, seenOrders);
            }
            if (seenOrders.has(r.order_index)) continue;
            seenOrders.add(r.order_index);

            const list = imgLookup.get(r.garment_id) || [];
            list.push({ uri: r.uri, storage_key: r.storage_key });
            imgLookup.set(r.garment_id, list);
          }
        }

        // Procesar miniaturas en lotes pequeños para evitar picos de memoria
        for (let i = 0; i < dataFiltrada.length; i += 5) {
          const batch = dataFiltrada.slice(i, i + 5);
          await Promise.all(
            batch.map(async item => {
              const sources = imgLookup.get(item.id) || [];
              const fallbackUri = (item as any).photo_uri || (item as any).fotoUri || null;
              const fallbackKey = (item as any).primary_storage_key || (item as any).r2Key || null;
              const candidates =
                sources.length > 0
                  ? sources
                  : fallbackUri || fallbackKey
                    ? [{ uri: fallbackUri, storage_key: fallbackKey }]
                    : [];
              if (candidates.length === 0) return;

              const processed: Array<{ base64: string; width: number; height: number }> = [];
              for (const src of candidates) {
                if (!src.uri && !src.storage_key) continue;
                try {
                  const resolved = await R2Service.getResolvedImageUri(src.uri, src.storage_key);
                  if (!resolved) continue;
                  const manipulated = await ImageManipulator.manipulateAsync(
                    resolved,
                    [{ resize: { width: 480 } }],
                    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                  );
                  if (manipulated.base64) {
                    processed.push({
                      base64: manipulated.base64,
                      width: manipulated.width,
                      height: manipulated.height,
                    });
                  }
                } catch (_) {
                  // Continuar si una imagen puntual no está disponible
                }
              }
              if (processed.length > 0) {
                imagesMetaById.set(item.id, processed);
              }
            })
          );
        }
      }

      const maxImagesPerItem = selectedColumns.image
        ? Math.max(1, ...Array.from(imagesMetaById.values()).map(arr => arr.length))
        : 0;

      const dataFinal = dataFiltrada.map(item => {
        const row: any = {};
        const boxName = item.box_name || 'Caja Sin Nombre';
        row['_box_name'] = selection
          ? 'PRUEBA TESTING'
          : (boxesByName.get(boxName)?.size || 0) > 1
            ? `${item.inventory_name || 'Inventario'} - ${boxName}`
            : boxName;
        row['_center_box_title'] = true;
        if (selection) {
          row['_box_title'] = 'PRUEBA TESTING';
          row['_sheet_name'] = 'PRUEBA TESTING';
          row['_merge_box_title'] = true;
        }

        if (selectedColumns.style) row['Estilo'] = item.style;
        if (selectedColumns.op) row['OP'] = item.op || 'S/N';
        if (selectedColumns.color) row['Color'] = item.color;
        if (selection && selectedColumns.quantity) {
          row['Cantidad'] = normalizedQuantity;
        }
        if (selectedColumns.location) {
          if (!selection) row['Inventario'] = item.inventory_name;
          row['Caja'] = item.box_name;
        }
        if (selectedColumns.status) {
          row['Estado'] = item.status === 1 ? 'Activo' : 'Inactivo';
        }
        if (selectedColumns.image) {
          if (maxImagesPerItem <= 1) {
            row['Imagen'] = '';
          } else {
            for (let k = 1; k <= maxImagesPerItem; k++) {
              row[`Imagen ${k}`] = '';
            }
          }
          const imgs = imagesMetaById.get(item.id);
          if (imgs && imgs.length > 0) {
            row['_images'] = imgs;
          }
        }
        return row;
      });

      const exported = await exportToExcel(dataFinal, nombreArchivo, selection ? false : separateBySheet);
      if (exported) {
        if (!selection) onExportSuccess?.();
        onClose();
      }
    } finally {
      setExporting(false);
    }
  }, [
    db,
    selection,
    exportData,
    fileName,
    quantity,
    selectedColumns,
    onExportSuccess,
    onClose,
    selectedBoxKeys,
    separateBySheet,
  ]);

  return {
    loadingData,
    exporting,
    exportData,
    orderedInventoriesGrouped,
    allBoxKeys,
    selectedBoxKeys,
    expandedInventories,
    separateBySheet,
    setSeparateBySheet: updateSeparateBySheet,
    selectedColumns,
    fileName,
    setFileName: updateFileName,
    quantity,
    setQuantity: updateQuantity,
    updateFileName,
    updateQuantity,
    moveInventoryPosition,
    toggleColumn,
    toggleInventoryExpand,
    toggleSingleBox,
    toggleEntireInventorySelection,
    selectAllEverything,
    handleExport,
  };
};
