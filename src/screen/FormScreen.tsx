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
  Image,
  Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { AlarmService } from '../services/AlarmService';
import { usePrenda } from '../hooks/usePrenda';
import { Ionicons } from '@expo/vector-icons';
import { clayStyles } from '../style/theme';
import { getColorHex } from '../utils/colorUtils';

export const FormScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Form'>>();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { currentTheme, themeMode } = useAppStore();
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
  const [imageUri2, setImageUri2] = useState<string | null>(initialData?.fotoUri2 || null);

  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(!!initialData?.alarmaFechaHora);
  const [alarmDate, setAlarmDate] = useState<Date>(() => {
    if (initialData?.alarmaFechaHora) {
      return new Date(initialData.alarmaFechaHora);
    }
    const d = new Date(Date.now() + 3600000);
    d.setSeconds(0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const pickImage = async (slot: 1 | 2, source: 'camera' | 'library') => {
    try {
      let status;
      if (source === 'camera') {
        const res = await ImagePicker.requestCameraPermissionsAsync();
        status = res.status;
      } else {
        const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = res.status;
      }

      if (status !== 'granted') {
        Alert.alert('Permiso', `Se necesita acceso a la ${source === 'camera' ? 'cámara' : 'galería'}.`);
        return;
      }

      const options = {
        mediaTypes: ['images'] as any,
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.8
      };

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        const optimized = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 600 } }],
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        const fileName = `prenda_${Date.now()}_slot${slot}.jpg`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: optimized.uri, to: destUri });
        if (slot === 1) {
          setImageUri(destUri);
        } else {
          setImageUri2(destUri);
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
    }
  };

  const removeImage = (slot: 1 | 2) => {
    if (slot === 1) {
      if (imageUri2) {
        setImageUri(imageUri2);
        setImageUri2(null);
      } else {
        setImageUri(null);
      }
    } else {
      setImageUri2(null);
    }
  };

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
        let finalNotificationId: string | null = initialData?.alarmaNotificationId || null;
        let finalAlarmaFechaHora: string | null = initialData?.alarmaFechaHora || null;

        if (alarmEnabled) {
          if (initialData?.alarmaNotificationId) {
            await AlarmService.cancelPrendaAlarm(initialData.alarmaNotificationId);
          }
          if (alarmDate.getTime() > Date.now()) {
            const cajaIdVal = parentId || initialData?.cajaId || '';
            const cajaNomVal = initialData?.cajaNombre || 'Caja';
            const newNotifId = await AlarmService.schedulePrendaAlarm(
              id,
              cajaIdVal,
              cajaNomVal,
              formData.estilo || 'Sin Estilo',
              formData.op || 'Sin OP',
              formData.color || 'Sin Color',
              alarmDate
            );
            if (newNotifId) {
              finalNotificationId = newNotifId;
              finalAlarmaFechaHora = alarmDate.toISOString();
            }
          }
        } else if (initialData?.alarmaNotificationId) {
          await AlarmService.cancelPrendaAlarm(initialData.alarmaNotificationId);
          finalNotificationId = null;
          finalAlarmaFechaHora = null;
        }

        const prendaData = {
          id,
          cajaId: parentId || initialData?.cajaId,
          op: formData.op || '',
          estilo: formData.estilo || '',
          color: formData.color || '',
          fotoUri: imageUri || null,
          fotoUri2: imageUri2 || null,
          estado: 1,
          alarmaFechaHora: finalAlarmaFechaHora,
          alarmaNotificationId: finalNotificationId,
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
    return hex === '#8E8E93' ? null : hex;
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
            borderRadius: clayStyles.borderRadius - 4,
            backgroundColor: currentTheme.card,
            borderColor: isFocused ? currentTheme.primary : (formData[field] && !isValid && !optional ? '#FF3B30' : currentTheme.border),
            borderWidth: isFocused ? 2 : clayStyles.borderWidth,
          }
        ]}>
          <TextInput
            style={[styles.input, { color: currentTheme.text }]}
            value={formData[field] || ''}
            onChangeText={t => setFormData(prev => ({ ...prev, [field]: t }))}
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
            clayStyles,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              shadowColor: currentTheme.borderShadow || '#000',
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

                <View style={styles.inputWrapper}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: currentTheme.textSecondary }]}>
                      Fotos <Text style={{ color: currentTheme.textSecondary, fontSize: 10, fontWeight: '400' }}>(Máx. 2 fotos, opcional)</Text>
                    </Text>
                  </View>

                  {!imageUri && !imageUri2 ? (
                    <View style={styles.imagePickerRow}>
                      <TouchableOpacity
                        style={[styles.imagePickerBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                        onPress={() => pickImage(1, 'camera')}
                      >
                        <Ionicons name="camera-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.imagePickerText, { color: currentTheme.text }]}>Cámara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imagePickerBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                        onPress={() => pickImage(1, 'library')}
                      >
                        <Ionicons name="images-outline" size={22} color={currentTheme.text} />
                        <Text style={[styles.imagePickerText, { color: currentTheme.text }]}>Galería</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 12, width: '100%', height: 120 }}>
                      {imageUri && (
                        <View style={[styles.imagePreviewContainer, { flex: 1, height: '100%' }]}>
                          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                          <TouchableOpacity
                            style={styles.removeImageBtn}
                            onPress={() => removeImage(1)}
                          >
                            <Ionicons name="close-circle" size={22} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                      )}

                      {imageUri2 ? (
                        <View style={[styles.imagePreviewContainer, { flex: 1, height: '100%' }]}>
                          <Image source={{ uri: imageUri2 }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                          <TouchableOpacity
                            style={styles.removeImageBtn}
                            onPress={() => removeImage(2)}
                          >
                            <Ionicons name="close-circle" size={22} color="#e74c3c" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        imageUri && (
                          <View style={{ flex: 1, height: '100%', gap: 8, justifyContent: 'space-between' }}>
                            <TouchableOpacity
                              style={[
                                styles.imagePickerBtnCompact,
                                {
                                  flex: 1,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: currentTheme.border,
                                  backgroundColor: currentTheme.card,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  flexDirection: 'row',
                                  gap: 6
                                }
                              ]}
                              onPress={() => pickImage(2, 'camera')}
                            >
                              <Ionicons name="camera-outline" size={16} color={currentTheme.text} />
                              <Text style={{ fontSize: 11, color: currentTheme.text, fontWeight: '600' }}>Cámara</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.imagePickerBtnCompact,
                                {
                                  flex: 1,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: currentTheme.border,
                                  backgroundColor: currentTheme.card,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  flexDirection: 'row',
                                  gap: 6
                                }
                              ]}
                              onPress={() => pickImage(2, 'library')}
                            >
                              <Ionicons name="images-outline" size={16} color={currentTheme.text} />
                              <Text style={{ fontSize: 11, color: currentTheme.text, fontWeight: '600' }}>Galería</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      )}
                    </View>
                  )}
                </View>

                <View style={[styles.inputWrapper, { marginTop: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="notifications-outline" size={18} color={currentTheme.primary} />
                      <Text style={[styles.label, { color: currentTheme.textSecondary, marginBottom: 0 }]}>
                        Alarma <Text style={{ color: currentTheme.textSecondary, fontSize: 10, fontWeight: '400' }}>(Opcional)</Text>
                      </Text>
                    </View>
                    <Switch
                      value={alarmEnabled}
                      onValueChange={(val) => {
                        setAlarmEnabled(val);
                        if (val) AlarmService.requestPermissions();
                      }}
                      trackColor={{ false: '#767577', true: currentTheme.primary }}
                      thumbColor={alarmEnabled ? '#FFFFFF' : '#f4f3f4'}
                    />
                  </View>

                  {alarmEnabled && (
                    <View style={{ backgroundColor: currentTheme.background, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: currentTheme.border }}>
                      <Text style={{ fontSize: 12, color: currentTheme.textSecondary, marginBottom: 10 }}>
                        Programar fecha y hora de la notificación:
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: currentTheme.card,
                            borderWidth: 1,
                            borderColor: currentTheme.border
                          }}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Ionicons name="calendar-outline" size={16} color={currentTheme.primary} />
                          <Text style={{ fontSize: 12, color: currentTheme.text, fontWeight: '600' }}>
                            {alarmDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: currentTheme.card,
                            borderWidth: 1,
                            borderColor: currentTheme.border
                          }}
                          onPress={() => setShowTimePicker(true)}
                        >
                          <Ionicons name="time-outline" size={16} color={currentTheme.primary} />
                          <Text style={{ fontSize: 12, color: currentTheme.text, fontWeight: '600' }}>
                            {alarmDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showDatePicker && (
                        <DateTimePicker
                          value={alarmDate}
                          mode="date"
                          display="default"
                          minimumDate={new Date()}
                          onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) {
                              const newDate = new Date(alarmDate);
                              newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                              newDate.setSeconds(0, 0);
                              setAlarmDate(newDate);
                            }
                          }}
                        />
                      )}

                      {showTimePicker && (
                        <DateTimePicker
                          value={alarmDate}
                          mode="time"
                          display="default"
                          onChange={(event, selectedDate) => {
                            setShowTimePicker(false);
                            if (selectedDate) {
                              const newDate = new Date(alarmDate);
                              newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                              setAlarmDate(newDate);
                            }
                          }}
                        />
                      )}
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
                  borderRadius: clayStyles.borderRadius - 8,
                  backgroundColor: currentTheme.primary,
                  borderColor: currentTheme.border,
                  borderWidth: clayStyles.borderWidth,
                  shadowColor: currentTheme.primary,
                  shadowOpacity: 0.3,
                  shadowOffset: { width: 0, height: 6 },
                  shadowRadius: 10,
                  elevation: 5,
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
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 58,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  input: { flex: 1, fontSize: 15, height: '100%', paddingVertical: 0 },
  checkIcon: { marginLeft: 10 },
  saveBtn: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
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
  imagePickerBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  imagePickerTextCompact: {
    fontSize: 11,
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
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
});
