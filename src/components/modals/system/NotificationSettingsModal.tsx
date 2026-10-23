import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clayStyles } from '../../../styles/theme';
import { useAppStore } from '../../../store/useAppStore';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const checkPermissions = async () => {
    try {
      const settings = await Notifications.getPermissionsAsync();
      setHasPermission(settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED);
    } catch (e) {
      console.error(e);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    if (visible) {
      checkPermissions();
    }
  }, [visible]);

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
        Alert.alert('Permisos concedidos', 'Las notificaciones y alarmas funcionarán correctamente.');
      } else {
        setHasPermission(false);
        Alert.alert('Permiso denegado', 'Puedes activar las notificaciones manualmente desde los ajustes de tu sistema.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Ajustes del Sistema', 'Abre la aplicación de Ajustes en tu dispositivo para gestionar los permisos.');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                clayStyles,
                {
                  backgroundColor: currentTheme.card,
                  borderColor: currentTheme.border,
                  shadowColor: currentTheme.borderShadow || '#000',
                  maxHeight: '85%',
                  paddingBottom: Math.max(insets.bottom + 20, 28),
                },
              ]}
            >
              <View style={styles.dragIndicator} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.titleContainer}>
                  <Ionicons name="notifications-outline" size={24} color={currentTheme.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                    Ajustes de Notificaciones
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
                  accessibilityLabel="Cerrar modal de notificaciones"
                >
                  <Ionicons name="close" size={20} color={currentTheme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Tarjeta de Estado de Permisos */}
                <View style={[styles.statusCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                  <View style={styles.statusHeader}>
                    <Ionicons
                      name={hasPermission ? 'notifications-circle' : 'warning-outline'}
                      size={32}
                      color={hasPermission ? '#2ecc71' : '#e74c3c'}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.statusTitle, { color: currentTheme.text }]}>Estado de Permisos</Text>
                      <View style={styles.badgeContainer}>
                        {hasPermission ? (
                          <View style={[styles.statusBadge, { backgroundColor: '#2ecc7120', borderColor: '#2ecc7160' }]}>
                            <Ionicons name="checkmark-circle" size={14} color="#2ecc71" style={{ marginRight: 4 }} />
                            <Text style={[styles.statusBadgeText, { color: '#2ecc71' }]}>✔ Permisos concedidos</Text>
                          </View>
                        ) : (
                          <View style={[styles.statusBadge, { backgroundColor: '#e74c3c20', borderColor: '#e74c3c60' }]}>
                            <Ionicons name="alert-circle" size={14} color="#e74c3c" style={{ marginRight: 4 }} />
                            <Text style={[styles.statusBadgeText, { color: '#e74c3c' }]}>⚠️ Faltan permisos</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {!hasPermission && (
                    <TouchableOpacity
                      style={[styles.grantBtn, { backgroundColor: currentTheme.primary }]}
                      onPress={requestPermission}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.grantBtnText}>Solicitar Permisos Ahora</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tarjeta Informativa de Batería */}
                <View style={[styles.warningCard, { backgroundColor: '#EAB30815', borderColor: '#EAB30840' }]}>
                  <Ionicons name="battery-charging-outline" size={24} color="#EAB308" style={{ marginBottom: 6 }} />
                  <Text style={[styles.warningTitle, { color: '#EAB308' }]}>Optimización de Batería (Android)</Text>
                  <Text style={[styles.warningText, { color: currentTheme.text }]}>
                    Si el sistema operativo Android restringe el uso de batería en segundo plano para esta aplicación, algunas alarmas o recordatorios programados en tus prendas podrían no sonar correctamente a tiempo.
                  </Text>
                </View>

                {/* Accesos Directos al Sistema */}
                <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>ACCESOS DIRECTOS DEL SISTEMA</Text>
                <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                  <TouchableOpacity style={styles.menuRow} onPress={openAppSettings}>
                    <Ionicons name="settings-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Configuración de Notificaciones</Text>
                      <Text style={[styles.menuSubLabel, { color: currentTheme.textSecondary }]}>Ajustar sonidos y alertas del sistema</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={currentTheme.textSecondary} />
                  </TouchableOpacity>

                  <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                  <TouchableOpacity style={styles.menuRow} onPress={openAppSettings}>
                    <Ionicons name="key-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Permisos de la Aplicación</Text>
                      <Text style={[styles.menuSubLabel, { color: currentTheme.textSecondary }]}>Cámara, almacenamiento y notificaciones</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={currentTheme.textSecondary} />
                  </TouchableOpacity>

                  {Platform.OS === 'android' && (
                    <>
                      <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />
                      <TouchableOpacity style={styles.menuRow} onPress={openAppSettings}>
                        <Ionicons name="battery-dead-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.menuLabel, { color: currentTheme.text }]}>No Restringir Batería</Text>
                          <Text style={[styles.menuSubLabel, { color: currentTheme.textSecondary }]}>Permitir ejecución de alarmas en segundo plano</Text>
                        </View>
                        <Ionicons name="open-outline" size={16} color={currentTheme.textSecondary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    elevation: 10,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  statusCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  grantBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grantBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  warningCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  menuGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuIcon: {
    marginRight: 12,
    width: 22,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSubLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: '100%',
  },
});
