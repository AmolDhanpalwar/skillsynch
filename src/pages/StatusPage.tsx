import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Activity,
  ChevronUp,
  ChevronDown,
  Users,
  Clock,
  CheckCircle2,
  RotateCcw,
  FileX,
  Search,
  RefreshCw,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { SkeletonTableRows } from '../components/ui/Skeleton';
import { db } from '../lib/db';
import { useCycle } from '../context/CycleContext';
import type { FormStatus } from '../types';

interface StatusRow {
  id: string;
  employee_name: string;
  employee_email: string;
  manager_name: string;
  status: FormStatus | 'not_started';
  submitted_at: string | null;
  days_pending: number | null;
  reminders_sent: number;
}

type SortKey = 'employee_name' | 'manager_name' | 'status' | 'days_pending' | 'reminders_sent';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  approved:       { label: 'Approved',       badge: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  pending_review: { label: 'Pending Review', badge: 'bg-amber-100 text-amber-700',    icon: Clock },
  returned:       { label: 'Returned',       badge: 'bg-orange-100 text-orange-700',  icon: RotateCcw },
  draft:          { label: 'Draft',          badge: 'bg-gray-100 text-gray-600',      icon: FileX },
  not_started:    { label: 'Not Started',    badge: 'bg-slate-100 text-slate-600',    icon: Users },
};

function trafficLight(days: number | null, status: string): string {
  if (status === 'approved' || status === 'not_started' || days === null) return '';
  if (days < 3)  return 'bg-emerald-400';
  if (days <= 7) return 'bg-amber-400';
  return 'bg-red-500';
}

