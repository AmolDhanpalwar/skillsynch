import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Settings,
  Plus,
  Search,
  ChevronDown,
  Loader2,
  X,
  Check,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Shield,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { SkeletonTableRows } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabaseClient';
import { seedUsersIfEmpty } from '../lib/seedUsers';
import type { UserRole } from '../types';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  designation: string;
  grade: string;
  is_active: boolean;
  created_at: string;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'employee',   label: 'Employee' },
  { value: 'manager',    label: 'Manager' },
  { value: 'tmg',        label: 'Technical Manager' },
  { value: 'management', label: 'Management' },
  { value: 'admin',      label: 'Administrator' },
];

const ROLE_BADGE: Record<UserRole, string> = {
  employee:   'bg-gray-100 text-gray-600',
  manager:    'bg-sky-100 text-sky-700',
  tmg:        'bg-accent-50 text-accent-700',
  management: 'bg-emerald-100 text-emerald-700',
  admin:      'bg-red-100 text-red-700',
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'employee' as UserRole });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/admin-create-user`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/10 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
              <Plus size={15} className="text-primary-500" />
            </div>
            <h2 className="font-heading font-bold text-base text-gray-900">Create New User</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 font-body">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-heading text-gray-700">Full Name</label>
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              placeholder="John Smith"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-heading text-gray-700">Email Address</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              placeholder="john@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-heading text-gray-700">Password</label>
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              placeholder="Min. 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold font-heading text-gray-700">Role</label>
            <div className="relative">
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full appearance-none px-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 bg-white outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all cursor-pointer"
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white text-sm font-semibold font-heading transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resetingId, setResetingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  async function loadUsers() {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, designation, grade, is_active, created_at')
      .order('full_name');
    setUsers((data ?? []) as AdminUser[]);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter]);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSavingId(userId);
    await supabase.from('users').update({ role: newRole }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    setSavingId(null);
  }

  async function handleResetPassword(userId: string) {
    setResetingId(userId);
    const user = users.find((u) => u.id === userId);
    if (!user) { setResetingId(null); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    await fetch(`${supabaseUrl}/functions/v1/admin-reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    setResetingId(null);
  }

  async function handleToggleActive(userId: string, current: boolean) {
    setTogglingId(userId);
    await supabase.from('users').update({ is_active: !current }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !current } : u));
    setTogglingId(null);
  }

  async function handleResetDemo() {
    setSeedingDemo(true);
    setSeedMsg('');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await seedUsersIfEmpty();
    await loadUsers();
    setSeedMsg('Demo data has been reset.');
    setSeedingDemo(false);
    setTimeout(() => setSeedMsg(''), 4000);
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 font-body mt-0.5">Manage users, roles, and system configuration.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold font-heading transition-all shadow-sm shadow-primary-200"
          >
            <Plus size={15} />
            Create User
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <Users size={15} className="text-primary-500" />
            </div>
            <h2 className="font-heading font-bold text-base text-gray-900 flex-1">User Management</h2>
            <span className="text-xs text-gray-400 font-body">{filtered.length} users</span>
          </div>

          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-gray-50/50">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2 flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full font-body"
              />
            </div>

            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 bg-white outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody><SkeletonTableRows rows={6} cols={5} /></tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users size={28} className="text-gray-200 mb-3" />
              <p className="font-heading font-semibold text-gray-500 text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((u) => {
                    const initials = getInitials(u.full_name);
                    const isSaving = savingId === u.id;
                    const isReseting = resetingId === u.id;
                    const isToggling = togglingId === u.id;
                    return (
                      <tr key={u.id} className={`hover:bg-gray-50/60 transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <span className="text-primary-600 text-[11px] font-bold font-heading">{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold font-heading text-gray-800 text-sm truncate">{u.full_name}</p>
                              <p className="text-[11px] text-gray-400 font-body truncate sm:hidden">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="text-xs text-gray-500 font-body truncate max-w-[180px] block">{u.email}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="relative flex items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              disabled={isSaving}
                              className={`appearance-none pl-2.5 pr-7 py-1.5 rounded-lg text-[11px] font-semibold font-heading border cursor-pointer outline-none transition-all ${ROLE_BADGE[u.role]} border-transparent hover:border-gray-200`}
                            >
                              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            {isSaving ? (
                              <Loader2 size={11} className="animate-spin text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            ) : (
                              <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleResetPassword(u.id)}
                              disabled={isReseting}
                              title="Reset password to Welcome@123"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold font-heading text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                              {isReseting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                              Reset PW
                            </button>
                            <button
                              onClick={() => handleToggleActive(u.id, u.is_active)}
                              disabled={isToggling}
                              title={u.is_active ? 'Deactivate user' : 'Activate user'}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold font-heading disabled:opacity-50 transition-colors ${u.is_active ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                            >
                              {isToggling ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : u.is_active ? (
                                <ToggleRight size={13} />
                              ) : (
                                <ToggleLeft size={13} />
                              )}
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Settings size={15} className="text-amber-500" />
            </div>
            <h2 className="font-heading font-bold text-base text-gray-900">System Settings</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-primary-500" />
                <p className="text-xs font-semibold font-heading text-gray-700">App Version</p>
              </div>
              <p className="text-2xl font-bold font-heading text-gray-900">v1.0.0</p>
              <p className="text-xs text-gray-400 font-body mt-1">SkillSync — Skill Profile Management</p>
            </div>

            <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-amber-500" />
                <p className="text-xs font-semibold font-heading text-gray-700">Demo Data</p>
              </div>
              <p className="text-xs text-gray-500 font-body mb-3 leading-relaxed">
                Re-seed the database with demo employees, managers, and skill forms. This will clear all existing user data.
              </p>
              {seedMsg && (
                <p className="text-xs text-emerald-600 font-body mb-2 flex items-center gap-1.5">
                  <Check size={12} />
                  {seedMsg}
                </p>
              )}
              <button
                onClick={handleResetDemo}
                disabled={seedingDemo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs font-semibold font-heading transition-colors disabled:opacity-60"
              >
                {seedingDemo ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadUsers}
        />
      )}
    </AppShell>
  );
}
