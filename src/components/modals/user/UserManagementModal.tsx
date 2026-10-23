import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../../store/useAppStore';
import { useUserManagement, UserWithRole, useRoles } from '../../../hooks';
import { UserCardItem, ROLE_CONFIG } from './UserCardItem';

interface UserManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ visible, onClose }) => {
  const currentTheme = useAppStore(state => state.currentTheme);
  const insets = useSafeAreaInsets();
  const { isAdmin } = useRoles();

  if (!isAdmin) {
    return null;
  }

  const {
    users,
    availableRoles,
    loading,
    updatingUserId,
    expandedUserId,
    setExpandedUserId,
    currentUser,
    fetchUsersAndRoles,
    deleteUser,
    toggleUserActive,
    setUserRole,
    toggleExpandUser,
  } = useUserManagement({ visible });

  const renderUserItem = ({ item }: { item: UserWithRole }) => {
    return (
      <UserCardItem
        item={item}
        isItemUpdating={updatingUserId === item.id}
        isExpanded={expandedUserId === item.id}
        isCurrentUser={currentUser?.id === item.id}
        availableRoles={availableRoles}
        currentTheme={currentTheme}
        onToggleExpand={() => toggleExpandUser(item.id)}
        onSetRole={roleName => setUserRole(item.id, roleName)}
        onToggleActive={() => toggleUserActive(item.id, item.active)}
        onDelete={() => deleteUser(item.id, item.email)}
      />
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
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    fontSize: 10.5,
    fontStyle: 'italic',
    marginLeft: 'auto',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
  },
});
