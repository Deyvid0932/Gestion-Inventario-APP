import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Animated } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId } from '../../database/database';
import { useAppStore } from '../../store/useAppStore';
import { GarmentService, InventoryService, BoxService, AlarmService, AuthManager, R2Service } from '../../services';
import { SyncScheduler } from '../../sync/SyncScheduler';
import { useGarment } from '../common/useGarment';
import { useRoles } from '../common/useRoles';
import { getColorHex } from '../../utils/colorUtils';
import { Garment, Inventory, Box } from '../../types';

interface UseFormScreenProps {
  initialData?: any;
  entityType?: 'inventory' | 'box' | 'garment';
  parentId?: string;
}

export const useFormScreen = ({ initialData, entityType, parentId }: UseFormScreenProps) => {
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const insets = useSafeAreaInsets();
  const { hasRole } = useRoles();
  const { addGarment } = useGarment();
  const lastSubmitTime = useRef(0);

  const isInventory = entityType === 'inventory';
  const isBox = entityType === 'box';
  const isGarment = entityType === 'garment' || (!isInventory && !isBox);

  const [formData, setFormData] = useState<Record<string, string>>(initialData || {});
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const [imageUri, setImageUri] = useState<string | null>(initialData?.photo_uri || null);
  const [imageUri2, setImageUri2] = useState<string | null>(initialData?.photo_uri_2 || null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(!!(initialData?.alarm_datetime));
  const [alarmDate, setAlarmDate] = useState<Date>(() => {
    const rawAlarm = initialData?.alarm_datetime;
    if (rawAlarm) {
      return new Date(rawAlarm);
    }
    const d = new Date(Date.now() + 3600000);
    d.setSeconds(0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [shippingAt, setShippingAt] = useState<string | null>(() => initialData?.shipping_at || null);
  const [shippingDate, setShippingDate] = useState<Date>(() => {
    const rawShippingDate = initialData?.shipping_at;
    const date = rawShippingDate ? new Date(rawShippingDate) : new Date();
    date.setSeconds(0, 0);
    return date;
  });
  const [showShippingDatePicker, setShowShippingDatePicker] = useState(false);
  const [showShippingTimePicker, setShowShippingTimePicker] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadR2Images = async () => {
      if (initialData && isGarment) {
        const p1 = initialData.photo_uri || initialData.fotoUri;
        const p2 = initialData.photo_uri_2 || initialData.fotoUri2;
        const k1 = initialData.r2Key || initialData.primary_storage_key || initialData.storage_key;
        const k2 = initialData.r2Key2 || initialData.secondary_storage_key;
        const uri1 = (p1 || k1) ? await R2Service.getResolvedImageUri(p1, k1) : null;
        const uri2 = (p2 || k2) ? await R2Service.getResolvedImageUri(p2, k2) : null;
        if (isMounted) {
          if (uri1) setImageUri(uri1);
          if (uri2) setImageUri2(uri2);
        }
      }
    };
    loadR2Images();
    return () => { isMounted = false; };
  }, [initialData?.photo_uri, initialData?.photo_uri_2, (initialData as any)?.fotoUri, (initialData as any)?.fotoUri2, isGarment]);

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
        quality: 1
      };

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        const optimized = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 600 } }],
          { compress: 0.5, format: SaveFormat.JPEG }
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
    Alert.alert(
      'Eliminar Fotografía',
      '¿Estás seguro de que deseas eliminar esta fotografía?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
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
          },
        },
      ]
    );
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
    if (!hasRole(['Admin', 'Editor'])) {
      Alert.alert('Acceso Restringido', 'Tu rol actual (Viewer) solo permite lectura. No tienes permisos para crear o modificar registros.');
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTime.current < 400) return;
    lastSubmitTime.current = now;

    const isUpdate = !!initialData?.id;
    const id = isUpdate ? initialData!.id : generateId();
    const fecha = new Date().toISOString();

    let isValid = true;
    if (isInventory || isBox) {
      if (!isFieldValid('name')) isValid = false;
    } else if (isGarment) {
      if (!isFieldValid('color')) isValid = false;
      if (!isFieldValid('style')) isValid = false;
    }

    if (!isValid) {
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      if (isInventory) {
        const name = formData.name || '';
        const description = formData.description || '';
        if (isUpdate) {
          await InventoryService.update(db, id, name, description);
        } else {
          await InventoryService.create(db, { id, name, description, created_at: fecha, status: 1 });
        }
      }
      else if (isBox) {
        const name = formData.name || '';
        if (isUpdate) {
          await BoxService.update(db, id, name);
        } else {
          await BoxService.create(db, { id, inventory_id: parentId!, name, created_at: fecha });
        }
      }
      else if (isGarment) {
        let finalNotificationId: string | null = initialData?.alarm_notification_id || null;
        let finalAlarmDateTime: string | null = initialData?.alarm_datetime || null;

        if (alarmEnabled) {
          if (finalNotificationId) {
            await AlarmService.cancelGarmentAlarm(finalNotificationId);
          }
          if (alarmDate.getTime() > Date.now()) {
            const targetBoxId = parentId || initialData?.box_id || '';
            const boxNameVal = initialData?.box_name || 'Caja';
            const styleVal = formData.style || 'Sin Estilo';
            const opVal = formData.op || 'Sin OP';
            const colorVal = formData.color || 'Sin Color';
            const newNotifId = await AlarmService.scheduleGarmentAlarm(
              id,
              targetBoxId,
              boxNameVal,
              styleVal,
              opVal,
              colorVal,
              alarmDate
            );
            if (newNotifId) {
              finalNotificationId = newNotifId;
              finalAlarmDateTime = alarmDate.toISOString();
            }
          }
        } else if (finalNotificationId) {
          await AlarmService.cancelGarmentAlarm(finalNotificationId);
          finalNotificationId = null;
          finalAlarmDateTime = null;
        }

        const targetBoxId = parentId || initialData?.box_id || '';
        if (!targetBoxId) {
          Alert.alert('Error', 'No se encontró el identificador de la caja.');
          setLoading(false);
          return;
        }

        const garmentData: Garment = {
          id,
          box_id: targetBoxId,
          op: formData.op || '',
          style: formData.style || '',
          color: formData.color || '',
          size: formData.size || initialData?.size || '',
          photo_uri: imageUri || null,
          photo_uri_2: imageUri2 || null,
          status: initialData?.status ?? 1,
          alarm_datetime: finalAlarmDateTime,
          alarm_notification_id: finalNotificationId,
          shipping_at: shippingAt,
          created_at: initialData?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'PENDING',
        };

        if (isUpdate) {
          const res = await GarmentService.updateGarment(db, garmentData);
          if (!res.success) {
            Alert.alert('Registro Duplicado', res.error || 'Esta OP ya existe en otra prenda de esta caja.');
            setLoading(false);
            return;
          }
        } else {
          const res = await addGarment(garmentData);

          if (!res.success) {
            Alert.alert("Error", res.error);
            setLoading(false);
            return;
          }
        }
      }

      await AuthManager.refreshAllAppState(db);

      const currentUser = useAppStore.getState().user;
      if (currentUser?.id) {
        SyncScheduler.schedulePush(db, currentUser.id);
      }

      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la información.');
    } finally {
      setLoading(false);
    }
  };

  const title = (() => {
    if (isInventory) return initialData?.id ? 'Editar Lote' : 'Nuevo Lote';
    if (isBox) return initialData?.id ? 'Editar Caja' : 'Nueva Caja';
    return initialData?.id ? 'Editar Prenda' : 'Registrar Prenda';
  })();

  const getColorPreview = (text: string) => {
    if (!text) return null;
    const hex = getColorHex(text);
    return hex === '#8E8E93' ? null : hex;
  };

  const canEdit = hasRole(['Admin', 'Editor']);

  return {
    state: {
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
    },
    computed: {
      title,
      currentTheme,
      themeMode,
      insets,
      canEdit,
    },
    refs: {
      shakeAnim,
      buttonScale,
    },
    handlers: {
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
      clearShippingAt: () => {
        setShippingAt(null);
        const now = new Date();
        now.setSeconds(0, 0);
        setShippingDate(now);
      },
      pickImage,
      removeImage,
      onPressIn,
      onPressOut,
      handleSubmit,
      isFieldValid,
      getColorPreview,
    },
  };
};
