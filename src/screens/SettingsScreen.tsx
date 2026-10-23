import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeModal } from '../components';
import { ExportModal } from '../components';
import { ProfileModal } from '../components';
import { NotificationSettingsModal } from '../components';
import { AboutModal } from '../components';
import { PrivacyModal } from '../components';
import { RoleGuard } from '../components';
import { UserManagementModal } from '../components';
import { TrashModal } from '../components';
import { Navbar } from '../components';
import { useSettingsScreen, useRoles } from '../hooks';

// Herramientas de recuperación conservadas para soporte, pero ocultas en producción.
const SHOW_ADMIN_IMPORT_TOOLS = false;

export const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const { isAdmin } = useRoles();
  const {
    state: {
      user,
      userRoles,
      isAuthLoading,
      isExportingDb,
      stats,
      syncStatus,
      syncMessage,
      profileModalVisible,
      themeModalVisible,
      exportModalVisible,
      notifModalVisible,
      aboutModalVisible,
      privacyModalVisible,
      userMgmtModalVisible,
      trashModalVisible,
    },
    computed: {
      currentTheme,
      themeMode,
      avatarUrl,
      fullName,
      maskedEmail,
      formattedSyncTime,
    },
    handlers: {
      handleGoogleSignIn,
      handleSignOut,
      handleSync,
      handleToggleTheme,
      handleExportDatabase,
      handleImportSeedData,
      handleImportLegacyBackup,
      setProfileModalVisible,
      setThemeModalVisible,
      setExportModalVisible,
      setNotifModalVisible,
      setAboutModalVisible,
      setPrivacyModalVisible,
      setUserMgmtModalVisible,
      setTrashModalVisible,
    },
  } = useSettingsScreen();

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
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <Navbar
        title="Ajustes"
        showBackButton={false}
        rightElement={
          <TouchableOpacity onPress={() => { }} style={styles.navBtn}>
            <Ionicons name="help-circle-outline" size={24} color={currentTheme.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        {!user ? (
          <View style={[styles.profileCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
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
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setProfileModalVisible(true)}
            style={[styles.profileCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}
          >
            <View style={styles.profileHeader}>
              <View style={[styles.avatarWrapper, { borderColor: currentTheme.primary + '60' }]}>
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
                    <Ionicons name="person" size={24} color={currentTheme.primary} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: currentTheme.text }]} numberOfLines={1}>
                  {fullName}
                </Text>
                <View style={styles.connectedBadge}>
                  <View style={styles.greenDot} />
                  <Text style={[styles.connectedText, { color: '#10b981' }]} numberOfLines={1}>
                    Conectado ({maskedEmail})
                  </Text>
                </View>
                {userRoles && userRoles.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    {userRoles.map((r, i) => (
                      <View key={i} style={{ backgroundColor: currentTheme.primary + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: currentTheme.primary + '40' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: currentTheme.primary }}>
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

        {/* Sync Card */}
        <View style={[styles.syncHeroCard, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <View style={styles.syncHeroHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.syncHeroTitle, { color: currentTheme.text }]}>Estado de Sincronización</Text>
              <Text style={[styles.syncMessageText, { color: currentTheme.textSecondary }]}>{syncMessage}</Text>
            </View>
            {renderSyncBadge()}
          </View>

          <View style={[styles.metricsGrid, { backgroundColor: currentTheme.background, borderColor: currentTheme.border }]}>
            <View style={styles.metricItem}>
              <Ionicons name="albums-outline" size={16} color={currentTheme.primary} style={{ marginBottom: 2 }} />
              <Text style={[styles.metricNumber, { color: currentTheme.text }]}>{stats.totalInventories}</Text>
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Lotes</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: currentTheme.border }]} />
            <View style={styles.metricItem}>
              <Ionicons name="cube-outline" size={16} color={currentTheme.primary} style={{ marginBottom: 2 }} />
              <Text style={[styles.metricNumber, { color: currentTheme.text }]}>{stats.totalBoxes}</Text>
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Cajas</Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: currentTheme.border }]} />
            <View style={styles.metricItem}>
              <Ionicons name="shirt-outline" size={16} color={currentTheme.primary} style={{ marginBottom: 2 }} />
              <Text style={[styles.metricNumber, { color: currentTheme.text }]}>{stats.totalGarments}</Text>
              <Text style={[styles.metricLabel, { color: currentTheme.textSecondary }]}>Prendas</Text>
            </View>
          </View>

          <View style={styles.syncFooterRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.syncFooterLabel, { color: currentTheme.textSecondary }]}>Última actualización</Text>
              <Text style={[styles.syncFooterTime, { color: currentTheme.text }]}>{formattedSyncTime}</Text>
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
                  <Ionicons name="refresh" size={15} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.syncButtonText}>Sincronizar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Sección: Cuenta */}
        <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>CUENTA Y PREFERENCIAS</Text>
        <View style={[styles.menuGroup, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <TouchableOpacity style={styles.menuRow} onPress={() => setProfileModalVisible(true)}>
            <View style={[styles.menuIconBox, { backgroundColor: '#3B82F618' }]}>
              <Ionicons name="person" size={16} color="#3B82F6" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Perfil de Usuario</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

          <TouchableOpacity style={styles.menuRow} onPress={handleSync}>
            <View style={[styles.menuIconBox, { backgroundColor: '#06B6D418' }]}>
              <Ionicons name="sync" size={16} color="#06B6D4" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Sincronización</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

          <TouchableOpacity style={styles.menuRow} onPress={handleToggleTheme}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name={themeMode === 'light' ? 'sunny' : 'moon'} size={16} color="#F59E0B" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Apariencia ({themeMode === 'light' ? 'Modo Claro' : 'Modo Oscuro'})</Text>
            <Ionicons name="swap-horizontal" size={16} color={currentTheme.primary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

          <TouchableOpacity style={styles.menuRow} onPress={() => setThemeModalVisible(true)}>
            <View style={[styles.menuIconBox, { backgroundColor: '#8B5CF618' }]}>
              <Ionicons name="color-palette" size={16} color="#8B5CF6" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Tema de Color</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

          <TouchableOpacity style={styles.menuRow} onPress={() => setNotifModalVisible(true)}>
            <View style={[styles.menuIconBox, { backgroundColor: '#F9731618' }]}>
              <Ionicons name="notifications" size={16} color="#F97316" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Notificaciones</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

          <TouchableOpacity style={styles.menuRow} onPress={() => setExportModalVisible(true)}>
            <View style={[styles.menuIconBox, { backgroundColor: '#10B98118' }]}>
              <Ionicons name="document-text" size={16} color="#10B981" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Copia de seguridad (Excel)</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sección: Administración (Exclusivo para Administrador autenticado) */}
        {isAdmin && (
          <RoleGuard roles={['Admin']}>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>ADMINISTRACIÓN</Text>
            <View style={[styles.menuGroup, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  if (!isAdmin) {
                    Alert.alert('Acceso Denegado', 'Esta sección requiere permisos de Administrador.');
                    return;
                  }
                  setUserMgmtModalVisible(true);
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#6366F118' }]}>
                  <Ionicons name="people" size={16} color="#6366F1" />
                </View>
                <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Gestión de Usuarios y Roles</Text>
                <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  if (!isAdmin) {
                    Alert.alert('Acceso Denegado', 'Esta sección requiere permisos de Administrador.');
                    return;
                  }
                  setTrashModalVisible(true);
                }}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#EF444418' }]}>
                  <Ionicons name="trash" size={16} color="#EF4444" />
                </View>
                <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Papelera de Reciclaje</Text>
                <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleExportDatabase}
                disabled={isExportingDb}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconBox, { backgroundColor: '#8B5CF618' }]}>
                  <Ionicons name="server" size={16} color="#8B5CF6" />
                </View>
                <Text style={[styles.menuLabel, { color: currentTheme.text, textAlignVertical: 'center' }]}>
                  Exportar Base de Datos (.db)
                </Text>
                {isExportingDb ? (
                  <ActivityIndicator size="small" color={currentTheme.primary} />
                ) : (
                  <Ionicons name="share-outline" size={16} color={currentTheme.textSecondary} />
                )}
              </TouchableOpacity>
              {SHOW_ADMIN_IMPORT_TOOLS && (
                <>
                  <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={handleImportSeedData}
                    disabled={isAuthLoading}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: '#10B98118' }]}>
                      <Ionicons name="cloud-download" size={16} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Importar Reporte (629 prendas)</Text>
                      <Text style={{ fontSize: 11, color: currentTheme.textSecondary, marginTop: 1 }}>
                        21 Cajas (TOPYTOP y Lacoste)
                      </Text>
                    </View>
                    {isAuthLoading ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
                    )}
                  </TouchableOpacity>
                  <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={handleImportLegacyBackup}
                    disabled={isAuthLoading}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: '#0EA5E918' }]}>
                      <Ionicons name="images" size={16} color="#0EA5E9" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Importar respaldo antiguo</Text>
                      <Text style={{ fontSize: 11, color: currentTheme.textSecondary, marginTop: 1 }}>
                        Recupera prendas y fotografías sin duplicar
                      </Text>
                    </View>
                    {isAuthLoading ? (
                      <ActivityIndicator size="small" color="#0EA5E9" />
                    ) : (
                      <Ionicons name="folder-open-outline" size={16} color={currentTheme.textSecondary} />
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </RoleGuard>
        )}

        {/* Sección: Información */}
        <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>INFORMACIÓN</Text>
        <View style={[styles.menuGroup, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
          <TouchableOpacity style={styles.menuRow} onPress={() => setAboutModalVisible(true)}>
            <View style={[styles.menuIconBox, { backgroundColor: '#0284C718' }]}>
              <Ionicons name="information-circle" size={16} color="#0284C7" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Acerca de la aplicación</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />
          <TouchableOpacity style={styles.menuRow} onPress={() => setPrivacyModalVisible(true)}>
            <View style={[styles.menuIconBox, { backgroundColor: '#64748B18' }]}>
              <Ionicons name="shield-checkmark" size={16} color="#64748B" />
            </View>
            <Text style={[styles.menuLabel, { color: currentTheme.text }]}>Política de privacidad</Text>
            <Ionicons name="chevron-forward" size={16} color={currentTheme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sección: Sesión */}
        {user && (
          <>
            <Text style={[styles.sectionSubtitle, { color: currentTheme.textSecondary }]}>SESIÓN</Text>
            <View style={[styles.menuGroup, { backgroundColor: currentTheme.card, borderColor: '#EF444425' }]}>
              <TouchableOpacity style={styles.menuRow} onPress={handleSignOut}>
                <View style={[styles.menuIconBox, { backgroundColor: '#EF444418' }]}>
                  <Ionicons name="log-out" size={16} color="#EF4444" />
                </View>
                <Text style={[styles.menuLabel, { color: '#EF4444', fontWeight: '700' }]}>Cerrar sesión</Text>
                <Ionicons name="chevron-forward" size={16} color="#EF444480" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modales */}
      <ProfileModal visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />
      <ThemeModal visible={themeModalVisible} onClose={() => setThemeModalVisible(false)} />
      <ExportModal visible={exportModalVisible} onClose={() => setExportModalVisible(false)} />
      <NotificationSettingsModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} />
      <AboutModal visible={aboutModalVisible} onClose={() => setAboutModalVisible(false)} />
      <PrivacyModal visible={privacyModalVisible} onClose={() => setPrivacyModalVisible(false)} />
      {isAdmin && (
        <>
          <UserManagementModal visible={userMgmtModalVisible} onClose={() => setUserMgmtModalVisible(false)} />
          <TrashModal visible={trashModalVisible} onClose={() => setTrashModalVisible(false)} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBtn: {
    padding: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 4,
  },
  googleButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
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
    backgroundColor: '#10b981',
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
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricDivider: {
    width: 1,
    height: 28,
  },
  metricNumber: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  metricLabel: {
    fontSize: 11,
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
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  menuGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    marginLeft: 58,
    opacity: 0.5,
  },
});
