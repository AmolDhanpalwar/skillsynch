import { useEffect, useRef, useState, useMemo } from 'react';
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
  UserCog,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import ExportModal from '../components/export/ExportModal';
import Toast from '../components/form/Toast';
import { SkeletonTableRows } from '../components/ui/Skeleton';
import CycleSelectorDropdown from '../components/ui/CycleSelectorDropdown';
import { supabase } from '../lib/supabaseClient';
import { exportSkillAssessmentReport } from '../lib/exportService';
import { useCycle } from '../context/CycleContext';
import type { FormStatus } from '../types';

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  designation: string;
  grade: string;
  employee_number: string;
  manager_id: string | null;
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

// ─── Change Manager Modal ─────────────────────────────────────────────────────

interface ManagerOption { id: string; full_name: string; email: string; }

interface ChangeManagerModalProps {
  employee: EmployeeRow;
  onClose: () => void;
  onChanged: (employeeId: string, newManagerId: string | null, newManagerName: string) => void;
}

function ChangeManagerModal({ employee, onClose, onChanged }: ChangeManagerModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ManagerOption[]>([]);
  const [searched, setSearched] = useState(false); // true after first completed search
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ManagerOption | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True when user has typed enough and got zero DB results (and hasn't selected anyone)
  const showManualEmail = !selected && searched && results.length === 0 && query.trim().length > 1;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email')
        .ilike('full_name', `%${query.trim()}%`)
        .eq('is_active', true)
        .limit(10);
      setResults(data ?? []);
      setSearched(true);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  function clearSelection() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearched(false);
    setManualEmail('');
  }

  const canSave = selected
    ? true
    : showManualEmail && query.trim().length > 1 && manualEmail.trim().includes('@');

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    if (selected) {
      // DB user selected — link by ID
      await supabase.from('users').update({ manager_id: selected.id }).eq('id', employee.id);
      if (employee.form_id) {
        await supabase.from('skill_forms').update({ manager_id: selected.id }).eq('id', employee.form_id);
      }
      onChanged(employee.id, selected.id, selected.full_name);
    } else {
      // Manual entry — store name + email on the form only; no user row to link
      await supabase.from('users').update({ manager_id: null }).eq('id', employee.id);
      if (employee.form_id) {
        await supabase.from('skill_forms').update({ manager_id: null }).eq('id', employee.form_id);
      }
      onChanged(employee.id, null, query.trim());
    }

    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onClose} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-4">
          <UserCog size={22} className="text-sky-500" />
        </div>
        <h3 className="font-heading font-bold text-gray-900 text-lg mb-0.5">Change Manager</h3>
        <p className="text-sm text-gray-500 font-body mb-1">
          Employee: <span className="font-semibold text-gray-700">{employee.full_name}</span>
        </p>
        <p className="text-sm text-gray-500 font-body mb-5">
          Current manager: <span className="font-semibold text-gray-700">{employee.manager_name || '—'}</span>
        </p>

        {/* Name search */}
        <div className="relative mb-2">
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all bg-white
            ${selected ? 'border-sky-300 ring-1 ring-sky-100' : 'border-gray-200 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100'}`}>
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={selected ? selected.full_name : query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); setManualEmail(''); }}
              placeholder="Search by name…"
              className="flex-1 bg-transparent text-sm font-body text-gray-800 placeholder-gray-400 outline-none"
              autoFocus
              readOnly={!!selected}
            />
            {searching && <Loader2 size={13} className="text-gray-400 animate-spin shrink-0" />}
            {(selected || query) && !searching && (
              <button type="button" onClick={clearSelection} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Dropdown — DB matches */}
          {results.length > 0 && !selected && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={() => { setSelected(m); setResults([]); setManualEmail(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <span className="text-primary-600 text-[10px] font-bold font-heading">
                      {m.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold font-heading text-gray-800 truncate">{m.full_name}</p>
                    <p className="text-xs text-gray-400 font-body truncate">{m.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected DB user confirmation */}
        {selected && (
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-sky-50 border border-sky-100 mb-4">
            <CheckCircle2 size={15} className="text-sky-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold font-heading text-sky-800 truncate">{selected.full_name}</p>
              <p className="text-xs text-sky-600 font-body truncate">{selected.email}</p>
            </div>
          </div>
        )}

        {/* No match found — ask for email */}
        {showManualEmail && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-amber-600 font-body bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
              No user found with that name. Enter their email to save manually.
            </p>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100 transition-all bg-white">
              <span className="text-xs text-gray-400 font-body shrink-0">@</span>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="manager@company.com"
                className="flex-1 bg-transparent text-sm font-body text-gray-800 placeholder-gray-400 outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-semibold font-heading transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
            {saving ? 'Saving…' : 'Assign Manager'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TmgDashboardPage() {
  const navigate = useNavigate();
  const { activeCycle, allCycles } = useCycle();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycleId, setSelectedCycleId] = useState<string | 'current'>('current');
  const [snapshotRows, setSnapshotRows] = useState<EmployeeRow[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [changingManagerFor, setChangingManagerFor] = useState<EmployeeRow | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  async function handleDownloadReport(formId: string) {
    setDownloadingId(formId);
    try {
      await exportSkillAssessmentReport(formId);
    } catch (err) {
      showToast('Failed to generate report. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    async function load() {
      const { data: employees } = await supabase
        .from('users')
        .select('id, full_name, email, designation, grade, employee_number, manager_id')
        .eq('role', 'employee')
        .order('full_name');

      if (!employees) { setLoading(false); return; }

      const empIds = employees.map((e) => e.id);

      // Filter forms by active cycle so we only show current-cycle statuses.
      // If no active cycle exists, fall back to showing all forms.
      let formsQuery = supabase
        .from('skill_forms')
        .select('id, employee_id, status, updated_at, manager_id, cycle_id')
        .in('employee_id', empIds);

      if (activeCycle) {
        formsQuery = formsQuery.eq('cycle_id', activeCycle.id);
      }

      const { data: forms } = await formsQuery;

      const formMap: Record<string, { id: string; status: FormStatus; updated_at: string; manager_id: string | null }> = {};
      if (forms) forms.forEach((f) => { formMap[f.employee_id] = { id: f.id, status: f.status as FormStatus, updated_at: f.updated_at, manager_id: f.manager_id ?? null }; });

      // Collect all unique manager IDs from both users.manager_id and skill_forms.manager_id
      const allManagerIds = [...new Set([
        ...employees.map((e) => e.manager_id),
        ...Object.values(formMap).map((f) => f.manager_id),
      ].filter((id): id is string => !!id))];

      let managersMap: Record<string, string> = {};
      if (allManagerIds.length > 0) {
        const { data: managers } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', allManagerIds);
        if (managers) managersMap = Object.fromEntries(managers.map((m) => [m.id, m.full_name]));
      }

      setRows(
        employees.map((e) => {
          const form = formMap[e.id];
          // skill_forms.manager_id is the authoritative source (set by TMG/manager flows)
          // Fall back to users.manager_id if form has none
          const effectiveManagerId = form?.manager_id ?? e.manager_id ?? null;
          return {
            id: e.id,
            full_name: e.full_name,
            email: e.email,
            designation: e.designation || '—',
            grade: e.grade || '—',
            employee_number: e.employee_number || '—',
            manager_id: effectiveManagerId,
            manager_name: effectiveManagerId ? (managersMap[effectiveManagerId] || '—') : '—',
            form_id: form?.id ?? null,
            form_status: form?.status ?? null,
            form_updated_at: form?.updated_at ?? null,
          };
        })
      );
      setLoading(false);
    }
    load();
  }, [activeCycle]);

  useEffect(() => {
    if (selectedCycleId === 'current') {
      setSnapshotRows([]);
      return;
    }
    async function loadSnapshot() {
      setLoadingSnapshot(true);
      const { data: versions } = await supabase
        .from('skill_form_versions')
        .select('employee_id, form_id, snapshot, approved_at')
        .eq('cycle_id', selectedCycleId);

      if (!versions || versions.length === 0) {
        setSnapshotRows([]);
        setLoadingSnapshot(false);
        return;
      }

      const empIds = versions.map((v) => v.employee_id);
      const { data: employees } = await supabase
        .from('users')
        .select('id, full_name, email, designation, grade, employee_number, manager_id')
        .in('id', empIds);

      const empMap = Object.fromEntries((employees ?? []).map((e) => [e.id, e]));

      const built: EmployeeRow[] = versions.map((v) => {
        const emp = empMap[v.employee_id];
        const snap = v.snapshot as Record<string, unknown>;
        return {
          id: v.employee_id,
          full_name: emp?.full_name ?? (snap.employee_name as string) ?? '—',
          email: emp?.email ?? (snap.employee_email as string) ?? '—',
          designation: emp?.designation ?? (snap.designation as string) ?? '—',
          grade: emp?.grade ?? (snap.grade as string) ?? '—',
          employee_number: emp?.employee_number ?? (snap.employee_number as string) ?? '—',
          manager_id: null,
          manager_name: '—',
          form_id: v.form_id,
          form_status: 'approved' as FormStatus,
          form_updated_at: v.approved_at,
        };
      });

      setSnapshotRows(built);
      setLoadingSnapshot(false);
    }
    loadSnapshot();
  }, [selectedCycleId]);

  const isViewingHistory = selectedCycleId !== 'current';
  const displayRows = isViewingHistory ? snapshotRows : rows;
  const displayLoading = isViewingHistory ? loadingSnapshot : loading;

  const grades = useMemo(() => ['all', ...Array.from(new Set(displayRows.map((r) => r.grade).filter((g) => g !== '—'))).sort()], [displayRows]);
  const managers = useMemo(() => ['all', ...Array.from(new Set(displayRows.map((r) => r.manager_name).filter((m) => m !== '—'))).sort()], [displayRows]);

  const filtered = useMemo(() => {
    return displayRows.filter((r) => {
      const q = search.toLowerCase();
      if (q && !r.full_name.toLowerCase().includes(q) && !r.employee_number.toLowerCase().includes(q)) return false;
      if (gradeFilter !== 'all' && r.grade !== gradeFilter) return false;
      if (managerFilter !== 'all' && r.manager_name !== managerFilter) return false;
      if (statusFilter === 'not_started' && r.form_status !== null) return false;
      if (statusFilter !== 'all' && statusFilter !== 'not_started' && r.form_status !== statusFilter) return false;
      return true;
    });
  }, [displayRows, search, statusFilter, gradeFilter, managerFilter]);

  const stats = useMemo(() => ({
    total: displayRows.length,
    approved: displayRows.filter((r) => r.form_status === 'approved').length,
    pending: displayRows.filter((r) => r.form_status === 'pending_review').length,
    notStarted: displayRows.filter((r) => r.form_status === null).length,
  }), [displayRows]);

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

  const incompleteCount = rows.filter((r) => r.form_status !== 'approved').length; // always from live data

  return (
    <>
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-heading font-bold text-2xl text-gray-900">TMG Overview</h1>
              <p className="text-sm text-gray-500 font-body mt-0.5">Monitor skill profile submissions across all employees.</p>
            </div>
            <div className="flex items-center gap-3">
              <CycleSelectorDropdown
                cycles={allCycles}
                activeCycle={activeCycle}
                selectedId={selectedCycleId}
                onChange={setSelectedCycleId}
              />
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
              >
                <Download size={15} />
                Export to Excel
              </button>
            </div>
          </div>

          {isViewingHistory && (
            <div className="flex items-center gap-3 px-5 py-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-sm text-sky-800">
              <CheckCircle2 size={15} className="text-sky-500 shrink-0" />
              <p>
                Viewing archived assessments from{' '}
                <span className="font-semibold">
                  {allCycles.find((c) => c.id === selectedCycleId)?.name ?? 'a previous cycle'}
                </span>
                {' '}&mdash; read-only snapshot. {snapshotRows.length === 0 && !loadingSnapshot ? 'No approved assessments found for this cycle.' : ''}
              </p>
            </div>
          )}

          {!activeCycle ? (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-800 text-sm font-body">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold font-heading">No active review cycle</p>
                <p className="text-xs mt-0.5">
                  Go to <button onClick={() => navigate('/cycles')} className="underline font-semibold hover:text-amber-900 transition-colors">Cycles</button> to create and trigger a new assessment cycle.
                </p>
              </div>
            </div>
          ) : incompleteCount > 0 ? (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-red-200 bg-red-50 text-red-800 text-sm font-body">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold font-heading">
                  {incompleteCount} incomplete assessment{incompleteCount !== 1 ? 's' : ''} — current cycle: {activeCycle.name}
                </p>
                <p className="text-xs mt-0.5">
                  These employees have not yet had their assessments approved. A new cycle cannot be started until all assessments are complete.
                </p>
              </div>
              <button
                onClick={() => navigate('/cycles')}
                className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl border border-red-300 bg-red-100 hover:bg-red-200 text-xs font-semibold font-heading transition-colors"
              >
                <RefreshCw size={12} />
                View Cycles
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-body">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold font-heading">Active cycle: {activeCycle.name}</p>
                <p className="text-xs mt-0.5">All assessments approved. Cycle can be closed when ready.</p>
              </div>
              <button
                onClick={() => navigate('/cycles')}
                className="flex items-center gap-1.5 shrink-0 ml-auto px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-100 hover:bg-emerald-200 text-xs font-semibold font-heading transition-colors"
              >
                <RefreshCw size={12} />
                Manage
              </button>
            </div>
          )}

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
                {filtered.length} of {displayRows.length} employees
              </span>
            </div>

            {displayLoading ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody><SkeletonTableRows rows={6} cols={6} /></tbody>
                </table>
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
                              {row.form_status === 'approved' && row.form_id && (
                                <button
                                  onClick={() => handleDownloadReport(row.form_id!)}
                                  disabled={downloadingId === row.form_id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold font-heading text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                  {downloadingId === row.form_id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Download size={12} />
                                  )}
                                  {downloadingId === row.form_id ? 'Generating…' : 'Download'}
                                </button>
                              )}
                              {row.form_id && (
                                <button
                                  onClick={() => navigate(`/inbox/review/${row.form_id}`)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                  <Eye size={12} />
                                  View
                                </button>
                              )}
                              {!isViewingHistory && (
                                <>
                                  <button
                                    onClick={() => setChangingManagerFor(row)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-xs font-semibold font-heading text-sky-600 hover:bg-sky-100 transition-colors"
                                  >
                                    <UserCog size={12} />
                                    Change Manager
                                  </button>
                                  <button
                                    onClick={() => navigate(`/admin?edit=${row.id}`)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors"
                                  >
                                    <Pencil size={12} />
                                    Edit
                                  </button>
                                </>
                              )}
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

      {changingManagerFor && (
        <ChangeManagerModal
          employee={changingManagerFor}
          onClose={() => setChangingManagerFor(null)}
          onChanged={(empId, newMgrId, newMgrName) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === empId
                  ? { ...r, manager_id: newMgrId, manager_name: newMgrName || '—' }
                  : r
              )
            );
            showToast(`Manager updated to ${newMgrName}`);
          }}
        />
      )}

      <Toast message={toastMsg} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </>
  );
}
