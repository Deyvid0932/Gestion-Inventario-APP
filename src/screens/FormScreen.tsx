import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Image,
  Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Navbar } from '../components';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { clayStyles } from '../styles/theme';
import { ImagePreviewModal } from '../components';
import { useFormScreen } from '../hooks';
import { AlarmService } from '../services';

export const FormScreen = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Form'>>();
  const { initialData, entityType, parentId } = route.params || {};

  const { state, computed, refs, handlers } = useFormScreen({
    initialData,
    entityType,
    parentId,
  });

  const {
    formData,
    loading,
    focusedField,
    imageUri,
    imageUri2,
    previewUri,
    alarmEnabled,
    alarmDate,
    showDatePicker,
    showTimePicker,
    shippingAt,
    shippingDate,
    showShippingDatePicker,
    showShippingTimePicker,
  } = state;

  const { title, currentTheme, insets } = computed;
  const { shakeAnim, buttonScale } = refs;

  const {
    setFormData,
    setFocusedField,
    setPreviewUri,
    setAlarmEnabled,
    setAlarmDate,
    setShowDatePicker,
    setShowTimePicker,
    setShippingAt,
    setShippingDate,
    setShowShippingDatePicker,
    setShowShippingTimePicker,
    clearShippingAt,
    pickImage,
    removeImage,
    onPressIn,
    onPressOut,
    handleSubmit,
    isFieldValid,
    getColorPreview,
  } = handlers;

  const isInventory = (entityType as string) === 'inventory';
  const isBox = (entityType as string) === 'box';
  const isGarment = (entityType as string) === 'garment' || (!isInventory && !isBox);

  const renderInput = (label: string, field: string, placeholder: string, optional = false, altField?: string) => {
    const isValid = isFieldValid(field) || (altField ? isFieldValid(altField) : false);
    const isFocused = focusedField === field || (altField ? focusedField === altField : false);
    const val = formData[field] || (altField ? formData[altField] : '') || '';
    const colorPreview = field === 'color' ? getColorPreview(val) : null;

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
            borderColor: isFocused ? currentTheme.primary : (val && !isValid && !optional ? '#FF3B30' : currentTheme.border),
            borderWidth: isFocused ? 2 : clayStyles.borderWidth,
          }
        ]}>
          <TextInput
            style={[styles.input, { color: currentTheme.text }]}
            value={val}
            onChangeText={t => {
              const value = field === 'op' ? t.replace(/\D/g, '').slice(0, 6) : t;
              setFormData(prev => ({
                ...prev,
                [field]: value,
                ...(altField ? { [altField]: value } : {})
              }));
            }}
            placeholder={placeholder}
            placeholderTextColor={currentTheme.textSecondary}
            keyboardType={field === 'op' ? 'number-pad' : 'default'}
            maxLength={field === 'op' ? 6 : undefined}
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
      <Navbar title={title} showBackButton />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[
            clayStyles,
            styles.card,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              shadowColor: currentTheme.borderShadow || '#000',
              transform: [{ translateX: shakeAnim }]
            }
          ]}>

            {(isInventory || isBox) && renderInput('Nombre', 'name', 'Ingrese el nombre', false, 'nombre')}

            {isInventory && renderInput('Descripción', 'description', 'Descripción opcional', true, 'descripcion')}

            {isGarment && (
              <>
                {renderInput('Estilo', 'style', 'Ej. Polo Slim', false, 'estilo')}
                <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                  <View style={styles.opField}>
                    {renderInput('OP', 'op', '316295', true)}
                  </View>
                  <View style={styles.colorField}>
                    {renderInput('Color', 'color', 'Ej. Rojo')}
                  </View>
                </View>

                {renderInput('Técnica', 'size', 'Ej. Plastisol, Al Agua', true)}

                {renderInput('Código de Arte', 'art_code', 'Ej. ART-001', true)}

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
                        <Ionicons name="camera-outline" size={18} color={currentTheme.text} />
                        <Text style={[styles.imagePickerText, { color: currentTheme.text }]}>Cámara</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imagePickerBtn, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
                        onPress={() => pickImage(1, 'library')}
                      >
                        <Ionicons name="images-outline" size={18} color={currentTheme.text} />
                        <Text style={[styles.imagePickerText, { color: currentTheme.text }]}>Galería</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 10, width: '100%', height: 92 }}>
                      {imageUri && (
                        <View style={[styles.imagePreviewContainer, { flex: 1, height: '100%' }]}>
                          <TouchableOpacity
                            activeOpacity={0.88}
                            style={{ width: '100%', height: '100%' }}
                            onPress={() => setPreviewUri(imageUri)}
                          >
                            <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                          </TouchableOpacity>
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
                          <TouchableOpacity
                            activeOpacity={0.88}
                            style={{ width: '100%', height: '100%' }}
                            onPress={() => setPreviewUri(imageUri2)}
                          >
                            <Image source={{ uri: imageUri2 }} style={{ width: '100%', height: '100%', borderRadius: 12 }} resizeMode="cover" />
                          </TouchableOpacity>
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

                <View style={[styles.inputWrapper, { marginTop: 2, marginBottom: 6 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
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
                        if (val) AlarmService.requestPermissions().catch(() => { });
                      }}
                      trackColor={{ false: '#767577', true: currentTheme.primary }}
                      thumbColor={alarmEnabled ? '#FFFFFF' : '#f4f3f4'}
                    />
                  </View>

                  {alarmEnabled && (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: 11,
                          backgroundColor: currentTheme.background,
                          borderWidth: 1,
                          borderColor: currentTheme.border
                        }}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Ionicons name="calendar-outline" size={15} color={currentTheme.primary} />
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
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: 11,
                          backgroundColor: currentTheme.background,
                          borderWidth: 1,
                          borderColor: currentTheme.border
                        }}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons name="time-outline" size={15} color={currentTheme.primary} />
                        <Text style={{ fontSize: 12, color: currentTheme.text, fontWeight: '600' }}>
                          {alarmDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>

                      {showDatePicker && (
                        <DateTimePicker
                          value={alarmDate}
                          mode="date"
                          display="default"
                          minimumDate={new Date()}
                          onChange={(_event, selectedDate) => {
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
                          onChange={(_event, selectedDate) => {
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

                <View style={[styles.inputWrapper, { marginTop: 2, marginBottom: 6 }]}>
                  <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
                    <Text style={[styles.label, { color: currentTheme.textSecondary, marginBottom: 0 }]}>
                      Envio Testing <Text style={{ color: currentTheme.textSecondary, fontSize: 10, fontWeight: '400' }}>(Opcional)</Text>
                    </Text>
                    {shippingAt ? (
                      <TouchableOpacity onPress={clearShippingAt} accessibilityLabel="Quitar fecha de envío">
                        <Ionicons name="close-circle" size={18} color={currentTheme.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 11, backgroundColor: currentTheme.card, borderWidth: 1, borderColor: currentTheme.border }}
                      onPress={() => setShowShippingDatePicker(true)}
                      accessibilityLabel="Elegir día de envío"
                    >
                      <Ionicons name="calendar-outline" size={16} color={currentTheme.primary} />
                      <Text style={{ fontSize: 12, color: shippingAt ? currentTheme.text : currentTheme.textSecondary, fontWeight: '600' }}>
                        {shippingAt ? shippingDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Elegir día'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 11, backgroundColor: currentTheme.card, borderWidth: 1, borderColor: currentTheme.border }}
                      onPress={() => setShowShippingTimePicker(true)}
                      accessibilityLabel="Elegir hora de envío"
                    >
                      <Ionicons name="time-outline" size={16} color={currentTheme.primary} />
                      <Text style={{ fontSize: 12, color: shippingAt ? currentTheme.text : currentTheme.textSecondary, fontWeight: '600' }}>
                        {shippingAt ? shippingDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Elegir hora'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showShippingDatePicker && (
                    <DateTimePicker
                      value={shippingDate}
                      mode="date"
                      display="default"
                      onChange={(_event, selectedDate) => {
                        setShowShippingDatePicker(false);
                        if (selectedDate) {
                          const nextDate = new Date(shippingDate);
                          nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                          nextDate.setSeconds(0, 0);
                          setShippingDate(nextDate);
                          setShippingAt(nextDate.toISOString());
                        }
                      }}
                    />
                  )}

                  {showShippingTimePicker && (
                    <DateTimePicker
                      value={shippingDate}
                      mode="time"
                      display="default"
                      onChange={(_event, selectedDate) => {
                        setShowShippingTimePicker(false);
                        if (selectedDate) {
                          const nextDate = new Date(shippingDate);
                          nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                          setShippingDate(nextDate);
                          setShippingAt(nextDate.toISOString());
                        }
                      }}
                    />
                  )}
                </View>
              </>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[
                  clayStyles,
                  styles.submitButton,
                  {
                    backgroundColor: currentTheme.primary,
                    borderColor: currentTheme.border,
                    shadowColor: currentTheme.borderShadow || '#000',
                    marginTop: 10,
                    paddingVertical: 0,
                    paddingHorizontal: 16,
                  }
                ]}
                onPress={handleSubmit}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={currentTheme.primaryText || '#fff'} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: currentTheme.primaryText || '#fff' }]}>
                    {initialData?.id ? 'Guardar Cambios' : 'Crear Registro'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ImagePreviewModal
        visible={!!previewUri}
        uri={previewUri}
        onClose={() => setPreviewUri(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 12,
    flexGrow: 1,
  },
  card: {
    padding: 14,
    width: '100%',
    alignSelf: 'center',
    marginTop: 2,
  },
  inputWrapper: {
    marginBottom: 7,
  },
  opField: {
    width: 84,
  },
  colorField: {
    flex: 1,
  },
  techniqueChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: -4,
    marginBottom: 10,
  },
  techniqueChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  techniqueChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    height: 40,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 4,
  },
  checkIcon: {
    marginLeft: 6,
  },
  submitButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  imagePickerBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  imagePickerBtnCompact: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});