function trafficText(days: number | null, status: string): string {
  if (status === 'approved' || status === 'not_started' || days === null) return 'text-gray-500';
  if (days < 3)  return 'text-emerald-700 font-semibold';
  if (days <= 7) return 'text-amber-700 font-semibold';
  return 'text-red-700 font-semibold';
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function StatusPage() {
  const { activeCycle } = useCycle();
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('days_pending');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    let formsQuery = db
      .from('skill_forms')
      .select('id, employee_id, status, submitted_at, reminders_sent');

    if (activeCycle) {
      formsQuery = formsQuery.eq('cycle_id', activeCycle.id);
    }

    const [{ data: employees }, { data: forms }, { data: allUsers }] = await Promise.all([
      db.from('users').select('id, full_name, email, manager_id').eq('role', 'employee'),
      formsQuery,
      db.from('users').select('id, full_name').eq('is_active', true),
    ]);

    const managerMap: Record<string, string> = {};
    (allUsers ?? []).forEach((u) => { managerMap[u.id] = u.full_name; });

    const formMap: Record<string, typeof forms extends (infer T)[] | null ? T : never> = {};
    (forms ?? []).forEach((f) => { formMap[f.employee_id] = f; });

    const result: StatusRow[] = (employees ?? []).map((emp) => {
      const form = formMap[emp.id];
      const manager = emp.manager_id ? (managerMap[emp.manager_id] || '—') : '—';

      if (!form) {
        return {
          id: emp.id,
          employee_name: emp.full_name,
          employee_email: emp.email,
          manager_name: manager,
          status: 'not_started' as const,
          submitted_at: null,
          days_pending: null,
          reminders_sent: 0,
        };
      }

      const daysPending = form.submitted_at && form.status !== 'approved'
        ? Math.floor((Date.now() - new Date(form.submitted_at).getTime()) / 86_400_000)
        : null;

      return {
        id: form.id,
        employee_name: emp.full_name,
        employee_email: emp.email,
        manager_name: manager,
        status: form.status as FormStatus,
        submitted_at: form.submitted_at,
        days_pending: daysPending,
        reminders_sent: form.reminders_sent ?? 0,
      };
    });

    setRows(result);
    setLoading(false);
  }, [activeCycle]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.employee_name.toLowerCase().includes(q) ||
        r.employee_email.toLowerCase().includes(q) ||
        r.manager_name.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortKey === 'employee_name') { av = a.employee_name; bv = b.employee_name; }
      if (sortKey === 'manager_name')  { av = a.manager_name;  bv = b.manager_name; }
      if (sortKey === 'status')        { av = a.status;        bv = b.status; }
      if (sortKey === 'days_pending')  { av = a.days_pending ?? -1; bv = b.days_pending ?? -1; }
      if (sortKey === 'reminders_sent'){ av = a.reminders_sent; bv = b.reminders_sent; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, search, sortKey, sortDir]);

  const stats = useMemo(() => ({
    total:      rows.length,
    approved:   rows.filter((r) => r.status === 'approved').length,
    pending:    rows.filter((r) => r.status === 'pending_review').length,
    overdue:    rows.filter((r) => r.days_pending !== null && r.days_pending > 7).length,
    notStarted: rows.filter((r) => r.status === 'not_started').length,
  }), [rows]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={11} className="text-gray-300" />;
    return sortDir === 'asc'
      ? <ChevronUp size={11} className="text-primary-500" />
      : <ChevronDown size={11} className="text-primary-500" />;
  }

  function SortTh({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        className={`text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none ${className}`}
        onClick={() => handleSort(col)}
      >
        <div className="flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </div>
      </th>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Form Status Tracking</h1>
            <p className="text-sm text-gray-500 font-body mt-0.5">
              Real-time submission tracker with traffic-light pending indicators.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Employees',  value: stats.total,      icon: Users,        bg: 'bg-primary-50',  border: 'border-primary-100', color: 'text-primary-500' },
            { label: 'Approved',          value: stats.approved,   icon: CheckCircle2, bg: 'bg-emerald-50',  border: 'border-emerald-100', color: 'text-emerald-600' },
            { label: 'Pending Review',    value: stats.pending,    icon: Clock,        bg: 'bg-amber-50',    border: 'border-amber-100',   color: 'text-amber-600' },
            { label: 'Overdue (>7 days)', value: stats.overdue,    icon: Activity,     bg: 'bg-red-50',      border: 'border-red-100',     color: 'text-red-600' },
          ].map((s) => (
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
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <Activity size={15} className="text-primary-500" />
            </div>
            <h2 className="font-heading font-bold text-base text-gray-900 flex-1">All Employees</h2>

            <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-100 px-3 py-2 min-w-[200px]">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search employee or manager…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full font-body"
              />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-body text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> &lt;3 days</span>
              <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-amber-400" /> 3–7 days</span>
              <span className="flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;7 days</span>
            </div>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody><SkeletonTableRows rows={8} cols={5} /></tbody>
              </table>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users size={28} className="text-gray-200 mb-3" />
              <p className="font-heading font-semibold text-gray-500 text-sm">No employees found</p>
              <p className="text-xs text-gray-400 font-body mt-1">Try adjusting your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <SortTh col="employee_name"  label="Employee"        className="px-5" />
                    <SortTh col="manager_name"   label="Manager"         className="hidden md:table-cell" />
                    <SortTh col="status"         label="Status" />
                    <SortTh col="days_pending"   label="Days Pending" />
                    <SortTh col="reminders_sent" label="Reminders" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((row) => {
                    const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.not_started;
                    const Icon = cfg.icon;
                    const dot = trafficLight(row.days_pending, row.status);
                    const daysCls = trafficText(row.days_pending, row.status);
                    return (
                      <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                              <span className="text-primary-600 text-[11px] font-bold font-heading">
                                {getInitials(row.employee_name)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold font-heading text-gray-800 text-sm truncate">{row.employee_name}</p>
                              <p className="text-[11px] text-gray-400 font-body truncate">{row.employee_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs text-gray-500 font-body">{row.manager_name}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full ${cfg.badge}`}>
                            <Icon size={10} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {dot && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />}
                            <span className={`text-sm font-body ${daysCls}`}>
                              {row.days_pending !== null ? `${row.days_pending}d` : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-body text-gray-600">{row.reminders_sent}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400 font-body">
                Showing {filtered.length} of {rows.length} employees
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
