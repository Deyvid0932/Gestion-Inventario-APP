export type RoleName = 'Admin' | 'Editor' | 'Viewer' | string;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  nombre?: string;
  active: boolean;
  activo?: boolean;
  avatar_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Role {
  id: string;
  name: RoleName;
  nombre?: RoleName;
}

export interface UserRoleRelation {
  profile_id: string;
  role_id: string;
  roles?: Role;
}
