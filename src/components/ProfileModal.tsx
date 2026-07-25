import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { clayStyles } from '../style/theme';
import { useAppStore } from '../store/useAppStore';
import { AuthService } from '../services/AuthService';
import { SyncService } from '../services/SyncService';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose }) => {
  const db = useSQLiteContext();
  const currentTheme = useAppStore(state => state.currentTheme);
  const themeMode = useAppStore(state => state.themeMode);
  const user = useAppStore(state => state.user);
  const isAuthLoading = useAppStore(state => state.isAuthLoading);
  const setIsAuthLoading = useAppStore(state => state.setIsAuthLoading);
  const setSession = useAppStore(state => state.setSession);
  const logout = useAppStore(state => state.logout);
  const lastSyncTime = useAppStore(state => state.lastSyncTime);
  const setLastSyncTime = useAppStore(state => state.setLastSyncTime);

  const insets = useSafeAreaInsets();

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || 'Usuario';
  const email = user?.email || '';
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'No disponible';

  const handleSyncNow = async () => {
    if (!user) {
      Alert.alert('Modo Invitado', 'Inicia sesión con Google para sincronizar tus datos en la nube.');
      return;
    }
    try {
      setIsAuthLoading(true);
      const result = await SyncService.syncAll(db, user.id);
      if (result.success) {
        setLastSyncTime(result.syncedAt);
        Alert.alert('Sincronizado', 'Tus inventarios han sido respaldados con éxito en Supabase Cloud.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo completar la sincronización.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsAuthLoading(true);
      const { session } = await AuthService.signInWithGoogle();
      if (session) {
        setSession(session);
        Alert.alert('¡Bienvenido!', `Sesión iniciada como ${session.user.email}`);
      }
    } catch (error: any) {
      Alert.alert('Error de Autenticación', error.message || 'No se pudo iniciar sesión.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleManageAccount = () => {
    Linking.openURL('https://myaccount.google.com').catch(() => {
      Alert.alert('Google Account', 'Puedes gestionar tu cuenta en myaccount.google.com');
    });
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
            onClose();
          },
        },
      ]
    );
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

  return (
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
              maxHeight: '85%',
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          <View style={styles.dragIndicator} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Ionicons name="person-outline" size={24} color={currentTheme.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: currentTheme.text }]} allowFontScaling={true}>
                Perfil de Usuario
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
              accessibilityLabel="Cerrar modal de perfil"
            >
              <Ionicons name="close" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.scrollContent}
          >
                {user ? (
                  <>
                    {/* Tarjeta de Perfil Autenticado */}
                    <View style={[styles.profileHero, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          style={styles.heroAvatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={200}
                        />
                      ) : (
                        <View style={[styles.heroAvatarPlaceholder, { backgroundColor: currentTheme.primary + '20' }]}>
                          <Ionicons name="person" size={36} color={currentTheme.primary} />
                        </View>
                      )}

                      <Text style={[styles.heroName, { color: currentTheme.text }]}>{fullName}</Text>
                      <Text style={[styles.heroEmail, { color: currentTheme.textSecondary }]}>{email}</Text>

                      <View style={styles.badgeRow}>
                        <View style={[styles.authBadge, { backgroundColor: '#4285F415', borderColor: '#4285F440' }]}>
                          <Ionicons name="logo-google" size={14} color="#4285F4" style={{ marginRight: 4 }} />
                          <Text style={[styles.authBadgeText, { color: '#4285F4' }]}>Google OAuth</Text>
                        </View>

                        <View style={[styles.authBadge, { backgroundColor: '#2ecc7115', borderColor: '#2ecc7140' }]}>
                          <View style={styles.greenDot} />
                          <Text style={[styles.authBadgeText, { color: '#2ecc71' }]}>En línea</Text>
                        </View>
                      </View>
                    </View>

                    {/* Detalle Técnico de la Cuenta */}
                    <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>DETALLES DE LA CUENTA</Text>
                    <View style={[styles.detailsGroup, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={18} color={currentTheme.primary} style={styles.detailIcon} />
                        <Text style={[styles.detailLabel, { color: currentTheme.textSecondary }]}>Miembro desde</Text>
                        <Text style={[styles.detailValue, { color: currentTheme.text }]}>{createdAt}</Text>
                      </View>

                      <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                      <View style={styles.detailRow}>
                        <Ionicons name="sync-outline" size={18} color={currentTheme.primary} style={styles.detailIcon} />
                        <Text style={[styles.detailLabel, { color: currentTheme.textSecondary }]}>Última Sincronización</Text>
                        <Text style={[styles.detailValue, { color: currentTheme.text }]}>{getSyncTimeFormatted()}</Text>
                      </View>

                      <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                      <View style={styles.detailRow}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={currentTheme.primary} style={styles.detailIcon} />
                        <Text style={[styles.detailLabel, { color: currentTheme.textSecondary }]}>Estado de Sincronización</Text>
                        <Text style={[styles.detailValue, { color: '#2ecc71', fontWeight: '700' }]}>Activo & Seguro</Text>
                      </View>
                    </View>

                    {/* Acciones */}
                    <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>ACCIONES RÁPIDAS</Text>
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                        onPress={handleSyncNow}
                        disabled={isAuthLoading}
                        activeOpacity={0.8}
                      >
                        {isAuthLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="refresh-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                            <Text style={styles.actionBtnText}>Sincronizar ahora</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtnOutline, { borderColor: currentTheme.border, backgroundColor: currentTheme.background }]}
                        onPress={handleManageAccount}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="open-outline" size={18} color={currentTheme.text} style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnOutlineText, { color: currentTheme.text }]}>Administrar Cuenta</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtnOutline, { borderColor: '#e74c3c40', backgroundColor: '#e74c3c10' }]}
                        onPress={handleSignOut}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="log-out-outline" size={18} color="#e74c3c" style={{ marginRight: 6 }} />
                        <Text style={[styles.actionBtnOutlineText, { color: '#e74c3c' }]}>Cerrar Sesión</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {/* Modo Invitado: Tarjetas Visuales de Ventajas */}
                    <View style={[styles.guestHero, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                      <View style={[styles.guestIconBadge, { backgroundColor: currentTheme.primary + '20' }]}>
                        <Ionicons name="person-outline" size={32} color={currentTheme.primary} />
                      </View>
                      <Text style={[styles.guestHeroTitle, { color: currentTheme.text }]}>Perfil de Invitado</Text>
                      <Text style={[styles.guestHeroSubtitle, { color: currentTheme.textSecondary }]}>
                        Estás utilizando Topytop Kith en Modo Local sin cuenta conectada.
                      </Text>

                      <TouchableOpacity
                        style={[styles.googleSignInBtn, { backgroundColor: currentTheme.primary }]}
                        onPress={handleGoogleSignIn}
                        disabled={isAuthLoading}
                        activeOpacity={0.8}
                      >
                        {isAuthLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="logo-google" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.googleSignInText}>☁ Continuar con Google</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>VENTAJAS DE CONECTAR TU CUENTA</Text>

                    <View style={styles.advantagesGrid}>
                      <View style={[styles.advantageCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                        <Ionicons name="cloud-upload-outline" size={24} color={currentTheme.primary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.advantageTitle, { color: currentTheme.text }]}>Copia de Seguridad</Text>
                        <Text style={[styles.advantageDesc, { color: currentTheme.textSecondary }]}>
                          Respaldos automáticos en la nube para nunca perder tus lotes ni prendas.
                        </Text>
                      </View>

                      <View style={[styles.advantageCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                        <Ionicons name="phone-portrait-outline" size={24} color={currentTheme.primary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.advantageTitle, { color: currentTheme.text }]}>Multi-Dispositivo</Text>
                        <Text style={[styles.advantageDesc, { color: currentTheme.textSecondary }]}>
                          Accede a tu inventario desde cualquier celular o tablet en tiempo real.
                        </Text>
                      </View>

                      <View style={[styles.advantageCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                        <Ionicons name="refresh-circle-outline" size={24} color={currentTheme.primary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.advantageTitle, { color: currentTheme.text }]}>Recuperación de Datos</Text>
                        <Text style={[styles.advantageDesc, { color: currentTheme.textSecondary }]}>
                          Restaura tu inventario fácilmente si cambias o formateas tu dispositivo.
                        </Text>
                      </View>

                      <View style={[styles.advantageCard, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
                        <Ionicons name="shield-checkmark-outline" size={24} color={currentTheme.primary} style={{ marginBottom: 8 }} />
                        <Text style={[styles.advantageTitle, { color: currentTheme.text }]}>Seguridad Garantizada</Text>
                        <Text style={[styles.advantageDesc, { color: currentTheme.textSecondary }]}>
                          Autenticación encriptada protegida directamente por Google y Supabase.
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
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
  profileHero: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  heroAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroEmail: {
    fontSize: 13,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  authBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ecc71',
    marginRight: 6,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  detailsGroup: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailIcon: {
    marginRight: 10,
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  uidText: {
    fontSize: 11,
    fontFamily: 'Platform',
    maxWidth: 130,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  actionsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnOutlineText: {
    fontWeight: '700',
    fontSize: 14,
  },
  guestHero: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
  },
  guestIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  guestHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  guestHeroSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  googleSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 12,
    width: '100%',
  },
  googleSignInText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  advantagesGrid: {
    gap: 10,
    marginBottom: 16,
  },
  advantageCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  advantageTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  advantageDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});
