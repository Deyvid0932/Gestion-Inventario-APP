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
              const value = field === 'op' ? t.replace(/\D/g, '').slice(0, 7) : t;
              setFormData(prev => ({
                ...prev,
                [field]: value,
                ...(altField ? { [altField]: value } : {})
              }));
            }}
            placeholder={placeholder}
            placeholderTextColor={currentTheme.textSecondary}
            keyboardType={field === 'op' ? 'number-pad' : 'default'}
            maxLength={field === 'op' ? 7 : undefined}
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
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 40, 60) }]}
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
                <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                  <View style={styles.opField}>
                    {renderInput('OP', 'op', 'Ej. 1', true)}
                  </View>
                  <View style={styles.colorField}>
                    {renderInput('Color', 'color', 'Ej. Rojo')}
                  </View>
                </View>

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
                        if (val) AlarmService.requestPermissions().catch(() => { });
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

                <View style={[styles.inputWrapper, { marginTop: 12 }]}>
                  <View style={[styles.labelRow, { justifyContent: 'space-between' }]}>
                    <Text style={[styles.label, { color: currentTheme.textSecondary, marginBottom: 0 }]}>
                      Envio Testing <Text style={{ color: currentTheme.textSecondary, fontSize: 10, fontWeight: '400' }}>(Opcional)</Text>
                    </Text>
                    {shippingAt ? (
                      <TouchableOpacity onPress={clearShippingAt} accessibilityLabel="Quitar fecha de envío">
                        <Ionicons name="close-circle" size={20} color={currentTheme.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, backgroundColor: currentTheme.card, borderWidth: 1, borderColor: currentTheme.border }}
                      onPress={() => setShowShippingDatePicker(true)}
                      accessibilityLabel="Elegir día de envío"
                    >
                      <Ionicons name="calendar-outline" size={16} color={currentTheme.primary} />
                      <Text style={{ fontSize: 12, color: shippingAt ? currentTheme.text : currentTheme.textSecondary, fontWeight: '600' }}>
                        {shippingAt ? shippingDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Elegir día'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, backgroundColor: currentTheme.card, borderWidth: 1, borderColor: currentTheme.border }}
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
                    marginTop: 20,
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
    padding: 16,
    flexGrow: 1,
  },
  card: {
    padding: 20,
    width: '100%',
    alignSelf: 'center',
    marginTop: 10,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  opField: {
    width: 112,
  },
  colorField: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  checkIcon: {
    marginLeft: 8,
  },
  submitButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  imagePickerBtn: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
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
