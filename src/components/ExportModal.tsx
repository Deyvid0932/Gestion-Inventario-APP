import { useMemo, useState } from "react";
import { HistoryItem } from "../types"
import { Alert, Dimensions, Text, TouchableOpacity, View, Modal, StyleSheet } from "react-native";
import { exportToExcel } from "../utils/export";
import { Ionicons } from "@expo/vector-icons";
import { ScrollView, Switch } from "react-native-gesture-handler";
import { useAppStore } from "../store/useAppStore";


const { width, height } = Dimensions.get('window');

interface ExportModal {
    visible: boolean;
    onClose: () => void;
    data: HistoryItem[];
    title?: string;
}

export const ExportModal = ({ visible, onClose, data }: ExportModal) => {
    const { currentTheme } = useAppStore();

    const availableBoxes = useMemo(() => {
        return Array.from(new Set(data.map(item => item.cajaNombre)));
    }, [data]);

    //cajas que quiere exportar el usuario
    const [selectedBoxes, setSelectedBoxes] = useState<string[]>(availableBoxes);

    //Es un diccionario que guarda qué columnas
    const [separateBySheet, setSeparateBySheet] = useState(false);

    //Boleano para separar por exportación
    const [selectedColumns, selectSetColumns] = useState({
        op: false,
        estilo: true,
        color: true,
        estado: false,
        ubicacion: false,
    })

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
        Alert.alert("Atención", "Selecciona al menos una caja para exportar.");
        return;
    }

    let nombreArchivo = ""
    if (selectedBoxes.length === 1) {
        nombreArchivo = `Reporte_${selectedBoxes[0]}`
    } else {
        nombreArchivo = `Reporte_${selectedBoxes}`
    }

    const finalFileName = `${nombreArchivo}`

    // A. Filtrar prendas por las cajas elegidas
    const dataFiltrada = data.filter(item => selectedBoxes.includes(item.cajaNombre));

    // B. Formatear columnas según la selección del usuario
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

    exportToExcel(dataFinal, finalFileName, separateBySheet );

    onClose();
};
return (
    <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
            <View style={[styles.card, { backgroundColor: currentTheme.card }]}>

                {/* HEADER */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: currentTheme.text }]}>Configurar Exportación</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={currentTheme.textSecondary} />
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* SECCIÓN 1: SELECCIONAR CAJAS */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: currentTheme.textSecondary }]}>SELECCIONAR CAJAS</Text>
                            <TouchableOpacity onPress={selectAllBoxes}>
                                <Text style={{ color: currentTheme.primary, fontWeight: '700' }}>
                                    {selectedBoxes.length === availableBoxes.length ? 'Desmarcar todo' : 'Todas'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                                     <View style={styles.chipsContainer}>
                            {availableBoxes.map(box => (
                                <TouchableOpacity
                                    key={box}
                                    onPress={() => toggleBox(box)}
                                    style={[
                                        styles.chip,
                                        { borderColor: currentTheme.border },
                                        selectedBoxes.includes(box) && { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }
                                    ]}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        { color: currentTheme.textSecondary },
                                        selectedBoxes.includes(box) && { color: '#FFF' }
                                    ]}>{box}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* SECCIÓN 2: COLUMNAS A MOSTRAR */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: currentTheme.textSecondary }]}>COLUMNAS DEL EXCEL</Text>
                        {[
                            { label: 'Orden de Producción (OP)', key: 'op' },
                            { label: 'Estilo', key: 'estilo' },
                            { label: 'Color de Prenda', key: 'color' },
                            { label: 'Ubicación (Inventario. y Caja)', key: 'ubicacion' },
                            { label: 'Estado (Activo/Inactivo)', key: 'estado' },
                        ].map(col => (
                            <TouchableOpacity
                                key={col.key}
                                style={styles.checkRow}
                                onPress={() => toggleColumn(col.key as any)}
                            >
                                <Ionicons
                                    name={selectedColumns[col.key as keyof typeof selectedColumns] ? "checkbox" : "square-outline"}
                                    size={22}
                                    color={selectedColumns[col.key as keyof typeof selectedColumns] ? currentTheme.primary : currentTheme.textSecondary}
                                />
                                <Text style={[styles.checkLabel, { color: currentTheme.text }]}>{col.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* SECCIÓN 3: CONFIGURACIÓN EXTRA */}
                    <View style={[styles.section, styles.switchRow]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.checkLabel, { color: currentTheme.text, fontWeight: '700' }]}>Separar por hojas</Text>
                            <Text style={{ color: currentTheme.textSecondary, fontSize: 11 }}>Crea una pestaña de Excel por cada caja</Text>
                        </View>
                        <Switch
                            value={separateBySheet}
                            onValueChange={setSeparateBySheet}
                            trackColor={{ false: "#767577", true: currentTheme.primary + '80' }}
                            thumbColor={separateBySheet ? currentTheme.primary : "#f4f3f4"}
                        />
                    </View>
                </ScrollView>

                          {/* BOTÓN FINAL */}
                         <TouchableOpacity
                    style={[styles.exportBtn, { backgroundColor: currentTheme.primary }]}
                    onPress={handleExport}
                >
                    <Text style={styles.exportBtnText}>Generar Reporte Excel</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>
);
};



const styles = StyleSheet.create({
      overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
      card: { width: width * 0.9, maxHeight: height * 0.8, borderRadius: 20, padding: 20, elevation: 5 },
      header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
      title: { fontSize: 18, fontWeight: '800' },
      section: { marginBottom: 20 },
      sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
      sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
      chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
      chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
      chipText: { fontSize: 12, fontWeight: '600' },
      checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
      checkLabel: { fontSize: 14, fontWeight: '500' },
      switchRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
      exportBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
      exportBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 }
 });

