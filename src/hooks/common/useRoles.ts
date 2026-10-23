import { useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { RoleName } from '../../types/roles';

export interface UseRolesReturn {
  roles: RoleName[];
  isAdmin: boolean;
  isEditor: boolean;
  isGuest: boolean;
  isActive: boolean;
  isLoading: boolean;
  hasRole: (allowedRoles: RoleName[]) => boolean;
}

export const useRoles = (): UseRolesReturn => {
  const userRoles = useAppStore(state => state.userRoles);
  const isAccountActive = useAppStore(state => state.isAccountActive);
  const isRoleLoading = useAppStore(state => state.isRoleLoading);
  const user = useAppStore(state => state.user);

  // Blindaje de seguridad: Solo un usuario autenticado con sesión en Supabase puede ser Admin o Editor
  const isAuthenticated = Boolean(user && user.id);
  const isAdmin = isAuthenticated && userRoles.includes('Admin');
  const isEditor = isAuthenticated && (userRoles.includes('Editor') || userRoles.includes('Admin'));
  const isGuest = !isAuthenticated || userRoles.includes('Viewer') || userRoles.length === 0;

  const hasRole = useCallback(
    (allowedRoles: RoleName[]): boolean => {
      // 1. Si no hay sesión (modo local/offline):
      // Permitir únicamente roles operativos locales ('Editor', 'Viewer') para gestión de datos,
      // pero BLOQUEAR explícitamente roles de 'Admin' (administración de usuarios, roles, papelera, etc.)
      if (!user) {
        return allowedRoles.includes('Editor') || allowedRoles.includes('Viewer');
      }

      // 2. Si la cuenta está suspendida por un Admin, denegar todo acceso
      if (!isAccountActive) return false;

      // 3. El Administrador auténtico tiene acceso total
      if (isAdmin) return true;

      // 4. Evaluar coincidencia con los roles asignados en Supabase
      return allowedRoles.some(role => userRoles.includes(role));
    },
    [userRoles, isAccountActive, isAdmin, user]
  );

  return {
    roles: userRoles,
    isAdmin,
    isEditor,
    isGuest,
    isActive: isAccountActive,
    isLoading: isRoleLoading,
    hasRole,
  };
};
