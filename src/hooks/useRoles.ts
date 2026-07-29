import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { RoleName } from '../types/roles';

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

  const isAdmin = userRoles.includes('Admin');
  const isEditor = userRoles.includes('Editor');
  const isGuest = userRoles.includes('Viewer') || userRoles.length === 0;

  const hasRole = useCallback(
    (allowedRoles: RoleName[]): boolean => {
      if (!isAccountActive) return false;
      if (isAdmin) return true; // El administrador siempre tiene acceso total
      return allowedRoles.some(role => userRoles.includes(role));
    },
    [userRoles, isAccountActive, isAdmin]
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
