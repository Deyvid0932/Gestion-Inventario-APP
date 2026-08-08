import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { clayStyles } from '../style/theme';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/AuthService';
import { SyncService } from '../services/SyncService';
import { StatsService, DashboardStats } from '../services/StatsService';
import { ThemeModal } from './ThemeModal';
import { ExportModal } from './ExportModal';
import { ProfileModal } from './ProfileModal';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { AboutModal } from './AboutModal';
import { PrivacyModal } from './PrivacyModal';
import { maskEmail } from '../utils/maskUtils';

import { RoleGuard } from './RoleGuard';
import { UserManagementModal } from './UserManagementModal';
import { TrashModal } from './TrashModal';

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
}

export type SyncStatusType = 'synced' | 'syncing' | 'offline' | 'error';

export const AccountModal: React.FC<AccountModalProps> = ({ visible, onClose }) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const toggleTheme = useAppStore(state => state.toggleTheme);
  const user = useAppStore(state => state.user);
  const isAuthLoading = useAppStore(state => state.isAuthLoading);
  const setIsAuthLoading = useAppStore(state => state.setIsAuthLoading);
  const setSession = useAppStore(state => state.setSession);
  const logout = useAppStore(state => state.logout);
  const userRoles = useAppStore(state => state.userRoles);
  const lastSyncTime = useAppStore(state => state.lastSyncTime);
  const setLastSyncTime = useAppStore(state => state.setLastSyncTime);

  const insets = useSafeAreaInsets();

  // Modales
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [userMgmtModalVisible, setUserMgmtModalVisible] = useState(false);
  const [trashModalVisible, setTrashModalVisible] = useState(false);

  // Estadísticas de SQLite
  const [stats, setStats] = useState<DashboardStats>({
    totalInventarios: 0,
    totalCajas: 0,
    totalPrendas: 0,
    prendasActivas: 0,
    prendasInactivas: 0,
    prendasConFoto: 0,
    prendasConAlarma: 0,
    cajaTopNombre: '',
    cajaTopCantidad: 0,
    top5Cajas: [],
    topColores: [],
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('synced');
  const [syncMessage, setSyncMessage] = useState<string>('Todo está sincronizado correctamente.');

  // Cargar estadísticas y refrescar roles cuando el modal abre
  useEffect(() => {
    if (visible && db) {
      StatsService.getStats(db, user?.id).then(data => {
        setStats(data);
      }).catch(e => console.error(e));

      // Refrescar roles desde Supabase para mantener consistencia
      if (user?.id) {
        import('../services/RoleService').then(({ RoleService }) => {
          RoleService.getUserProfileAndRoles(user.id).then(roleInfo => {
            useAppStore.getState().setUserProfileAndRoles(
              roleInfo.profile,
              roleInfo.roles,
              roleInfo.isActive
            );
          }).catch(() => { });
        }).catch(() => { });
      }
    }
  }, [visible, db, user?.id]);

  // Extraer datos del usuario de Google
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuario';
  const email = user?.email || '';

  const handleGoogleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      setSyncStatus('syncing');
      const { session } = await AuthService.signInWithGoogle();
      if (session) {
        setSession(session);
        setSyncStatus('synced');
        setSyncMessage('Sesión conectada con Google.');
        Alert.alert('¡Bienvenido!', `Sesión iniciada como ${session.user.email}`);
      }
    } catch (error: any) {
      setSyncStatus('error');
      setSyncMessage('Error al conectar con Google.');
      Alert.alert('Error de Autenticación', error.message || 'No se pudo iniciar sesión.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Deseas cerrar tu sesión actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await AuthService.signOut();
            logout();
            setSyncStatus('synced');
            setSyncMessage('Modo Local Activo');
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    if (!user) {
      Alert.alert('Modo Local', 'Inicia sesión con Google para sincronizar tus datos en la nube.');
      return;
    }
    try {
      setIsAuthLoading(true);
      setSyncStatus('syncing');
      setSyncMessage('Sincronizando lotes, cajas y prendas...');

      const result = await SyncService.syncAll(db, user.id);
      if (result.success) {
        setLastSyncTime(result.syncedAt);
        setSyncStatus('synced');
        setSyncMessage('Todo está sincronizado correctamente.');
        Alert.alert('Sincronización Completada', 'Tus datos se han respaldado correctamente en la nube.');
      } else {
        setSyncStatus('error');
        setSyncMessage('Ocurrió un error en la sincronización.');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage('No existe conexión a internet o falló el servidor.');
      Alert.alert('Error de Sincronización', 'No se pudo completar la sincronización.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const openLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Enlace no disponible', `No se pudo abrir el enlace: ${url}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getSyncTimeFormatted = () => {
    if (!lastSyncTime) return 'Pendiente de sincronizar';
    const date = new Date(lastSyncTime);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const renderSyncBadge = () => {
    if (isAuthLoading || syncStatus === 'syncing') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: currentTheme.primary + '20', borderColor: currentTheme.primary }]}>
          <ActivityIndicator size="small" color={currentTheme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.statusBadgeText, { color: currentTheme.primary }]}>🔄 Sincronizando...</Text>
        </View>
      );
    }
    if (syncStatus === 'error') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#e74c3c20', borderColor: '#e74c3c' }]}>
          <Ionicons name="alert-circle" size={14} color="#e74c3c" style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: '#e74c3c' }]}>Error de sync</Text>
        </View>
      );
    }
    if (syncStatus === 'offline') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: '#EAB30820', borderColor: '#EAB308' }]}>
          <Ionicons name="cloud-offline" size={14} color="#EAB308" style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: '#EAB308' }]}>Sin conexión</Text>
        </View>
      );
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#2ecc7120', borderColor: '#2ecc71' }]}>
        <View style={styles.greenDot} />
        <Text style={[styles.statusBadgeText, { color: '#2ecc71' }]}>Sincronizado</Text>
      </View>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={onClose}
          />
          <View
            style={[
              styles.sheetContainer,
              clayStyles,
              {
                backgroundColor: currentTheme.card,
                borderColor: currentTheme.border,
                shadowColor: currentTheme.borderShadow || '#000',
                maxHeight: '88%',
                paddingBottom: Math.max(insets.bottom + 20, 28),
              },
            ]}
          >
            <View style={styles.dragIndicator} />

            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.titleContainer}>
                <Ionicons name="person-circle-outline" size={24} color={currentTheme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                  Cuenta y Ajustes
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
                accessibilityLabel="Cerrar menú de cuenta"
              >
                <Ionicons name="close" size={20} color={currentTheme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Tarjeta de Perfil Hero */}
              {!user ? (
                <View style={[styles.profileCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                  <View style={styles.profileHeader}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.primary + '20' }]}>
                      <Ionicons name="person-outline" size={26} color={currentTheme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profileName, { color: currentTheme.text }]}>👤 Usuario Local</Text>
                      <Text style={[styles.profileStatusText, { color: currentTheme.textSecondary }]}>Almacenamiento Local (SQLite)</Text>
                    </View>
                  </View>
                  <Text style={[styles.guestInfoText, { color: currentTheme.textSecondary }]}>
                    Tus datos se almacenan únicamente en este dispositivo. Inicia sesión con Google para respaldar y sincronizar tus prendas entre dispositivos.
                  </Text>
                  <TouchableOpacity
                    onPress={handleGoogleSignIn}
                    disabled={isAuthLoading}
                    activeOpacity={0.8}
                    style={[styles.googleButton, { backgroundColor: currentTheme.primary }]}
                  >
                    {isAuthLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.googleButtonText}>☁ Continuar con Google</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.noteText, { color: currentTheme.textSecondary }]}>
                    * Iniciar sesión es completamente opcional.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setProfileModalVisible(true)}
                  style={[styles.profileCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.primary + '50' }]}
                >
                  <View style={styles.profileHeader}>
                    {avatarUrl ? (
                      <Image
                        source={{ uri: avatarUrl }}
                        style={styles.avatarImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                      />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: currentTheme.primary + '20' }]}>
                        <Ionicons name="person" size={26} color={currentTheme.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.profileName, { color: currentTheme.text }]} numberOfLines={1}>
                        👤 {fullName}
                      </Text>
                      <View style={styles.connectedBadge}>
                        <View style={styles.greenDot} />
                        <Text style={[styles.connectedText, { color: '#2ecc71' }]} numberOfLines={1}>
                          Google conectado ({maskEmail(email)})
                        </Text>
                      </View>
                      {userRoles && userRoles.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {userRoles.map((r, i) => (
                            <View key={i} style={{ backgroundColor: currentTheme.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: currentTheme.primary + '50' }}>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: currentTheme.primary }}>
                                {r === 'Admin' ? 'Admin' : r === 'Editor' ? 'Editor' : 'Viewer'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={currentTheme.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}

              {/* Tarjeta de Sincronización Avanzada */}
              <View style={[styles.syncHeroCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                <View style={styles.syncHeroHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.syncHeroTitle, { color: currentTheme.text }]}>Estado de Sincronización</Text>
                    <Text style={[styles.syncMessageText, { color: currentTheme.textSecondary }]}>{syncMessage}</Text>
                  </View>
                  {renderSyncBadge()}
                </View>

                {/* Métricas de SQLite */}
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                    <Ionicons name="albums-outline" size={16} color={currentTheme.primary} style={{ marginBottom: 2 }} />
                    <Text style={[styles.metricNumber, { color: currentTheme.text }]}>{stats.totalInventarios}</Text>
                    <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Lotes</Text>
                  </View>

                  <View style={[styles.metricPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                    <Ionicons name="cube-outline" size={16} color={currentTheme.primary} style={{ marginBottom: 2 }} />
                    <Text style={[styles.metricNumber, { color: currentTheme.text }]}>{stats.totalCajas}</Text>
                    <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Cajas</Text>
                  </View>

                  <View style={[styles.metricPill, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
                    <Ionicons name="shirt-outline" size={16} color={currentTheme.primary} style={{ marginBottom: 2 }} />
                    <Text style={[styles.metricNumber, { color: currentTheme.text }]}>{stats.totalPrendas}</Text>
                    <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Prendas</Text>
                  </View>
                </View>

                <View style={styles.syncFooterRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.syncFooterLabel, { color: currentTheme.textSecondary }]}>Última actualización</Text>
                    <Text style={[styles.syncFooterTime, { color: currentTheme.text }]}>{getSyncTimeFormatted()}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleSync}
                    disabled={isAuthLoading}
                    style={[styles.syncButton, { backgroundColor: currentTheme.primary }]}
                    activeOpacity={0.8}
                  >
                    {isAuthLoading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="refresh" size={16} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={styles.syncButtonText}>Sincronizar ahora</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sección: Cuenta */}
              <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>CUENTA Y PREFERENCIAS</Text>
              <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                <TouchableOpacity style={styles.menuRow} onPress={() => setProfileModalVisible(true)}>
                  <Ionicons name="person-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Perfil de Usuario</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={handleSync}>
                  <Ionicons name="sync-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Sincronización</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={() => toggleTheme(db)}>
                  <Ionicons name={themeMode === 'light' ? 'sunny-outline' : 'moon-outline'} size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Apariencia ({themeMode === 'light' ? 'Modo Claro' : 'Modo Oscuro'})</Text>
                  <Ionicons name="swap-horizontal" size={16} color={currentTheme.primary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={() => setThemeModalVisible(true)}>
                  <Ionicons name="color-palette-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Tema de Color</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={() => setNotifModalVisible(true)}>
                  <Ionicons name="notifications-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Notificaciones</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={() => setExportModalVisible(true)}>
                  <Ionicons name="archive-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Copia de seguridad (Excel)</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Sección: Contacto */}
              <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>CONTACTO</Text>
              <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                <TouchableOpacity style={styles.menuRow} onPress={() => openLink('https://www.linkedin.com/in/deyvid-jair-chupillon-silva')}>
                  <Ionicons name="logo-linkedin" size={20} color="#0A66C2" style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>LinkedIn</Text>
                  <Ionicons name="open-outline" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={() => openLink('https://github.com/Deyvid0932')}>
                  <Ionicons name="logo-github" size={20} color={themeMode === 'light' ? '#24292E' : '#FFF'} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>GitHub</Text>
                  <Ionicons name="open-outline" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                <TouchableOpacity style={styles.menuRow} onPress={() => openLink('https://wa.me/51980709494')}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>WhatsApp</Text>
                  <Ionicons name="open-outline" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Sección: Administración (Solo Admin) */}
              <RoleGuard roles={['Admin']}>
                <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>ADMINISTRACIÓN</Text>
                <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                  <TouchableOpacity style={styles.menuRow} onPress={() => setUserMgmtModalVisible(true)}>
                    <Ionicons name="people-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                    <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Gestión de Usuarios y Roles</Text>
                    <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                  </TouchableOpacity>

                  <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                  <TouchableOpacity style={styles.menuRow} onPress={() => setTrashModalVisible(true)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" style={styles.menuIcon} />
                    <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Papelera de Reciclaje</Text>
                    <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </RoleGuard>

              {/* Sección: Información */}
              <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>INFORMACIÓN</Text>
              <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                <TouchableOpacity style={styles.menuRow} onPress={() => setAboutModalVisible(true)}>
                  <Ionicons name="information-circle-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Acerca de la aplicación</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>



                <TouchableOpacity style={styles.menuRow} onPress={() => setPrivacyModalVisible(true)}>
                  <Ionicons name="document-text-outline" size={20} color={currentTheme.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Política de privacidad</Text>
                  <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Sección: Sesión (Solo si está autenticado) */}
              {user && (
                <>
                  <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>SESIÓN</Text>
                  <View style={[styles.menuGroup, { backgroundColor: currentTheme.background, borderColor: '#e74c3c40' }]}>
                    <TouchableOpacity style={styles.menuRow} onPress={handleSignOut}>
                      <Ionicons name="log-out-outline" size={20} color="#e74c3c" style={styles.menuIcon} />
                      <Text style={[styles.menuLabel, { color: '#e74c3c', fontWeight: '700' }]}>Cerrar sesión</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modales Especializados */}
      <ProfileModal visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />
      <ThemeModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
      <ExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
      <NotificationSettingsModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} />
      <AboutModal visible={aboutModalVisible} onClose={() => setAboutModalVisible(false)} />
      <PrivacyModal visible={privacyModalVisible} onClose={() => setPrivacyModalVisible(false)} />
      <UserManagementModal visible={userMgmtModalVisible} onClose={() => setUserMgmtModalVisible(false)} />
      <TrashModal visible={trashModalVisible} onClose={() => setTrashModalVisible(false)} />
    </>
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
    marginBottom: 16,
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
  profileCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  profileStatusText: {
    fontSize: 12,
  },
  guestInfoText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  googleButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 11,
    textAlign: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ecc71',
    marginRight: 6,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncHeroCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  syncHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  syncHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  syncMessageText: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  syncFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 10,
  },
  syncFooterLabel: {
    fontSize: 10,
  },
  syncFooterTime: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  menuGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: {
    marginRight: 14,
    width: 22,
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    width: '100%',
    opacity: 0.6,
  },
});
