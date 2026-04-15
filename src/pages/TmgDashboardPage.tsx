import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  FileX,
  Search,
  Eye,
  Pencil,
  ChevronDown,
  Loader2,
  RotateCcw,
  Download,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import ExportModal from '../components/export/ExportModal';
import { supabase } from '../lib/supabaseClient';
import type { FormStatus } from '../types';

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  designation: string;
  grade: string;
  employee_number: string;
  manager_name: string;
  form_id: string | null;
  form_status: FormStatus | null;
  form_updated_at: string | null;
}

const STATUS_CONFIG: Record<
  FormStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  draft:          { label: 'Draft',          badgeClass: 'bg-gray-100 text-gray-600',       icon: FileX },
  pending_review: { label: 'Pending Review', badgeClass: 'bg-amber-100 text-amber-700',     icon: Clock },
  returned:       { label: 'Returned',       badgeClass: 'bg-orange-100 text-orange-700',   icon: RotateCcw },
  approved:       { label: 'Approved',       badgeClass: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type StatusFilter = 'all' | FormStatus | 'not_started';

export default function TmgDashboardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: employees } = await supabase
        .from('users')
        .select('id, full_name, email, designation, grade, employee_number, manager_id')
        .eq('role', 'employee')
        .order('full_name');

      if (!employees) { setLoading(false); return; }

      const managerIds = [...new Set(employees.map((e) => e.manager_id).filter(Boolean))];
      let managersMap: Record<string, string> = {};
      if (managerIds.length > 0) {
        const { data: managers } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', managerIds as string[]);
        if (managers) managersMap = Object.fromEntries(managers.map((m) => [m.id, m.full_name]));
      }

      const empIds = employees.map((e) => e.id);
      const { data: forms } = await supabase
        .from('skill_forms')
        .select('id, employee_id, status, updated_at')
        .in('employee_id', empIds);

      const formMap: Record<string, { id: string; status: FormStatus; updated_at: string }> = {};
      if (forms) forms.forEach((f) => { formMap[f.employee_id] = { id: f.id, status: f.status as FormStatus, updated_at: f.updated_at }; });

      setRows(
        employees.map((e) => ({
          id: e.id,
          full_name: e.full_name,
          email: e.email,
          designation: e.designation || '—',
          grade: e.grade || '—',
          employee_number: e.employee_number || '—',
          manager_name: e.manager_id ? (managersMap[e.manager_id] || '—') : '—',
          form_id: formMap[e.id]?.id ?? null,
          form_status: formMap[e.id]?.status ?? null,
          form_updated_at: formMap[e.id]?.updated_at ?? null,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  const grades = useMemo(() => ['all', ...Array.from(new Set(rows.map((r) => r.grade).filter((g) => g !== '—'))).sort()], [rows]);
  const managers = useMemo(() => ['all', ...Array.from(new Set(rows.map((r) => r.manager_name).filter((m) => m !== '—'))).sort()], [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const q = search.toLowerCase();
      if (q && !r.full_name.toLowerCase().includes(q) && !r.employee_number.toLowerCase().includes(q)) return false;
      if (gradeFilter !== 'all' && r.grade !== gradeFilter) return false;
      if (managerFilter !== 'all' && r.manager_name !== managerFilter) return false;
      if (statusFilter === 'not_started' && r.form_status !== null) return false;
      if (statusFilter !== 'all' && statusFilter !== 'not_started' && r.form_status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter, gradeFilter, managerFilter]);

  const stats = useMemo(() => ({
    total: rows.length,
    approved: rows.filter((r) => r.form_status === 'approved').length,
    pending: rows.filter((r) => r.form_status === 'pending_review').length,
    notStarted: rows.filter((r) => r.form_status === null).length,
  }), [rows]);

  const STAT_CARDS = [
    { label: 'Total Employees', value: stats.total,      icon: Users,        color: 'text-primary-500',  bg: 'bg-primary-50',  border: 'border-primary-100' },
    { label: 'Approved',        value: stats.approved,   icon: CheckCircle2, color: 'text-emerald-600',  bg: 'bg-emerald-50',  border: 'border-emerald-100' },
    { label: 'Pending Review',  value: stats.pending,    icon: Clock,        color: 'text-amber-600',    bg: 'bg-amber-50',    border: 'border-amber-100' },
    { label: 'Not Started',     value: stats.notStarted, icon: FileX,        color: 'text-gray-500',     bg: 'bg-gray-50',     border: 'border-gray-200' },
  ];

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all',            label: 'All' },
    { value: 'not_started',    label: 'Not Started' },
    { value: 'draft',          label: 'Draft' },
    { value: 'pending_review', label: 'Pending' },
    { value: 'returned',       label: 'Returned' },
    { value: 'approved',       label: 'Approved' },
  ];

  return (
    <>
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">TMG Overview</h1>
            <p className="text-sm text-gray-500 font-body mt-0.5">Monitor skill profile submissions across all employees.</p>
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={15} />
            Export to Excel
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((s) => (
            <div key={s.label} className={`bg-white rounded-2xl border ${s.border} p-5 shadow-sm`}>
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon size={17} className={s.color} />
              </div>
              <p className="font-heading font-bold text-2xl text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-body mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search by name or employee no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full font-body"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 bg-white outline-none cursor-pointer hover:border-gray-300 transition-colors"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 bg-white outline-none cursor-pointer hover:border-gray-300 transition-colors"
              >
                {grades.map((g) => (
                  <option key={g} value={g}>{g === 'all' ? 'All Grades' : `Grade: ${g}`}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 bg-white outline-none cursor-pointer hover:border-gray-300 transition-colors"
              >
                {managers.map((m) => (
                  <option key={m} value={m}>{m === 'all' ? 'All Managers' : m}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <span className="ml-auto text-xs text-gray-400 font-body shrink-0">
              {filtered.length} of {rows.length} employees
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-primary-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users size={28} className="text-gray-200 mb-3" />
              <p className="font-heading font-semibold text-gray-500 text-sm">No employees found</p>
              <p className="text-xs text-gray-400 font-body mt-1">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Grade</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Manager</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Last Updated</th>
                    <th className="text-right px-5 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((row) => {
                    const cfg = row.form_status ? STATUS_CONFIG[row.form_status] : null;
                    const StatusIcon = cfg?.icon;
                    const initials = getInitials(row.full_name);
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <span className="text-primary-600 text-[11px] font-bold font-heading">{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold font-heading text-gray-800 truncate text-sm">{row.full_name}</p>
                              <p className="text-[11px] text-gray-400 font-body truncate">{row.designation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="text-xs font-body text-gray-600">{row.grade}</span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs font-body text-gray-600 truncate max-w-[120px] block">{row.manager_name}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {cfg && StatusIcon ? (
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
                              <StatusIcon size={10} />
                              {cfg.label}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                              Not Started
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <span className="text-xs text-gray-400 font-body">{formatDate(row.form_updated_at)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            {row.form_id && (
                              <button
                                onClick={() => navigate(`/inbox/review/${row.form_id}`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
                              >
                                <Eye size={12} />
                                View Form
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/admin?edit=${row.id}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              <Pencil size={12} />
                              Edit Profile
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
      </div>
    </AppShell>

    {showExportModal && (
      <ExportModal onClose={() => setShowExportModal(false)} />
    )}
    </>
  );
}
