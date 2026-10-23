import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../database/supabase';
import { useAppStore } from '../../store/useAppStore';
import { UserProfile, RoleName } from '../../types/roles';
import { maskEmail } from '../../utils/maskUtils';

export interface UserWithRole extends UserProfile {
  roles: RoleName[];
}

interface UseUserManagementProps {
  visible: boolean;
}

export const useUserManagement = ({ visible }: UseUserManagementProps) => {
  const currentUser = useAppStore(state => state.user);

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const fetchUsersAndRoles = useCallback(async () => {
    if (!currentUser) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const callerRoles = useAppStore.getState().userRoles;
    if (!callerRoles.includes('Admin')) {
      setUsers([]);
      setLoading(false);
      return;
    }

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

  useEffect(() => {
    if (visible) {
      fetchUsersAndRoles();
    } else {
      setExpandedUserId(null);
    }
  }, [visible, fetchUsersAndRoles]);

  const deleteUser = async (userId: string, userEmail: string) => {
    const callerRoles = useAppStore.getState().userRoles;
    if (!currentUser || !callerRoles.includes('Admin')) {
      Alert.alert('Acceso Denegado', 'Solo un Administrador puede eliminar usuarios.');
      return;
    }

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
              const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_user_profile', {
                target_user_id: userId,
              });

              if (rpcErr) {
                console.warn('[UserManagement] delete_user_profile falló:', rpcErr);
                Alert.alert(
                  'No se pudo eliminar',
                  'La función administrativa de Supabase no está disponible o rechazó la operación. Aplica la migración de eliminación de usuarios y vuelve a intentarlo.'
                );
                return;
              }

              if (!rpcData?.success) {
                console.warn('[UserManagement] delete_user_profile no confirmó el borrado:', rpcData);
                Alert.alert('No se pudo eliminar', 'Supabase no confirmó la eliminación del usuario.');
                return;
              }

              // No confiar solo en que la RPC no devolvió error: confirmar que el
              // perfil realmente desapareció antes de quitarlo de la interfaz.
              const { data: remainingProfile, error: verifyError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', userId)
                .maybeSingle();

              if (verifyError || remainingProfile) {
                console.warn('[UserManagement] La eliminación no pudo verificarse:', verifyError || remainingProfile);
                Alert.alert('No se pudo confirmar', 'El usuario continúa en Supabase. Actualiza la función administrativa y vuelve a intentarlo.');
                return;
              }

              setUsers(prev => prev.filter(u => u.id !== userId));
              setExpandedUserId(prev => prev === userId ? null : prev);
              Alert.alert('Éxito', 'El usuario y su acceso fueron eliminados permanentemente.');
            } catch (e: any) {
              console.error('Excepción al eliminar usuario:', e);
              Alert.alert('Error', e.message || 'Ocurrió un fallo inesperado al eliminar la cuenta.');
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    const callerRoles = useAppStore.getState().userRoles;
    if (!currentUser || !callerRoles.includes('Admin')) {
      Alert.alert('Acceso Denegado', 'Solo un Administrador puede suspender o reactivar usuarios.');
      return;
    }

    if (currentUser?.id === userId) {
      Alert.alert('Acción no permitida', 'No puedes suspender tu propia cuenta de Administrador.');
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    const actionLabel = currentActive ? 'Suspender' : 'Reactivar';
    const actionDesc = currentActive
      ? `Se suspenderá el acceso de "${targetUser?.name || 'este usuario'}". Será expulsado y no podrá acceder a la app ni sincronizar datos.`
      : `Se reactivará el acceso de "${targetUser?.name || 'este usuario'}". Podrá volver a iniciar sesión y sincronizar datos.`;

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
              let updateSuccess = false;

              // 1. Intentar vía función RPC segura en Supabase (evita bloqueo de políticas RLS)
              try {
                const { error: rpcErr } = await supabase.rpc('toggle_user_active', {
                  target_user_id: userId,
                  new_active: newActiveState,
                });
                if (!rpcErr) {
                  updateSuccess = true;
                } else {
                  console.warn('[UserManagement] RPC toggle_user_active falló o no existe:', rpcErr.message);
                }
              } catch (_) {}

              // 2. Si no existe el RPC, intentar actualización directa en tabla profiles
              if (!updateSuccess) {
                const { error: directErr } = await supabase
                  .from('profiles')
                  .update({ active: newActiveState })
                  .eq('id', userId);

                if (!directErr) {
                  updateSuccess = true;
                } else {
                  console.error('[UserManagement] Error directo al actualizar active:', directErr);
                }
              }

              if (updateSuccess) {
                setUsers(prev =>
                  prev.map(u => (u.id === userId ? { ...u, active: newActiveState } : u))
                );
                Alert.alert(
                  'Estado Actualizado',
                  `El usuario ha sido ${newActiveState ? 'reactivado' : 'suspendido'} exitosamente.`
                );
              } else {
                Alert.alert(
                  'Error de Permisos en Supabase',
                  'No se pudo cambiar el estado del usuario debido a las políticas de seguridad (RLS) de Supabase.\n\nPor favor ejecuta la función SQL de administración en Supabase.'
                );
              }
            } catch (e: any) {
              console.error('Excepción en toggleUserActive:', e);
              Alert.alert('Error', e.message || 'Ocurrió un fallo inesperado.');
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ]
    );
  };

  const setUserRole = async (userId: string, targetRoleName: RoleName) => {
    const callerRoles = useAppStore.getState().userRoles;
    if (!currentUser || !callerRoles.includes('Admin')) {
      Alert.alert('Acceso Denegado', 'Solo un Administrador puede modificar roles de usuario.');
      return;
    }

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
                console.error('[UserManagement] RPC change_user_role falló:', rpcError);
                Alert.alert(
                  'Error de Permisos en Supabase',
                  'No se pudo actualizar el rol. La operación debe ser ejecutada por la función de seguridad en Supabase (change_user_role).'
                );
                return;
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

  const toggleExpandUser = (userId: string) => {
    setExpandedUserId(prev => (prev === userId ? null : userId));
  };

  return {
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
  };
};
