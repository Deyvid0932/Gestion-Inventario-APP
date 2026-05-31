import React, { useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  Animated,
  ActivityIndicator
} from 'react-native';
import { Navbar } from '../components/Navbar';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useSQLiteContext } from 'expo-sqlite';
import { generateId } from '../database/database';
import { useAppStore } from '../store/useAppStore';
import { useDetallePrenda } from '../hooks/useDetallePrenda';
import { DetallePrendaService } from '../services/DetallePrendaService';
import { PrendaService } from '../services/PrendaService';
import { usePrenda } from '../hooks/usePrenda';
import { Ionicons } from '@expo/vector-icons';
import { getColorHex } from '../utils/colorUtils';

export const FormScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Form'>>();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { currentTheme } = useAppStore();
  const { addPrenda } = usePrenda();
  const { addDetalle: addDetallePrenda } = useDetallePrenda();

  const { initialData, entityType, parentId } = route.params || {};
  const [formData, setFormData] = useState<Record<string, string>>(initialData || {});
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const onPressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true, tension: 100 }).start();
  };

  const onPressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true, tension: 100 }).start();
  };

  const isFieldValid = (field: string) => {
    return !!(formData[field] && formData[field].trim().length > 0);
  };

  const handleSubmit = async () => {
    const isUpdate = !!initialData?.id;
    const id = isUpdate ? initialData!.id : generateId();
    const fecha = new Date().toISOString();

    let isValid = true;
    if (entityType === 'inventario' || entityType === 'caja') {
      if (!isFieldValid('nombre')) isValid = false;
    } else if (entityType === 'prenda' || entityType === 'detalle_prenda') {
      if (!isFieldValid('color') || !isFieldValid('estilo')) isValid = false;
    }

    if (!isValid) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      if (entityType === 'inventario') {
        if (isUpdate) {
          await db.runAsync('UPDATE inventarios SET nombre = ?, descripcion = ? WHERE id = ?', [formData.nombre, formData.descripcion || '', id]);
        } else {
          await db.runAsync('INSERT INTO inventarios (id, nombre, descripcion, fechaCreacion, estado) VALUES (?, ?, ?, ?, ?)', [id, formData.nombre, formData.descripcion || '', fecha, 'Activo']);
        }
      } 
      else if (entityType === 'caja') {
        if (isUpdate) {
          await db.runAsync('UPDATE cajas SET nombre = ? WHERE id = ?', [formData.nombre, id]);
        } else {
          await db.runAsync('INSERT INTO cajas (id, inventarioId, nombre, fechaCreacion) VALUES (?, ?, ?, ?)', [id, parentId!, formData.nombre, fecha]);
        }
      } 
      else if (entityType === 'prenda') {
        const prendaData = {
          id,
          cajaId: parentId!,
          op: formData.op || '',
          estilo: formData.estilo || '',
          color: formData.color || '',
          estado: 1
        } as any;

        if (isUpdate) {
          const res = await PrendaService.updatePrenda(db, prendaData);
          if (!res.success) {
            Alert.alert('Registro Duplicado', res.error || 'Esta OP ya existe en otra prenda de esta caja.');
            setLoading(false);
            return;
          }
        } else {
          const res = await addPrenda(prendaData);

          if (!res.success) {
            Alert.alert("Error", res.error);
            setLoading(false);
            return;
          }
        }
      }
      else if (entityType === 'detalle_prenda') {
        const detalleData = {
          id,
          detalleId: parentId || initialData?.detalleId,
          op: formData.op || '',
          estilo: formData.estilo || '',
          color: formData.color || '',
          estado: formData.estado !== undefined ? Number(formData.estado) : 1
        } as any;

        if (isUpdate) {
          const res = await DetallePrendaService.updateDetallePrenda(db, detalleData);
          if (!res.success) {
            Alert.alert('Registro Duplicado', res.error || 'Esta OP ya existe en otro registro.');
            setLoading(false);
            return;
          }
        } else {
          const res = await addDetallePrenda(detalleData);

          if (!res.success) {
            Alert.alert("Error", res.error);
            setLoading(false);
            return;
          }
        }
      }
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la información.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (entityType === 'inventario') return initialData?.id ? 'Editar Lote' : 'Nuevo Lote';
    if (entityType === 'caja') return initialData?.id ? 'Editar Caja' : 'Nueva Caja';
    return initialData?.id ? 'Editar Prenda' : 'Registrar Prenda';
  };

  const getColorPreview = (text: string) => {
    if (!text) return null;
    const hex = getColorHex(text);
    return hex === '#8E8E93' ? null : hex; // No mostrar si es el gris por defecto
  };

  const renderInput = (label: string, field: string, placeholder: string, optional = false) => {
    const isValid = isFieldValid(field);
    const isFocused = focusedField === field;
    const colorPreview = field === 'color' ? getColorPreview(formData[field]) : null;

    return (
      <View style={styles.inputWrapper} key={field}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: currentTheme.textSecondary }]}>
            {label} {!optional && <Text style={{ color: '#FF3B30' }}>*</Text>}
          </Text>
          {colorPreview && (
            <View style={[styles.colorDot, { backgroundColor: colorPreview, borderColor: currentTheme.border, borderWidth: 1 }]} />
          )}
        </View>
        <View style={[
          styles.inputContainer, 
          { 
            backgroundColor: currentTheme.card, 
            borderColor: isFocused ? currentTheme.primary : (formData[field] && !isValid && !optional ? '#FF3B30' : currentTheme.border),
            borderWidth: isFocused ? 2 : 1,
          }
        ]}>
          <TextInput
            style={[styles.input, { color: currentTheme.text }]}
            value={formData[field] || ''}
            onChangeText={t => setFormData(prev => ({...prev, [field]: t}))}
            placeholder={placeholder}
            placeholderTextColor={currentTheme.textSecondary}
            onFocus={() => setFocusedField(field)}
            onBlur={() => setFocusedField(null)}
          />
          {isValid && !optional && (
            <Ionicons name="checkmark-circle" size={20} color="#34C759" style={styles.checkIcon} />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
      <Navbar title={getTitle()} showBackButton />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          <Animated.View style={[
            styles.card, 
            { 
              backgroundColor: currentTheme.card, 
              borderColor: currentTheme.border,
              transform: [{ translateX: shakeAnim }]
            }
          ]}>
            
            {(entityType === 'inventario' || entityType === 'caja') && renderInput('Nombre', 'nombre', 'Ingrese el nombre')}
            
            {entityType === 'inventario' && renderInput('Descripción', 'descripcion', 'Descripción opcional', true)}

            {(entityType === 'prenda' || entityType === 'detalle_prenda') && (
              <>
                {renderInput('Estilo', 'estilo', 'Ej. Polo Slim')}
                {renderInput('OP', 'op', 'Orden de Producción', true)}
                {renderInput('Color', 'color', 'Ej. Rojo')}
              </>
            )}

            <TouchableOpacity 
              activeOpacity={1}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onPress={handleSubmit}
              disabled={loading}
              style={{ marginTop: 15 }}
            >
              <Animated.View style={[
                styles.saveBtn, 
                { 
                  backgroundColor: currentTheme.primary,
                  transform: [{ scale: buttonScale }],
                  opacity: loading ? 0.7 : 1
                }
              ]}>
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveText}>{initialData?.id ? 'Actualizar' : 'Guardar Registro'}</Text>
                )}
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  card: { 
    padding: 22, 
    borderRadius: 24, 
    borderWidth: 1, 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
  },
  inputWrapper: { marginBottom: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 14, 
    paddingHorizontal: 16,
    height: 58,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  input: { flex: 1, fontSize: 16, height: '100%', paddingVertical: 0 },
  checkIcon: { marginLeft: 10 },
  saveBtn: { 
    height: 58, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: '800' }
});
