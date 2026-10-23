import { supabase } from '../../database/supabase';
import { UserProfile, RoleName } from '../../types/roles';

export interface UserRoleInfo {
  profile: UserProfile | null;
  roles: RoleName[];
  isActive: boolean;
}

export const RoleService = {
  getUserProfile: async (userId: string): Promise<UserProfile | null> => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error al obtener perfil en RoleService:', error);
        return null;
      }
      return data as UserProfile | null;
    } catch (e) {
      console.error('Excepción en RoleService.getUserProfile:', e);
      return null;
    }
  },

  getUserRoles: async (userId: string): Promise<RoleName[]> => {
    if (!userId) return ['Viewer'];
    try {
      const { data, error } = await supabase
        .from('profile_roles')
        .select('role_id, roles ( id, name )')
        .eq('profile_id', userId);

      if (!error && data && data.length > 0) {
        const roleNames: RoleName[] = data
          .flatMap((item: any) => {
            if (!item.roles) return [];
            if (Array.isArray(item.roles)) {
              return item.roles.map((r: any) => r.name || r.nombre);
            }
            return [item.roles.name || item.roles.nombre];
          })
          .filter(Boolean);

        if (roleNames.length > 0) return roleNames;

       
        const roleIds = data.map((item: any) => item.role_id).filter(Boolean);
        if (roleIds.length > 0) {
          const { data: directRoles } = await supabase
            .from('roles')
            .select('name')
            .in('id', roleIds);

          if (directRoles && directRoles.length > 0) {
            const names = directRoles.map((r: any) => r.name).filter(Boolean);
            if (names.length > 0) return names;
          }
        }
      }

     
      const { error: assignError } = await supabase.rpc('assign_default_role', {
        target_user_id: userId,
      });

      if (assignError && assignError.code !== '23505') {
        console.error('[RoleService] RPC assign_default_role falló:', {
          code: assignError.code,
          message: assignError.message,
          details: assignError.details,
          hint: assignError.hint,
        });
        // La app no asigna roles directamente: RLS debe impedirlo.
        return ['Viewer'];
      }

      // 23505 significa que otra llamada ya creó esta relación. Leer el rol
      // confirmado por Supabase en vez de reportar un fallo al usuario.

      const { data: newData } = await supabase
        .from('profile_roles')
        .select('role_id, roles ( id, name )')
        .eq('profile_id', userId);

      if (newData && newData.length > 0) {
        const roleNames: RoleName[] = newData
          .flatMap((item: any) => {
            if (!item.roles) return [];
            if (Array.isArray(item.roles)) {
              return item.roles.map((r: any) => r.name || r.nombre);
            }
            return [item.roles.name || item.roles.nombre];
          })
          .filter(Boolean);
        if (roleNames.length > 0) return roleNames;
      }

      return ['Viewer'];
    } catch (e) {
      console.error('Excepción en RoleService.getUserRoles:', e);
      return ['Viewer'];
    }
  },
 
  getUserProfileAndRoles: async (userId: string): Promise<UserRoleInfo> => {
    if (!userId) {
      return { profile: null, roles: ['Viewer'], isActive: true };
    }

    try {
      // La RPC puede crear el perfil faltante. Esperar primero a los roles y
      // consultar el perfil después evita guardar en el store un null obsoleto.
      const roles = await RoleService.getUserRoles(userId).catch(() => ['Viewer' as RoleName]);
      const profile = await RoleService.getUserProfile(userId).catch(() => null);

      const isActive = profile ? (profile.active !== false) : true;

      return {
        profile,
        roles: roles || ['Viewer'],
        isActive,
      };
    } catch (e) {
      console.error('Excepción en RoleService.getUserProfileAndRoles:', e);
      return { profile: null, roles: ['Viewer'], isActive: true };
    }
  },
};
