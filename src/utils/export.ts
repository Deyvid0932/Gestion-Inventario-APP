import * as XLSX from 'xlsx-js-style';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { injectImagesIntoXlsx, XlsxImagePlacement } from './xlsxImageInjector';

type ExportImageMeta = { base64: string; width?: number; height?: number };

const buildColWidths = (
  rows: any[][],
  colCount: number,
  imageColIndices: number[],
  headerRowIndices: number[],
  dataRowIndices: number[]
): XLSX.ColInfo[] => {
  const imageSet = new Set(imageColIndices);
  const hasImages = imageColIndices.length > 0;
  const minTextWidth = hasImages ? 18 : 16;
  const targetRows = [...headerRowIndices, ...dataRowIndices];

  let globalMaxLen = 0;
  for (let colIdx = 0; colIdx < colCount; colIdx++) {
    if (imageSet.has(colIdx)) continue;
    for (const r of targetRows) {
      const val = rows[r]?.[colIdx];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > globalMaxLen) globalMaxLen = len;
      }
    }
  }

  const uniformTextWidth = Math.max(minTextWidth, globalMaxLen + 6);
  return Array.from({ length: colCount }, (_, colIdx) => ({
    wch: imageSet.has(colIdx) ? 18 : uniformTextWidth,
  }));
};

/** Aplica alineación centrada a encabezados y filas (con negrita en encabezados cuando incluye imágenes). */
const applyTableStyles = (
  ws: XLSX.WorkSheet,
  colCount: number,
  headerRowIndices: number[],
  dataRowIndices: number[],
  boldHeaders: boolean
) => {
  const centerAlign = { horizontal: 'center', vertical: 'center' };
  for (const r of headerRowIndices) {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        ws[addr].s = boldHeaders
          ? { font: { bold: true }, alignment: centerAlign }
          : { alignment: centerAlign };
      }
    }
  }
  for (const r of dataRowIndices) {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        ws[addr].s = { alignment: centerAlign };
      }
    }
  }
};

