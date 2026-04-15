export type UserRole = 'employee' | 'manager' | 'tmg' | 'management' | 'admin';
export type FormStatus = 'draft' | 'pending_review' | 'returned' | 'approved';
export type SkillCategory = 'language' | 'framework';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  employee_number?: string;
  designation?: string;
  grade?: string;
  role: UserRole;
  manager_id?: string;
  created_at: string;
}

export function getRoleHomePath(role: UserRole): string {
  switch (role) {
    case 'employee': return '/dashboard';
    case 'manager': return '/inbox';
    case 'tmg': return '/tmg-dashboard';
    case 'management': return '/reports';
    case 'admin': return '/admin';
  }
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'employee': return 'Employee';
    case 'manager': return 'Manager';
    case 'tmg': return 'Technical Manager';
    case 'management': return 'Management';
    case 'admin': return 'Administrator';
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
