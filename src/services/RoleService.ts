import { supabase } from '../database/supabase';
import { UserProfile, RoleName } from '../types/roles';

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
      // 1. Probar primero RPC SECURITY DEFINER get_user_roles (Evita totalmente RLS y problemas de FK)
      const { data: rpcRoles, error: rpcError } = await supabase.rpc('get_user_roles', {
        target_user_id: userId,
      });

      if (!rpcError && rpcRoles && rpcRoles.length > 0) {
        const roleNames: RoleName[] = rpcRoles
          .map((r: any) => typeof r === 'string' ? r : (r.role_name || r.name))
          .filter(Boolean);
        if (roleNames.length > 0) return roleNames;
      }

      // 2. Consulta JOIN estándar a profile_roles + roles
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

        // 3. Fallback de dos pasos si la relación embebida falló
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

      // 4. Si el usuario aún no tiene ningún rol en la BD, asignar rol por defecto
      const { error: assignError } = await supabase.rpc('assign_default_role', {
        target_user_id: userId,
      });

      if (assignError) {
        return await RoleService._fallbackAssignRole(userId);
      }

      // Re-consultar rol asignado
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

  /** Fallback si la RPC assign_default_role no existe en Supabase */
  _fallbackAssignRole: async (userId: string): Promise<RoleName[]> => {
    try {
      // Asegurar que existan los 3 roles base
      const { data: existingRoles } = await supabase.from('roles').select('id, name');
      let rolesMap: Record<string, string> = {};

      if (!existingRoles || existingRoles.length === 0) {
        const { data: newRoles } = await supabase
          .from('roles')
          .insert([
            { name: 'Admin', description: 'Full access to the application' },
            { name: 'Editor', description: 'Can create, edit and delete data' },
            { name: 'Viewer', description: 'Read-only access' },
          ])
          .select('id, name');
        (newRoles || []).forEach((r: any) => { rolesMap[r.name] = r.id; });
      } else {
        existingRoles.forEach((r: any) => { rolesMap[r.name] = r.id; });
      }

      // Primer usuario → Admin, los demás → Editor
      const { count } = await supabase
        .from('profile_roles')
        .select('*', { count: 'exact', head: true });

      const assignedRole: RoleName = (count === 0 || count === null) ? 'Admin' : 'Viewer';
      const assignedRoleId = rolesMap[assignedRole];

      if (assignedRoleId) {
        const { error: insertError } = await supabase.from('profile_roles').upsert(
          { profile_id: userId, role_id: assignedRoleId },
          { onConflict: 'profile_id,role_id' }
        );

        // IMPORTANTE: verificar si realmente se insertó
        if (insertError) {
          console.error('Fallback insert falló (RLS):', insertError);
          return ['Viewer'];
        }
        return [assignedRole];
      }

      return ['Viewer'];
    } catch (e) {
      console.error('Excepción en fallback:', e);
      return ['Viewer'];
    }
  },

  getUserProfileAndRoles: async (userId: string): Promise<UserRoleInfo> => {
    if (!userId) {
      return { profile: null, roles: ['Viewer'], isActive: true };
    }

    try {
      const [profile, roles] = await Promise.all([
        RoleService.getUserProfile(userId).catch(() => null),
        RoleService.getUserRoles(userId).catch(() => ['Viewer' as RoleName]),
      ]);

      const isActive = profile ? (profile.active !== false && profile.activo !== false) : true;

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
