import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ThemeType } from '../../../styles/theme';
import { RoleName } from '../../../types/roles';
import { UserWithRole } from '../../../hooks';
import { maskEmail } from '../../../utils/maskUtils';

export const ROLE_CONFIG: Record<string, { icon: string; color: string; label: string; desc: string }> = {
  Admin: { icon: 'shield-checkmark', color: '#F59E0B', label: 'Admin', desc: 'Full access' },
  Editor: { icon: 'create', color: '#3B82F6', label: 'Editor', desc: 'Can edit data' },
  Viewer: { icon: 'eye', color: '#8B5CF6', label: 'Viewer', desc: 'Read-only access' },
};

interface UserCardItemProps {
  item: UserWithRole;
  isItemUpdating: boolean;
  isExpanded: boolean;
  isCurrentUser: boolean;
  availableRoles: { id: string; name: string }[];
  currentTheme: ThemeType;
  onToggleExpand: () => void;
  onSetRole: (roleName: RoleName) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

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

export const UserCardItem: React.FC<UserCardItemProps> = ({
  item,
  isItemUpdating,
  isExpanded,
  isCurrentUser,
  availableRoles,
  currentTheme,
  onToggleExpand,
  onSetRole,
  onToggleActive,
  onDelete,
}) => {
  const userRolesList = item.roles.length > 0 ? item.roles : ['Editor'];
  const primaryRole = userRolesList[0];
  const primaryRoleConfig = ROLE_CONFIG[primaryRole] || ROLE_CONFIG.Editor;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onToggleExpand}
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
                  onPress={() => onSetRole(roleName)}
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
              onPress={onToggleActive}
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
                onPress={onDelete}
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

const styles = StyleSheet.create({
  userCard: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  expandedPanel: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    alignItems: 'center',
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
    marginBottom: 2,
  },
  roleCardDesc: {
    fontSize: 9.5,
    textAlign: 'center',
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
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  toggleActiveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  updatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  updatingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
