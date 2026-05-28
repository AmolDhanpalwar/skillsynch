export type UserRole = 'employee' | 'manager' | 'tmg' | 'management' | 'admin';
export type FormStatus = 'draft' | 'pending_review' | 'returned' | 'approved';
export type SkillCategory = 'language' | 'framework';
export type CycleType = 'mid_year' | 'full_year' | 'custom';
export type CycleStatus = 'draft' | 'active' | 'closed' | 'suspended';

export interface ReviewCycle {
  id: string;
  name: string;
  cycle_type: CycleType;
  status: CycleStatus;
  employee_deadline: string | null;
  manager_deadline: string | null;
  triggered_at: string | null;
  closed_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  suspended_by: string | null;
  created_by: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SkillFormVersion {
  id: string;
  cycle_id: string;
  form_id: string | null;
  employee_id: string;
  snapshot: Record<string, unknown>;
  approved_at: string;
  approved_by: string | null;
  created_at: string;
}

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  mid_year:  'Mid Year',
  full_year: 'Full Year',
  custom:    'Custom',
};

export const CYCLE_STATUS_CONFIG: Record<CycleStatus, { label: string; badgeClass: string }> = {
  draft:     { label: 'Draft',     badgeClass: 'bg-gray-100 text-gray-600' },
  active:    { label: 'Active',    badgeClass: 'bg-emerald-100 text-emerald-700' },
  closed:    { label: 'Closed',    badgeClass: 'bg-slate-100 text-slate-600' },
  suspended: { label: 'Suspended', badgeClass: 'bg-red-100 text-red-700' },
};

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
