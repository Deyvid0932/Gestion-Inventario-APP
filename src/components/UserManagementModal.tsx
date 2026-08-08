import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../database/supabase';
import { UserProfile, RoleName } from '../types/roles';
import { maskEmail } from '../utils/maskUtils';

interface UserManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

interface UserWithRole extends UserProfile {
  roles: RoleName[];
}

const ROLE_CONFIG: Record<string, { icon: string; color: string; label: string; desc: string }> = {
  Admin: { icon: 'shield-checkmark', color: '#F59E0B', label: 'Admin', desc: 'Full access' },
  Editor: { icon: 'create', color: '#3B82F6', label: 'Editor', desc: 'Can edit data' },
  Viewer: { icon: 'eye', color: '#8B5CF6', label: 'Viewer', desc: 'Read-only access' },
};

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();
  const currentUser = useAppStore(state => state.user);

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      fetchUsersAndRoles();
    } else {
      setExpandedUserId(null);
    }
  }, [visible]);

  const fetchUsersAndRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rolesData } = await supabase.from('roles').select('*');
      let combinedRoles = rolesData && rolesData.length > 0 ? [...rolesData] : [];
      const existingNames = new Set(combinedRoles.map((r: any) => r.name));

      (['Admin', 'Editor', 'Viewer'] as RoleName[]).forEach(name => {
        if (!existingNames.has(name)) {
          combinedRoles.push({ id: `temp-${name}`, name });
        }
      });
      setAvailableRoles(combinedRoles);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error cargando usuarios:', profilesError);
        Alert.alert('Error', 'No se pudieron cargar los usuarios.');
        setLoading(false);
        return;
      }

      const { data: userRolesData } = await supabase
        .from('profile_roles')
        .select('profile_id, role_id, roles ( id, name )');

      // Mapeo seguro por ID de rol para evitar fallos si PostgREST no embebe la relación
      const rolesById = new Map<string, string>();
      (rolesData || []).forEach((r: any) => rolesById.set(r.id, r.name));

      const mappedUsers: UserWithRole[] = (profilesData || []).map((prof: any) => {
        const userAssignedRoles: RoleName[] = (userRolesData || [])
          .filter((ur: any) => ur.profile_id === prof.id)
          .map((ur: any) => {
            if (ur.roles) {
              if (Array.isArray(ur.roles)) return ur.roles[0]?.name || ur.roles[0]?.nombre;
              return ur.roles?.name || ur.roles?.nombre;
            }
            return rolesById.get(ur.role_id);
          })
          .filter(Boolean) as RoleName[];

        return {
          id: prof.id,
          name: prof.name || prof.nombre || prof.email?.split('@')[0] || 'Usuario',
          email: prof.email || '',
          active: prof.active !== false && prof.activo !== false,
          avatar_url: prof.avatar_url,
          created_at: prof.created_at,
          roles: userAssignedRoles.length > 0 ? userAssignedRoles : ['Viewer'],
        };
      });

      setUsers(mappedUsers);
    } catch (e) {
      console.error('Excepción al cargar usuarios:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteUser = async (userId: string, userEmail: string) => {
    if (currentUser?.id === userId) {
      Alert.alert('Acción no permitida', 'No puedes eliminar tu propia cuenta de Administrador.');
      return;
    }

    Alert.alert(
      'Eliminar Usuario',
      `¿Estás seguro de eliminar permanentemente a "${maskEmail(userEmail)}"? Esta acción eliminará su perfil y roles de Supabase.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setUpdatingUserId(userId);
            try {
              // 1. Intentar RPC de eliminación atómica
              const { error: rpcErr } = await supabase.rpc('delete_user_profile', {
                target_user_id: userId,
              });

              if (rpcErr) {
                console.warn('[UserManagement] RPC delete_user_profile falló o no existe, ejecutando fallback:', rpcErr.message);
                // Fallback manual: Borrar relación de roles y luego el perfil
                await supabase.from('profile_roles').delete().eq('profile_id', userId);
                const { error: delError } = await supabase.from('profiles').delete().eq('id', userId);

                if (delError) {
                  console.warn('[UserManagement] Borrado físico denegado por RLS (code 42501), aplicando desactivación:', delError.message);
                  // Si PostgreSQL RLS bloquea el borrado físico, deshabilitar/suspender al usuario
                  const { error: suspendErr } = await supabase
                    .from('profiles')
                    .update({ active: false })
                    .eq('id', userId);

                  if (suspendErr) {
                    console.error('[UserManagement] Error al suspender usuario:', suspendErr);
                    Alert.alert('Error', 'No se pudo eliminar ni suspender el usuario de Supabase. Verifica los permisos.');
                    return;
                  }
                }
              }

              // Eliminar de la lista local de React
              setUsers(prev => prev.filter(u => u.id !== userId));
              Alert.alert('Éxito', 'El usuario ha sido eliminado/desactivado correctamente de Supabase.');
            } catch (e) {
              console.error('Excepción al eliminar usuario:', e);
              Alert.alert('Error', 'Ocurrió un fallo inesperado al eliminar la cuenta.');
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    const targetUser = users.find(u => u.id === userId);
    const actionLabel = currentActive ? 'Suspender' : 'Reactivar';
    const actionDesc = currentActive
      ? `Se suspenderá el acceso de "${targetUser?.name || 'este usuario'}". No podrá sincronizar datos mientras esté suspendido.`
      : `Se reactivará el acceso de "${targetUser?.name || 'este usuario'}". Podrá volver a sincronizar datos.`;

    Alert.alert(
      `¿${actionLabel} usuario?`,
      actionDesc,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: actionLabel,
          style: currentActive ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingUserId(userId);
            const newActiveState = !currentActive;
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ active: newActiveState })
                .eq('id', userId);

              if (error) {
                console.error('Error toggleActive:', error);
                Alert.alert('Error', 'No se pudo actualizar el estado.');
              } else {
                setUsers(prev =>
                  prev.map(u => (u.id === userId ? { ...u, active: newActiveState } : u))
                );
              }
            } catch (e) {
              console.error(e);
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const setUserRole = async (userId: string, targetRoleName: RoleName) => {
    const targetUser = users.find(u => u.id === userId);
    const currentRole = targetUser?.roles?.[0] || 'Sin rol';

    if (currentRole === targetRoleName) return; // Ya tiene este rol

    Alert.alert(
      '¿Cambiar rol de usuario?',
      `Se cambiará el rol de "${targetUser?.name || 'este usuario'}" de "${currentRole}" a "${targetRoleName}".\n\nEsto afectará sus permisos de inmediato.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setUpdatingUserId(userId);
            try {
              const normalizedTarget = targetRoleName.trim().toLowerCase();

              let roleId = availableRoles.find(
                r => r.name?.trim()?.toLowerCase() === normalizedTarget && !r.id.startsWith('temp-')
              )?.id;

              if (!roleId) {
                const { data: allRoles } = await supabase.from('roles').select('id, name');
                if (allRoles && allRoles.length > 0) {
                  const match = allRoles.find((r: any) => r.name?.trim()?.toLowerCase() === normalizedTarget);
                  if (match) roleId = match.id;
                }
              }

              if (!roleId) {
                Alert.alert('Error', `No se encontró el identificador del rol "${targetRoleName}" en Supabase.`);
                return;
              }

              const { error: rpcError } = await supabase.rpc('change_user_role', {
                target_user_id: userId,
                new_role_id: roleId,
              });

              if (rpcError) {
                console.warn('[UserManagement] RPC change_user_role falló, ejecutando reemplazo manual:', rpcError);
                await supabase.from('profile_roles').delete().eq('profile_id', userId);
                const { error: insErr } = await supabase
                  .from('profile_roles')
                  .insert({ profile_id: userId, role_id: roleId });

                if (insErr) {
                  console.error('[UserManagement] Error al insertar nuevo rol:', insErr);
                  Alert.alert('Error', 'No se pudo actualizar el rol en Supabase. Verifica las políticas RLS.');
                  return;
                }
              }

              const newRoles: RoleName[] = [targetRoleName];
              setUsers(prev => prev.map(u => (u.id === userId ? { ...u, roles: newRoles } : u)));

              if (currentUser && currentUser.id === userId) {
                useAppStore.getState().setUserProfileAndRoles(
                  useAppStore.getState().userProfile,
                  newRoles,
                  true
                );
              }

              Alert.alert('Rol Actualizado', `Se asignó correctamente el rol "${targetRoleName}".`);
            } catch (e) {
              console.error('Excepción al asignar rol:', e);
              Alert.alert('Error', 'Ocurrió un fallo inesperado al cambiar el rol.');
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTimeSince = (dateStr?: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Ayer';
    if (days < 30) return `Hace ${days}d`;
    const months = Math.floor(days / 30);
    return `Hace ${months}m`;
  };

  const renderUserItem = ({ item }: { item: UserWithRole }) => {
    const isItemUpdating = updatingUserId === item.id;
    const userRolesList = item.roles.length > 0 ? item.roles : ['Editor'];
    const primaryRole = userRolesList[0];
    const primaryRoleConfig = ROLE_CONFIG[primaryRole] || ROLE_CONFIG.Editor;
    const isExpanded = expandedUserId === item.id;
    const isCurrentUser = currentUser?.id === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpandedUserId(isExpanded ? null : item.id)}
        style={[
          styles.userCard,
          {
            backgroundColor: currentTheme.background,
            borderColor: isExpanded ? primaryRoleConfig.color + '60' : currentTheme.border,
            borderWidth: isExpanded ? 1.5 : 1,
          },
        ]}
      >
        {/* Fila principal del usuario */}
        <View style={styles.userHeader}>
          {/* Avatar con foto de perfil o iniciales */}
          <View
            style={[
              styles.avatarCircle,
              {
                backgroundColor: primaryRoleConfig.color + '20',
                borderColor: primaryRoleConfig.color + '40',
                borderWidth: 1.5,
                overflow: 'hidden',
              },
            ]}
          >
            {item.avatar_url ? (
              <Image
                source={{ uri: item.avatar_url }}
                style={{ width: '100%', height: '100%', borderRadius: 22 }}
                contentFit="cover"
              />
            ) : (
              <Text style={[styles.avatarText, { color: primaryRoleConfig.color }]}>
                {getInitials(item.name)}
              </Text>
            )}
          </View>

          {/* Info del usuario */}
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <Text style={[styles.userName, { color: currentTheme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              {isCurrentUser && (
                <View style={[styles.youBadge, { backgroundColor: currentTheme.primary + '20' }]}>
                  <Text style={[styles.youBadgeText, { color: currentTheme.primary }]}>Tú</Text>
                </View>
              )}
            </View>
            <Text style={[styles.userEmail, { color: currentTheme.textSecondary }]} numberOfLines={1}>
              {maskEmail(item.email)}
            </Text>

            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {userRolesList.map(role => {
                const config = ROLE_CONFIG[role] || { icon: 'shield-outline', color: currentTheme.primary, label: role };
                return (
                  <View key={role} style={[styles.roleBadge, { backgroundColor: config.color + '18' }]}>
                    <Ionicons name={config.icon as any} size={10} color={config.color} />
                    <Text style={[styles.roleBadgeText, { color: config.color }]}>
                      {config.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Status */}
          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', paddingLeft: 8 }}>
            <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: item.active ? '#22C55E' : '#EF4444' },
                ]}
              />
              <Text style={{ fontSize: 10, fontWeight: '600', color: currentTheme.textSecondary }}>
                {item.active ? 'Activo' : 'Suspendido'}
              </Text>
            </View>
          </View>
        </View>

        {/* Panel expandido */}
        {isExpanded && (
          <View style={[styles.expandedPanel, { borderTopColor: currentTheme.border }]}>
            {/* Info extra */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={13} color={currentTheme.textSecondary} />
                <Text style={[styles.infoText, { color: currentTheme.textSecondary }]}>
                  Registrado: {getTimeSince(item.created_at)}
                </Text>
              </View>
            </View>

            {/* Selector de Rol */}
            <Text style={[styles.sectionLabel, { color: currentTheme.textSecondary }]}>
              ASIGNAR ROL AL USUARIO
            </Text>
            <View style={styles.roleGrid}>
              {availableRoles.map(roleObj => {
                const roleName = roleObj.name as RoleName;
                const config = ROLE_CONFIG[roleName] || { icon: 'shield-outline', color: currentTheme.primary, label: roleName, desc: 'Permiso' };
                const isSelected = item.roles.includes(roleName);

                return (
                  <TouchableOpacity
                    key={roleObj.id}
                    disabled={isItemUpdating}
                    onPress={() => setUserRole(item.id, roleName)}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: isSelected ? config.color + '18' : currentTheme.card,
                        borderColor: isSelected ? config.color : currentTheme.border,
                        borderWidth: isSelected ? 1.5 : 1,
                        opacity: isItemUpdating ? 0.5 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.roleCardIcon, { backgroundColor: config.color + '20' }]}>
                      <Ionicons name={config.icon as any} size={16} color={config.color} />
                    </View>
                    <Text style={[styles.roleCardLabel, { color: isSelected ? config.color : currentTheme.text }]}>
                      {config.label}
                    </Text>
                    <Text style={[styles.roleCardDesc, { color: currentTheme.textSecondary }]}>
                      {config.desc || 'Rol'}
                    </Text>
                    {isSelected && (
                      <View style={[styles.selectedCheck, { backgroundColor: config.color }]}>
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Botones de acción: Suspender / Reactivar & Eliminar */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                style={[
                  styles.toggleActiveBtn,
                  {
                    flex: 1,
                    backgroundColor: item.active ? '#F59E0B12' : '#22C55E12',
                    borderColor: item.active ? '#F59E0B30' : '#22C55E30',
                  },
                ]}
                onPress={() => toggleUserActive(item.id, item.active)}
                disabled={isItemUpdating}
              >
                <Ionicons
                  name={item.active ? 'pause-circle-outline' : 'checkmark-circle-outline'}
                  size={16}
                  color={item.active ? '#F59E0B' : '#22C55E'}
                />
                <Text
                  style={[
                    styles.toggleActiveText,
                    { color: item.active ? '#F59E0B' : '#22C55E' },
                  ]}
                >
                  {item.active ? 'Suspender' : 'Reactivar'}
                </Text>
              </TouchableOpacity>

              {!isCurrentUser && (
                <TouchableOpacity
                  style={[
                    styles.toggleActiveBtn,
                    {
                      flex: 1,
                      backgroundColor: '#EF444415',
                      borderColor: '#EF444440',
                    },
                  ]}
                  onPress={() => deleteUser(item.id, item.email)}
                  disabled={isItemUpdating}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={[styles.toggleActiveText, { color: '#EF4444' }]}>
                    Eliminar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Overlay de carga */}
        {isItemUpdating && (
          <View style={styles.updatingOverlay}>
            <View style={styles.updatingPill}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.updatingText}>Actualizando...</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.container,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom + 20, 24),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: currentTheme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.headerIcon, { backgroundColor: currentTheme.primary + '15' }]}>
                <Ionicons name="people" size={18} color={currentTheme.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: currentTheme.text }]}>
                  Gestión de Usuarios
                </Text>
                <Text style={[styles.headerSubtitle, { color: currentTheme.textSecondary }]}>
                  {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: currentTheme.border + '30' }]}
            >
              <Ionicons name="close" size={20} color={currentTheme.text} />
            </TouchableOpacity>
          </View>

          {/* Leyenda de roles */}
          <View style={[styles.legendRow, { borderBottomColor: currentTheme.border }]}>
            {Object.entries(ROLE_CONFIG).map(([key, config]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                <Text style={[styles.legendText, { color: currentTheme.textSecondary }]}>{config.label}</Text>
              </View>
            ))}
            <Text style={[styles.legendHint, { color: currentTheme.textSecondary }]}>
              Toca un usuario para editar
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
              <Text style={{ color: currentTheme.textSecondary, marginTop: 12, fontSize: 13 }}>
                Cargando usuarios...
              </Text>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.loadingContainer}>
              <View style={[styles.emptyCircle, { backgroundColor: currentTheme.primary + '10' }]}>
                <Ionicons name="people-outline" size={40} color={currentTheme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: currentTheme.text }]}>Sin usuarios</Text>
              <Text style={[styles.emptyDesc, { color: currentTheme.textSecondary }]}>
                No se encontraron usuarios registrados.
              </Text>
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={item => item.id}
              renderItem={renderUserItem}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 20 }}
              onRefresh={fetchUsersAndRoles}
              refreshing={loading}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  legendHint: {
    fontSize: 10,
    fontStyle: 'italic',
    marginLeft: 'auto',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  userCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 11,
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  expandedPanel: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 11,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    position: 'relative',
  },
  roleCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleCardLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleCardDesc: {
    fontSize: 9,
    marginTop: 2,
  },
  selectedCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleActiveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  updatingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
