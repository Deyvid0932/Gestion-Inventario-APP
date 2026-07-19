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
  ActivityIndicator,
  Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Navbar } from '../components/Navbar';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useSQLiteContext } from 'expo-sqlite';
import { generateId } from '../database/database';
import { useAppStore } from '../store/useAppStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrendaService } from '../services/PrendaService';
import { usePrenda } from '../hooks/usePrenda';
import { Ionicons } from '@expo/vector-icons';
import { getColorHex } from '../utils/colorUtils';

export const FormScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Form'>>();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { currentTheme } = useAppStore();
  const insets = useSafeAreaInsets();
  const { addPrenda } = usePrenda();
  const lastSubmitTime = useRef(0);
 

  const { initialData, entityType, parentId } = route.params || {};
  const [formData, setFormData] = useState<Record<string, string>>(initialData || {});
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [imageUri, setImageUri] = useState<string | null>(initialData?.fotoUri || null);

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
    const now = Date.now();
    if (now - lastSubmitTime.current < 400) return;
    lastSubmitTime.current = now;

    const isUpdate = !!initialData?.id;
    const id = isUpdate ? initialData!.id : generateId();
    const fecha = new Date().toISOString();

    let isValid = true;
    if (entityType === 'inventario' || entityType === 'caja') {
      if (!isFieldValid('nombre')) isValid = false;
    } else if (entityType === 'prenda') {
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
          fotoUri: imageUri || null,
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
        <ScrollView 
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 20) }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
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

            {(entityType === 'prenda') && (
              <>
                {renderInput('Estilo', 'estilo', 'Ej. Polo Slim')}
                {renderInput('OP', 'op', 'Orden de Producción', true)}
                {renderInput('Color', 'color', 'Ej. Rojo')}
                
                {/* Selector de imagen */}
                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: currentTheme.textSecondary }]}>
                      Foto <Text style={{ color: currentTheme.textSecondary, fontSize: 10, fontWeight: '400' }}>(opcional)</Text>
                    </Text>
                  </View>
                  {imageUri ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => setImageUri(null)}
                      >
                        <Ionicons name="close-circle" size={28} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.imagePickerRow}>
                      <TouchableOpacity
                        style={[styles.imagePickerBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                        onPress={async () => {
                          const { status } = await ImagePicker.requestCameraPermissionsAsync();
                          if (status !== 'granted') { Alert.alert('Permiso', 'Se necesita acceso a la cámara.'); return; }
                          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                          if (!result.canceled && result.assets[0]) {
                            const optimized = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 600 } }], { compress: 0.8, format: SaveFormat.JPEG });
                            const fileName = `prenda_${Date.now()}.jpg`;
                            const destUri = `${FileSystem.documentDirectory}${fileName}`;
                            await FileSystem.copyAsync({ from: optimized.uri, to: destUri });
                            setImageUri(destUri);
                          }
                        }}
                      >
                        <Ionicons name="camera-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.imagePickerText, { color: currentTheme.text }]}>Cámara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imagePickerBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                        onPress={async () => {
                          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (status !== 'granted') { Alert.alert('Permiso', 'Se necesita acceso a la galería.'); return; }
                          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
                          if (!result.canceled && result.assets[0]) {
                            const optimized = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 600 } }], { compress: 0.8, format: SaveFormat.JPEG });
                            const fileName = `prenda_${Date.now()}.jpg`;
                            const destUri = `${FileSystem.documentDirectory}${fileName}`;
                            await FileSystem.copyAsync({ from: optimized.uri, to: destUri });
                            setImageUri(destUri);
                          }
                        }}
                      >
                        <Ionicons name="images-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.imagePickerText, { color: currentTheme.text }]}>Galería</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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
                  <ActivityIndicator color={currentTheme.primaryText} />
                ) : (
                  <Text style={[styles.saveText, { color: currentTheme.primaryText }]}>{initialData?.id ? 'Actualizar' : 'Guardar Registro'}</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 20 },
  card: { 
    padding: 18, 
    borderRadius: 22, 
    borderWidth: 1, 
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  inputWrapper: { marginBottom: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderRadius: 12, 
    paddingHorizontal: 15,
    height: 52,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  input: { flex: 1, fontSize: 15, height: '100%', paddingVertical: 0 },
  checkIcon: { marginLeft: 10 },
  saveBtn: { 
    height: 54, 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
  },
});
