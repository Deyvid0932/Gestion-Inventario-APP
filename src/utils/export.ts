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

    // 1. Agrupar datos por nombre de caja
    const groupedData: { [key: string]: any[] } = {};
    data.forEach(item => {
      const cajaName = item['_cajaNombre'] || 'SIN CAJA';
      if (!groupedData[cajaName]) groupedData[cajaName] = [];
      
      const { _cajaNombre, ...rest } = item;
      groupedData[cajaName].push(rest);
    });

    // 2. Extraer encabezados (limpios)
    const firstItem = data[0];
    const { _cajaNombre: _, ...headersClean } = firstItem;
    const headers = Object.keys(headersClean).map(h => h.toUpperCase());
    const colCount = headers.length;

    if (separateBySheet) {
      // --- MODO: PESTAÑAS SEPARADAS ---
      Object.keys(groupedData).forEach(name => {
        const rows: any[][] = [];
        
        // Fila 0: Título de Sección
        rows.push([`${name.toUpperCase()}`]);
        // Fila 1: Encabezados
        rows.push(headers);
        // Filas 2+: Datos
        groupedData[name].forEach(item => {
          rows.push(Object.values(item));
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // COMBINAR CELDAS DEL TÍTULO (De la columna A hasta la última)
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }
        ];

        ws['!cols'] = Array(colCount).fill({ wch: 15 });
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
      });

    } else {
      // --- MODO: UNA SOLA HOJA ---
      const rows: any[][] = [];
      const merges: XLSX.Range[] = [];
      let currentRow = 0;

      Object.keys(groupedData).forEach((name, index) => {
        // Espacio entre secciones
        if (index > 0) {
          rows.push([]);
          rows.push([]);
          currentRow += 2;
        }

        // TÍTULO DE LA SECCIÓN (Combinado)
        rows.push([`${name.toUpperCase()}`]);
        merges.push({ s: { r: currentRow, c: 0 }, e: { r: currentRow, c: colCount - 1 } });
        currentRow++;

        // ENCABEZADOS
        rows.push(headers);
        currentRow++;

        // DATOS
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

    // 3. GENERAR Y COMPARTIR
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
