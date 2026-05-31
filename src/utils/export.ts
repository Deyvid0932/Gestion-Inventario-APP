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

    // =========================================================================
    // CAMINO 1: AGRUPADO POR HOJAS (Mantiene tu lógica intacta si decides usarla)
    // =========================================================================
    if (separateBySheet) {
      const groupedData: { [key: string]: any[] } = {};

      data.forEach(item => {
        const cajaName = item['_cajaNombre'] || 'General';
        if (!groupedData[cajaName]) groupedData[cajaName] = [];

        const { _cajaNombre, ...limpio } = item;
        groupedData[cajaName].push(limpio);
      });

      Object.keys(groupedData).forEach(name => {
        const ws = XLSX.utils.json_to_sheet(groupedData[name]);
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
      });

    // =========================================================================
    // CAMINO 2: UNA SOLA HOJA SEPARADA POR BLOQUES VISUALES (¡Tu Segunda Imagen!)
    // =========================================================================
    } else {
      // 1. Agrupamos los datos en memoria por el nombre de la caja
      const groupedData: { [key: string]: any[] } = {};
      data.forEach(item => {
        const cajaName = item['_cajaNombre'] || 'SIN CAJA';
        if (!groupedData[cajaName]) groupedData[cajaName] = [];
        
        // Quitamos la propiedad interna para que las columnas salgan limpias
        const { _cajaNombre, ...rest } = item;
        groupedData[cajaName].push(rest);
      });

      // 2. Creamos una matriz de filas vacía para construir el Excel a mano
      const rows: any[][] = [];

      // Extraemos los encabezados de las columnas dinámicamente usando el primer elemento
      const firstItem = data[0];
      const { _cajaNombre, ...headersClean } = firstItem;
      const headers = Object.keys(headersClean).map(h => h.toUpperCase()); // Encabezados en Mayúsculas

      // 3. Iteramos sobre cada caja para armar los bloques visuales
      Object.keys(groupedData).forEach((cajaName, index) => {
        // Si no es la primera caja, dejamos dos filas en blanco de separación para el digitador
        if (index > 0) {
          rows.push([]);
          rows.push([]);
        }

        // Insertamos el Banner/Encabezado de la Caja (Fila divisoria visual)
        rows.push([`📦 SECCIÓN: ${cajaName.toUpperCase()}`]);
        
        // Insertamos los nombres de las columnas debajo del título de la caja
        rows.push(headers);

        // Insertamos todas las prendas que pertenecen a esta caja
        groupedData[cajaName].forEach(item => {
          rows.push(Object.values(item));
        });
      });

      // 4. Convertimos la matriz (AoA: Array of Arrays) en una Hoja de Excel
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // (Opcional) Ajustamos el ancho de las columnas automáticamente para que no se corte el texto
      const maxCols = headers.length;
      ws['!cols'] = Array(maxCols).fill({ wch: 15 }); // Ancho por defecto de 15 caracteres

      XLSX.utils.book_append_sheet(wb, ws, "Reporte_Por_Cajas");
    }

    // =========================================================================
    // PROCESAMIENTO BINARIO Y COMPARTICIÓN (Tu lógica nativa perfecta)
    // =========================================================================
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const uri = `${FileSystem.cacheDirectory}${fileName}.xlsx`;
    
    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: 'base64' as any,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Enviar Reporte de Inventario',
        UTI: 'com.microsoft.excel.xlsx'
      });
    } else {
      Alert.alert("Error", "Tu dispositivo no permite compartir archivos.");
    }

  } catch (error) {
    console.error("Error en la exportación:", error);
    Alert.alert("Error", "Hubo un fallo al generar el Excel.");
  }
};