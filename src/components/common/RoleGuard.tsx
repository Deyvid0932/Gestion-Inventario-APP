import React from 'react';
import { useRoles } from '../../hooks';
import { RoleName } from '../../types/roles';

interface RoleGuardProps {
  roles: RoleName[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ roles, children, fallback = null }) => {
  const { hasRole } = useRoles();

  if (!hasRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
