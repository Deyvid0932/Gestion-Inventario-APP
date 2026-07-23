import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const exportToExcel = async (data: any[], fileName: string, separateBySheet: boolean = false) => {
  try {
    if (!data || data.length === 0) {
      Alert.alert("Aviso", "No hay datos para exportar");
      return;
    }

    const wb = XLSX.utils.book_new();

    const groupedData: { [key: string]: any[] } = {};
    data.forEach(item => {
      const cajaName = item['_cajaNombre'] || 'SIN CAJA';
      if (!groupedData[cajaName]) groupedData[cajaName] = [];

      const { _cajaNombre, ...rest } = item;
      groupedData[cajaName].push(rest);
    });

    const firstItem = data[0];
    const { _cajaNombre: _, ...headersClean } = firstItem;
    const headers = Object.keys(headersClean).map(h => h.toUpperCase());
    const colCount = headers.length;

    if (separateBySheet) {
      Object.keys(groupedData).forEach(name => {
        const rows: any[][] = [];

        rows.push([`${name.toUpperCase()}`]);
        rows.push(headers);
        groupedData[name].forEach(item => {
          rows.push(Object.values(item));
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);

        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }
        ];

        ws['!cols'] = Array(colCount).fill({ wch: 15 });
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
      });

    } else {
      const rows: any[][] = [];
      const merges: XLSX.Range[] = [];
      let currentRow = 0;

      Object.keys(groupedData).forEach((name, index) => {
        if (index > 0) {
          rows.push([]);
          rows.push([]);
          currentRow += 2;
        }

        rows.push([`${name.toUpperCase()}`]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: colCount - 1 } });
        currentRow++;
        rows.push(headers);
        currentRow++;

        groupedData[name].forEach(item => {
          rows.push(Object.values(item));
          currentRow++;
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!merges'] = merges;
      ws['!cols'] = Array(colCount).fill({ wch: 15 });
      XLSX.utils.book_append_sheet(wb, ws, "Reporte_Por_Cajas");
    }

    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
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
  } catch (error) {
    console.error("Error en exportación:", error);
    Alert.alert("Error", "No se pudo generar el Excel.");
  }
};