export const exportToExcel = async (
  data: any[],
  fileName: string,
  separateBySheet: boolean = true
): Promise<boolean> => {
  try {
    if (!data || data.length === 0) {
      Alert.alert("Aviso", "No hay datos para exportar");
      return false;
    }

    const wb = XLSX.utils.book_new();

    const groupedData: { [key: string]: any[] } = {};
    const groupedImages: { [key: string]: ExportImageMeta[][] } = {};
    const groupTitles: { [key: string]: string } = {};
    const hideGroupTitles: { [key: string]: boolean } = {};
    const mergeGroupTitles: { [key: string]: boolean } = {};
    const centerGroupTitles: { [key: string]: boolean } = {};
    const requestedSheetName = data[0]['_sheet_name'] as string | undefined;
    const hideColumnHeaders = !!data[0]['_hide_column_headers'];
    data.forEach(item => {
      const boxName = item['_box_name'] || 'SIN CAJA';
      if (!groupedData[boxName]) {
        groupedData[boxName] = [];
        groupedImages[boxName] = [];
      }
      groupTitles[boxName] = item['_box_title'] || boxName;
      hideGroupTitles[boxName] = !!item['_hide_box_title'];
      mergeGroupTitles[boxName] = item['_merge_box_title'] !== false;
      centerGroupTitles[boxName] = !!item['_center_box_title'];

      const {
        _box_name,
        _box_title,
        _hide_box_title,
        _sheet_name,
        _hide_column_headers,
        _merge_box_title,
        _center_box_title,
        _images,
        _image_base64,
        _image_width,
        _image_height,
        ...rest
      } = item;
      groupedData[boxName].push(rest);
      if (Array.isArray(_images)) {
        groupedImages[boxName].push(_images);
      } else if (_image_base64) {
        groupedImages[boxName].push([{ base64: _image_base64, width: _image_width, height: _image_height }]);
      } else {
        groupedImages[boxName].push([]);
      }
    });

    const firstItem = data[0];
    const {
      _box_name: _,
      _box_title: __,
      _hide_box_title: ___,
      _sheet_name: ____,
      _hide_column_headers: _____,
      _merge_box_title: ______,
      _center_box_title: _______,
      _images: ________,
      _image_base64: _________,
      _image_width: __________,
      _image_height: ___________,
      ...headersClean
    } = firstItem;
    const rawKeys = Object.keys(headersClean);
    const headers = rawKeys.map(h => h.toUpperCase());
    const imageColIndices = rawKeys.reduce<number[]>(
      (acc, k, idx) => (k.toLowerCase().startsWith('imagen') ? [...acc, idx] : acc),
      []
    );
    const hasImageCols = imageColIndices.length > 0;
    const colCount = headers.length;
    const imagePlacements: XlsxImagePlacement[] = [];

    if (separateBySheet) {
      const usedSheetNames = new Set<string>();
      Object.keys(groupedData).forEach((name, sheetOffset) => {
        const sheetIndex = sheetOffset + 1;
        const rows: any[][] = [];
        const rowHeights: XLSX.RowInfo[] = [];
        const headerRowIndices: number[] = [];
        const dataRowIndices: number[] = [];

        rows.push([`${groupTitles[name].toUpperCase()}`]);
        rowHeights.push({});
        if (!hideColumnHeaders) {
          headerRowIndices.push(rows.length);
          rows.push(headers);
          rowHeights.push(hasImageCols ? { hpt: 55 } : {});
        }
        groupedData[name].forEach((item, idx) => {
          const rowIdx = rows.length;
          dataRowIndices.push(rowIdx);
          rows.push(Object.values(item));
          const imgList = groupedImages[name][idx] || [];
          const count = Math.min(imgList.length, imageColIndices.length);
          for (let k = 0; k < count; k++) {
            const imgMeta = imgList[k];
            imagePlacements.push({
              sheetIndex,
              row: rowIdx,
              col: imageColIndices[k],
              base64: imgMeta.base64,
              width: imgMeta.width,
              height: imgMeta.height,
            });
          }
          rowHeights.push(hasImageCols ? { hpt: 75 } : {});
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        if (hasImageCols || centerGroupTitles[name]) {
          applyTableStyles(ws, colCount, headerRowIndices, dataRowIndices, hasImageCols);
        }
        if (centerGroupTitles[name]) {
          ws['A1'].s = hasImageCols
            ? { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
            : { alignment: { horizontal: 'center', vertical: 'center' } };
        }

        ws['!merges'] = mergeGroupTitles[name] ? [
          { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }
        ] : [];

        ws['!cols'] = buildColWidths(rows, colCount, imageColIndices, headerRowIndices, dataRowIndices);
        if (hasImageCols || imagePlacements.some(p => p.sheetIndex === sheetIndex)) {
          ws['!rows'] = rowHeights;
        }

        const baseName = (groupTitles[name] || name || 'Caja').substring(0, 31);
        let sheetName = baseName;
        let suffix = 2;
        while (usedSheetNames.has(sheetName)) {
          const ending = ` (${suffix++})`;
          sheetName = `${baseName.substring(0, 31 - ending.length)}${ending}`;
        }
        usedSheetNames.add(sheetName);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

    } else {
      const rows: any[][] = [];
      const rowHeights: XLSX.RowInfo[] = [];
      const merges: XLSX.Range[] = [];
      const centeredTitleRows: number[] = [];
      const headerRowIndices: number[] = [];
      const dataRowIndices: number[] = [];
      let currentRow = 0;

      Object.keys(groupedData).forEach((name, index) => {
        if (index > 0) {
          rows.push([]);
          rows.push([]);
          rowHeights.push({}, {});
          currentRow += 2;
        }

        if (!hideGroupTitles[name]) {
          rows.push([`${groupTitles[name].toUpperCase()}`]);
          rowHeights.push({});
          if (centerGroupTitles[name]) centeredTitleRows.push(currentRow);
          if (mergeGroupTitles[name]) {
            merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: colCount - 1 } });
          }
          currentRow++;
        }
        if (!hideColumnHeaders) {
          headerRowIndices.push(currentRow);
          rows.push(headers);
          rowHeights.push(hasImageCols ? { hpt: 55 } : {});
          currentRow++;
        }

        groupedData[name].forEach((item, idx) => {
          dataRowIndices.push(currentRow);
          rows.push(Object.values(item));
          const imgList = groupedImages[name][idx] || [];
          const count = Math.min(imgList.length, imageColIndices.length);
          for (let k = 0; k < count; k++) {
            const imgMeta = imgList[k];
            imagePlacements.push({
              sheetIndex: 1,
              row: currentRow,
              col: imageColIndices[k],
              base64: imgMeta.base64,
              width: imgMeta.width,
              height: imgMeta.height,
            });
          }
          rowHeights.push(hasImageCols ? { hpt: 75 } : {});
          currentRow++;
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      if (hasImageCols || centeredTitleRows.length > 0) {
        applyTableStyles(ws, colCount, headerRowIndices, dataRowIndices, hasImageCols);
      }
      centeredTitleRows.forEach(row => {
        ws[XLSX.utils.encode_cell({ r: row, c: 0 })].s = hasImageCols
          ? { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
          : { alignment: { horizontal: 'center', vertical: 'center' } };
      });
      ws['!merges'] = merges;
      ws['!cols'] = buildColWidths(rows, colCount, imageColIndices, headerRowIndices, dataRowIndices);
      if (hasImageCols || imagePlacements.length > 0) {
        ws['!rows'] = rowHeights;
      }
      XLSX.utils.book_append_sheet(wb, ws, (requestedSheetName || 'Reporte_Por_Cajas').substring(0, 31));
    }

    let wbout: string;
    if (imagePlacements.length > 0) {
      const bufferOut = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
      wbout = injectImagesIntoXlsx(bufferOut, imagePlacements);
    } else {
      wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    }
    const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 50);
    const uri = `${FileSystem.cacheDirectory}${safeFileName}.xlsx`;

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: 'base64' as any,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Enviar Reporte de Inventario',
        UTI: 'com.microsoft.excel.xlsx'
      });
    }
    return true;
  } catch (error) {
    console.error("Error en exportación:", error);
    Alert.alert("Error", "No se pudo generar el Excel.");
    return false;
  }
};

export const exportSqliteDatabase = async (db?: any) => {
  try {
    if (db && typeof db.execAsync === 'function') {
      try {
        await db.execAsync('PRAGMA wal_checkpoint(FULL);');
      } catch (e) {
        console.warn('Advertencia al ejecutar checkpoint WAL:', e);
      }
    }

    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      Alert.alert('Error', 'No se pudo acceder al sistema de archivos del dispositivo.');
      return;
    }

    const candidatePaths = [
      `${docDir}SQLite/inventario.db`,
      `${docDir}inventario.db`,
      `${docDir}SQLite/inventario`,
      `${docDir}databases/inventario.db`,
    ];

    let foundPath: string | null = null;

    for (const path of candidatePaths) {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        foundPath = path;
        break;
      }
    }

    if (!foundPath) {
      const sqliteDir = `${docDir}SQLite/`;
      const dirInfo = await FileSystem.getInfoAsync(sqliteDir);
      if (dirInfo.exists && dirInfo.isDirectory) {
        const files = await FileSystem.readDirectoryAsync(sqliteDir);
        const dbFile = files.find(f => f.endsWith('.db') || f.includes('inventario'));
        if (dbFile) {
          foundPath = `${sqliteDir}${dbFile}`;
        }
      }
    }

    if (!foundPath) {
      Alert.alert(
        'Base de Datos no encontrada',
        'No se encontró el archivo local inventario.db en el almacenamiento del dispositivo. Asegúrate de haber iniciado la aplicación primero.'
      );
      return;
    }
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const backupFileName = `inventario_backup_${dateStr}_${timeStr}.db`;
    const targetUri = `${FileSystem.cacheDirectory}${backupFileName}`;

    await FileSystem.copyAsync({
      from: foundPath,
      to: targetUri,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Exportar Base de Datos SQLite (inventario.db)',
        UTI: 'public.database',
      });
    } else {
      Alert.alert(
        'Respaldo SQLite generado',
        `El archivo .db se ha guardado en:\n${targetUri}`
      );
    }
  } catch (error: any) {
    console.error('Error al exportar base de datos SQLite:', error);
    Alert.alert('Error', error?.message || 'No se pudo exportar la base de datos SQLite.');
  }
};

