import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert
} from 'react-native';
import { Navbar } from '../components/Navbar';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useSQLiteContext } from 'expo-sqlite';
import { generateId } from '../database/database';
import { useAppStore } from '../store/useAppStore';
import { useDetallePrenda } from '../hooks/useDetallePrenda';
import { usePrenda } from '../hooks/usePrenda';



export const FormScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Form'>>();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { currentTheme } = useAppStore();
  const { addPrenda } = usePrenda();
  const { addDetalle: addDetallePrenda } = useDetallePrenda();

  const { initialData, entityType, parentId } = route.params || {};
  const [formData, setFormData] = useState<Record<string, string>>(initialData || {});
  const handleSubmit = async () => {
    const isUpdate = !!initialData?.id;
    const id = isUpdate ? initialData!.id : generateId();
    const fecha = new Date().toISOString();

    try {
      if (entityType === 'inventario') {
        if (!formData.nombre?.trim()) 
          return Alert.alert('Aviso', 'El nombre es obligatorio');
        if (isUpdate) {
          await db.runAsync('UPDATE inventarios SET nombre = ?, descripcion = ? WHERE id = ?', [formData.nombre, formData.descripcion || '', id]);
        } else {
          await db.runAsync('INSERT INTO inventarios (id, nombre, descripcion, fechaCreacion, estado) VALUES (?, ?, ?, ?, ?)', [id, formData.nombre, formData.descripcion || '', fecha, 'Activo']);
        }
      } 
      else if (entityType === 'caja') {
        if (!formData.nombre?.trim()) 
          return Alert.alert('Aviso', 'El nombre es obligatorio');
        if (isUpdate) {
          await db.runAsync('UPDATE cajas SET nombre = ? WHERE id = ?', [formData.nombre, id]);
        } else {
          await db.runAsync('INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion) VALUES (?, ?, ?, ?)', [id, parentId!, formData.nombre, fecha]);
        }
      } 
      else if (entityType === 'prenda') {
        // La cantidad (que guardamos en color) es obligatoria
        if (!formData.color?.trim()) 
          return Alert.alert('Aviso', 'La cantidad/color es obligatoria');
        
        if (!formData.estilo?.trim()) {
          return Alert.alert('Error', 'El estilo es obligatorio');
        }

        if (isUpdate) {
          await db.runAsync('UPDATE prendas SET op = ?, estilo = ?, color = ? WHERE id = ?', [formData.op || '', formData.estilo || '', formData.color, id]);
        } else {
          const res = await addPrenda({
            id,
            cajaId: parentId!,
            op: formData.op || '',
            estilo: formData.estilo || '',
            color: formData.color || '',
            estado: 1
          } as any);

          if (!res.success) {
            Alert.alert(
              'Registro Duplicado', 
              res.error || 'Este registro ya existe.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Ir al registro', onPress: () => navigation.goBack() } // Simulamos redirigir
              ]
            );
            return;
          }
        }
      }

      else if (entityType === 'detalle_prenda') {
        if (!formData.color?.trim()) 
          return Alert.alert('Aviso', 'El color es obligatorio');
        if (!formData.estilo?.trim()) {
          return Alert.alert('Error', 'El estilo es obligatorio');
        }
        if (isUpdate) {
          await db.runAsync('UPDATE detalles_prendas SET op = ?, estado = ?, estilo = ?, color = ? WHERE id = ?', [formData.op || '', formData.estado || '', formData.estilo || '', formData.color, id]);
        } else {
          const res = await addDetallePrenda({
            id,
            op: formData.op ,
            estilo: formData.estilo ,
            color: formData.color,
            estado: 1 
          } as any);

          if (!res.success) {
            Alert.alert(
              'Registro Duplicado', 
              res.error || 'Este registro ya existe.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Ir al registro', onPress: () => navigation.goBack() } // Simulamos redirigir
              ]
            );
            return;
          }
        }
      }

      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la información.');
    }
  };

  const getTitle = () => {
    if (entityType === 'inventario') return initialData?.id ? 'Editar Lote' : 'Nuevo Lote';
    if (entityType === 'caja') return initialData?.id ? 'Editar Caja' : 'Nueva Caja';
    return initialData?.id ? 'Editar Prenda' : 'Registrar Prenda';
  };

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <Navbar title={getTitle()} showBackButton />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          

          <View style={[styles.card, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
            
            {/* Campos para INVENTARIO y CAJA */}
            {(entityType === 'inventario' || entityType === 'caja') && (
              <>
                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Nombre</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.nombre}
                  onChangeText={t => setFormData({...formData, nombre: t})}
                  placeholder="Ingrese el nombre"
                  placeholderTextColor={currentTheme.textSecondary}
                />
              </>
            )}

            {/* Campo Extra solo para INVENTARIO */}
            {entityType === 'inventario' && (
              <>
                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Descripción</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.descripcion}
                  onChangeText={t => setFormData({...formData, descripcion: t})}
                  placeholder="Descripción (opcional)"
                  placeholderTextColor={currentTheme.textSecondary}
                />
              </>
            )}

            {/* Campos para PRENDA */}
            {entityType === 'prenda' && (
              <>
               <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Estilo - Obligatorio</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.estilo}
                  onChangeText={t => setFormData({...formData, estilo: t})}
                  placeholder=""
                  placeholderTextColor={currentTheme.textSecondary}
                />

                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>OP - Opcional</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.op}
                  onChangeText={t => setFormData({...formData, op: t})}
                  placeholder=""
                  placeholderTextColor={currentTheme.textSecondary}
                />

                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Color - Obligatorio</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.color}
                  onChangeText={t => setFormData({...formData, color: t})}
                  placeholder=""
                  placeholderTextColor={currentTheme.textSecondary}
                />
              </>
            )}

            {entityType === 'detalle_prenda' && (
              <>
                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Estilo - Obligatorio</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.estilo}
                  onChangeText={t => setFormData({...formData, estilo: t})}
                  placeholder=""
                  placeholderTextColor={currentTheme.textSecondary}
                />

                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>OP (Orden de Producción) - Opcional</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.op}
                  onChangeText={t => setFormData({...formData, op: t})}
                  placeholder=""
                  placeholderTextColor={currentTheme.textSecondary}
                />

                <Text style={[styles.label, { color: currentTheme.textSecondary }]}>Color (Referencia)- Obligatorio</Text>
                <TextInput
                  style={[styles.input, { color: currentTheme.text, borderColor: currentTheme.border }]}
                  value={formData.color}
                  onChangeText={t => setFormData({...formData, color: t})}
                  placeholder=""
                  placeholderTextColor={currentTheme.textSecondary}
                />

              </>
            )}

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: currentTheme.primary }]} onPress={handleSubmit}>
              <Text style={styles.saveText}>{initialData?.id ? 'Actualizar' : 'Guardar Registro'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  scanText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  card: { padding: 20, borderRadius: 15, borderWidth: 1, elevation: 3 },
  label: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  input: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, fontSize: 16, marginBottom: 15 },
  saveBtn: { height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});
