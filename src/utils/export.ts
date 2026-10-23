import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

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
    const groupTitles: { [key: string]: string } = {};
    const hideGroupTitles: { [key: string]: boolean } = {};
    const mergeGroupTitles: { [key: string]: boolean } = {};
    const centerGroupTitles: { [key: string]: boolean } = {};
    const requestedSheetName = data[0]['_sheet_name'] as string | undefined;
    const hideColumnHeaders = !!data[0]['_hide_column_headers'];
    data.forEach(item => {
      const boxName = item['_box_name'] || 'SIN CAJA';
      if (!groupedData[boxName]) groupedData[boxName] = [];
      groupTitles[boxName] = item['_box_title'] || boxName;
      hideGroupTitles[boxName] = !!item['_hide_box_title'];
      mergeGroupTitles[boxName] = item['_merge_box_title'] !== false;
      centerGroupTitles[boxName] = !!item['_center_box_title'];

      const { _box_name, _box_title, _hide_box_title, _sheet_name, _hide_column_headers, _merge_box_title, _center_box_title, ...rest } = item;
      groupedData[boxName].push(rest);
    });

    const firstItem = data[0];
    const { _box_name: _, _box_title: __, _hide_box_title: ___, _sheet_name: ____, _hide_column_headers: _____, _merge_box_title: ______, _center_box_title: _______, ...headersClean } = firstItem;
    const headers = Object.keys(headersClean).map(h => h.toUpperCase());
    const colCount = headers.length;

    if (separateBySheet) {
      const usedSheetNames = new Set<string>();
      Object.keys(groupedData).forEach(name => {
        const rows: any[][] = [];

        rows.push([`${groupTitles[name].toUpperCase()}`]);
        if (!hideColumnHeaders) rows.push(headers);
        groupedData[name].forEach(item => {
          rows.push(Object.values(item));
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        if (centerGroupTitles[name]) {
          ws['A1'].s = { alignment: { horizontal: 'center', vertical: 'center' } };
        }

        ws['!merges'] = mergeGroupTitles[name] ? [
          { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }
        ] : [];

        ws['!cols'] = Array(colCount).fill({ wch: 15 });
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
      const merges: XLSX.Range[] = [];
      const centeredTitleRows: number[] = [];
      let currentRow = 0;

      Object.keys(groupedData).forEach((name, index) => {
        if (index > 0) {
          rows.push([]);
          rows.push([]);
          currentRow += 2;
        }

        if (!hideGroupTitles[name]) {
          rows.push([`${groupTitles[name].toUpperCase()}`]);
          if (centerGroupTitles[name]) centeredTitleRows.push(currentRow);
          if (mergeGroupTitles[name]) {
            merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: colCount - 1 } });
          }
          currentRow++;
        }
        if (!hideColumnHeaders) {
          rows.push(headers);
          currentRow++;
        }

        groupedData[name].forEach(item => {
          rows.push(Object.values(item));
          currentRow++;
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      centeredTitleRows.forEach(row => {
        ws[XLSX.utils.encode_cell({ r: row, c: 0 })].s = {
          alignment: { horizontal: 'center', vertical: 'center' },
        };
      });
      ws['!merges'] = merges;
      ws['!cols'] = Array(colCount).fill({ wch: 15 });
      XLSX.utils.book_append_sheet(wb, ws, (requestedSheetName || 'Reporte_Por_Cajas').substring(0, 31));
    }

    // El escritor con estilos conserva la alineación del título en Excel.
    const excelWriter = Object.values(centerGroupTitles).some(Boolean)
      ? await import('xlsx-js-style')
      : XLSX;
    const wbout = excelWriter.write(wb, { type: 'base64', bookType: 'xlsx' });
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

