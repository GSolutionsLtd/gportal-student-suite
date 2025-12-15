export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithRole extends UserProfile {
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export const ROLE_ROUTES: Record<UserRole, string> = {
  super_admin: '/super-admin',
  admin: '/admin',
  teacher: '/teacher',
  student: '/student',
};
