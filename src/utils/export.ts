import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy'; 
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export const exportToExcel = async (data: any[], fileName: string) => {
  console.log("🚀 Iniciando exportación...");
  console.log("📦 Datos a exportar:", JSON.stringify(data, null, 2));
  
  
  try {
    if (!data || data.length === 0) {
      Alert.alert("Aviso", "No hay datos para exportar");
      return;
    }
    
    // 1. PRIMERO: Preparamos los datos (Mapeo)
    const datosFormateados = data.map(item => ({
      'Orden de Producción': item.op,
      'Estilo / Modelo': item.estilo,
      'Color de Prenda': item.color,
      'Ubicación': `Lote: ${item.inventarioNombre || 'S/N'} - Caja: ${item.cajaNombre || 'S/N'}`,
      'Estado': Number(item.estado) === 1 ? 'Activo' : 'Inactivo'
    }));

    // 2. SEGUNDO: Creamos el libro de Excel (Workbook)
    const ws = XLSX.utils.json_to_sheet(datosFormateados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Inventario");

    // 3. TERCERO: Convertimos a Base64
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // 4. CUARTO: Definimos la ruta y escribimos el archivo
    // Usamos una ruta segura para evitar errores de directorio
    const uri = `${FileSystem.cacheDirectory}${fileName}.xlsx`;

    await FileSystem.writeAsStringAsync(uri, wbout, {
      encoding: 'base64' as any,
    });

    // 5. QUINTO: Compartimos el archivo generado
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
    console.error("❌ Error en la exportación:", error);
    Alert.alert("Error", "Hubo un fallo al generar el Excel.");
  }
};