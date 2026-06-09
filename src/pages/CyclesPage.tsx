import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Calendar, CheckCircle2, Clock, AlertTriangle, ChevronDown, Loader2, X,
  Play, Lock, RotateCcw, Users, FileX, TrendingUp, CreditCard as Edit2,
  Trash2, PauseCircle, Ban,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { supabase } from '../lib/db';
import { callEdgeFn } from '../lib/edgeFunctions';
import { useCycle } from '../context/CycleContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { ReviewCycle, CycleType, FormStatus } from '../types';
import { CYCLE_TYPE_LABELS, CYCLE_STATUS_CONFIG } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function deadlineColor(days: number | null): string {
  if (days === null) return 'text-gray-400';
  if (days < 0) return 'text-red-600 font-semibold';
  if (days <= 3) return 'text-red-500 font-semibold';
  if (days <= 7) return 'text-amber-600 font-semibold';
  return 'text-emerald-600';
}

function deadlineLabel(days: number | null): string {
  if (days === null) return 'No deadline';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CycleProgress {
  total: number;
  draft: number;
  pending_review: number;
  returned: number;
  approved: number;
  not_started: number;
}

interface CycleWithProgress extends ReviewCycle {
  progress: CycleProgress;
  blockers: number;
}

interface EmployeeRow {
  id: string;
  full_name: string;
  email: string;
  designation: string;
  form_status: FormStatus | null;
  form_id: string | null;
  cycle_id: string | null;
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: CycleProgress }) {
  const total = progress.total || 1;
  const approvedPct = (progress.approved / total) * 100;
  const pendingPct = (progress.pending_review / total) * 100;
  const returnedPct = (progress.returned / total) * 100;
  const draftPct = (progress.draft / total) * 100;
  const notStartedPct = (progress.not_started / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
        <div style={{ width: `${approvedPct}%` }} className="bg-emerald-500 transition-all duration-700" />
        <div style={{ width: `${pendingPct}%` }} className="bg-amber-400 transition-all duration-700" />
        <div style={{ width: `${returnedPct}%` }} className="bg-orange-400 transition-all duration-700" />
        <div style={{ width: `${draftPct}%` }} className="bg-sky-300 transition-all duration-700" />
        <div style={{ width: `${notStartedPct}%` }} className="bg-gray-200 transition-all duration-700" />
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[10px] font-body text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{progress.approved} Approved</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{progress.pending_review} Pending</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />{progress.returned} Returned</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-300 inline-block" />{progress.draft} Draft</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />{progress.not_started} Not Started</span>
      </div>
    </div>
  );
}

// ─── Create / Edit Cycle Modal ───────────────────────────────────────────────

interface CycleModalProps {
  initial: Partial<ReviewCycle> | null;
  onClose: () => void;
  onSaved: () => void;
}

function CycleModal({ initial, onClose, onSaved }: CycleModalProps) {
  const { user } = useAuth();
  const { toast: showToast } = useToast();
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? '');
  const [cycleType, setCycleType] = useState<CycleType>(initial?.cycle_type ?? 'custom');
  const [employeeDeadline, setEmployeeDeadline] = useState(
    initial?.employee_deadline ? initial.employee_deadline.slice(0, 16) : ''
  );
  const [managerDeadline, setManagerDeadline] = useState(
    initial?.manager_deadline ? initial.manager_deadline.slice(0, 16) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Cycle name is required';
    if (!employeeDeadline) e.employeeDeadline = 'Employee deadline is required';
    if (!managerDeadline) e.managerDeadline = 'Manager deadline is required';
    if (employeeDeadline && managerDeadline && new Date(managerDeadline) <= new Date(employeeDeadline)) {
      e.managerDeadline = 'Manager deadline must be after employee deadline';
    }
    return e;
  }

  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setSaving(true);
    const payload = {
      name: name.trim(),
      cycle_type: cycleType,
      employee_deadline: employeeDeadline ? new Date(employeeDeadline).toISOString() : null,
      manager_deadline: managerDeadline ? new Date(managerDeadline).toISOString() : null,
      notes: notes.trim(),
      ...(!isEdit ? { created_by: user?.id } : {}),
    };

    const { error } = isEdit
      ? await supabase.from('review_cycles').update(payload).eq('id', initial!.id!)
      : await supabase.from('review_cycles').insert(payload);

    setSaving(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(isEdit ? 'Cycle updated.' : 'Cycle created.', 'success');
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-[fadeUp_0.2s_ease]">
        <button onClick={onClose} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>

        <div>
          <h2 className="font-heading font-bold text-lg text-gray-900">
            {isEdit ? 'Edit Cycle' : 'Create Review Cycle'}
          </h2>
          <p className="text-xs text-gray-400 font-body mt-0.5">
            {isEdit ? 'Update cycle details and deadlines.' : 'Define a new assessment cycle. Employees and managers will be notified when activated.'}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold font-heading text-gray-600 mb-1.5">Cycle Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mid Year 2026"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 placeholder-gray-400 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold font-heading text-gray-600 mb-1.5">Cycle Type</label>
            <div className="relative">
              <select
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value as CycleType)}
                className="w-full appearance-none px-3.5 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 bg-white outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all cursor-pointer"
              >
                {(Object.entries(CYCLE_TYPE_LABELS) as [CycleType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold font-heading text-gray-600 mb-1.5">Employee Deadline</label>
              <input
                type="datetime-local"
                value={employeeDeadline}
                onChange={(e) => setEmployeeDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all"
              />
              {errors.employeeDeadline && <p className="text-xs text-red-500 mt-1">{errors.employeeDeadline}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold font-heading text-gray-600 mb-1.5">Manager Deadline</label>
              <input
                type="datetime-local"
                value={managerDeadline}
                onChange={(e) => setManagerDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all"
              />
              {errors.managerDeadline && <p className="text-xs text-red-500 mt-1">{errors.managerDeadline}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold font-heading text-gray-600 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional context for this cycle…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-800 placeholder-gray-400 resize-none outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold font-heading transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ cycle, onConfirm, onCancel, deleting }: {
  cycle: ReviewCycle;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <button onClick={onCancel} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X size={15} />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <div>
          <h3 className="font-heading font-bold text-gray-900 text-lg">Delete "{cycle.name}"?</h3>
          <p className="text-sm text-gray-500 font-body mt-2 leading-relaxed">
            This draft cycle will be permanently deleted. This action cannot be undone.
          </p>
        </div>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} disabled={deleting} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold font-heading transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Suspend Modal ────────────────────────────────────────────────────────────

function SuspendModal({ cycle, onConfirm, onCancel, suspending }: {
  cycle: ReviewCycle;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  suspending: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <button onClick={onCancel} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X size={15} />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <PauseCircle size={22} className="text-red-500" />
        </div>

        <div>
          <h3 className="font-heading font-bold text-gray-900 text-lg">Suspend "{cycle.name}"?</h3>
          <p className="text-sm text-gray-500 font-body mt-2 leading-relaxed">
            Suspending this cycle will permanently purge all employee form data created during this cycle.
            This action <span className="font-semibold text-red-600">cannot be undone</span>.
          </p>
          <div className="mt-3 flex items-start gap-2.5 px-3.5 py-3 bg-red-50 rounded-xl border border-red-100">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-body">
              All employee assessments in progress for this cycle will be deleted. The cycle will be hidden from all views except this admin page.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold font-heading text-gray-700 mb-1.5">
            Suspension Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this cycle is being suspended (e.g. organisational changes, incorrect setup)…"
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm font-body text-gray-800 placeholder-gray-400 resize-none outline-none hover:border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-colors"
            autoFocus
          />
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} disabled={suspending} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={suspending || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold font-heading transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {suspending ? <Loader2 size={14} className="animate-spin" /> : <PauseCircle size={14} />}
            {suspending ? 'Suspending…' : 'Suspend Cycle'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Activate Confirm Modal ───────────────────────────────────────────────────

interface ActivateModalProps {
  cycle: ReviewCycle;
  blockerCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  activating: boolean;
}

function ActivateModal({ cycle, blockerCount, onConfirm, onCancel, activating }: ActivateModalProps) {
  const hasBlockers = blockerCount > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <button onClick={onCancel} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <X size={15} />
        </button>

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${hasBlockers ? 'bg-red-50' : 'bg-emerald-50'}`}>
          {hasBlockers ? <AlertTriangle size={22} className="text-red-500" /> : <Play size={22} className="text-emerald-500" />}
        </div>

        <div>
          <h3 className="font-heading font-bold text-gray-900 text-lg">
            {hasBlockers ? 'Cannot Activate Cycle' : `Activate "${cycle.name}"?`}
          </h3>
          {hasBlockers ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-gray-600 font-body">
                There are <span className="font-semibold text-red-600">{blockerCount} incomplete assessment{blockerCount !== 1 ? 's' : ''}</span> from the previous cycle that must be approved before starting a new cycle.
              </p>
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 rounded-xl border border-red-100">
                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-body">
                  All employees must have an approved assessment before a new cycle can begin.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 font-body mt-2 leading-relaxed">
              This will activate the cycle and make forms available to all employees. Employee deadline: <strong>{formatDate(cycle.employee_deadline)}</strong>. Manager deadline: <strong>{formatDate(cycle.manager_deadline)}</strong>.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors">
            {hasBlockers ? 'Understood' : 'Cancel'}
          </button>
          {!hasBlockers && (
            <button
              onClick={onConfirm}
              disabled={activating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold font-heading transition-all disabled:opacity-50"
            >
              {activating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {activating ? 'Activating…' : 'Activate Cycle'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Defaulters Drawer ────────────────────────────────────────────────────────

interface DefaultersDrawerProps {
  cycle: ReviewCycle;
  type: 'employee' | 'manager';
  employees: EmployeeRow[];
  onClose: () => void;
}

function DefaultersDrawer({ cycle, type, employees, onClose }: DefaultersDrawerProps) {
  const overdue = employees.filter((e) => {
    const deadline = type === 'employee' ? cycle.employee_deadline : cycle.manager_deadline;
    if (!deadline || new Date(deadline) > new Date()) return false;
    if (type === 'employee') return !e.form_status || e.form_status === 'draft' || e.form_status === 'returned';
    return e.form_status === 'pending_review';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:w-96 h-full sm:h-auto sm:max-h-[80vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-heading font-bold text-gray-900">
              {type === 'employee' ? 'Employee Defaulters' : 'Manager Defaulters'}
            </h3>
            <p className="text-xs text-gray-400 font-body mt-0.5">{cycle.name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>

        {overdue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <CheckCircle2 size={28} className="text-emerald-300 mb-3" />
            <p className="font-heading font-semibold text-gray-600 text-sm">No defaulters</p>
            <p className="text-xs text-gray-400 font-body mt-1">Everyone is on track.</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 divide-y divide-gray-50 p-2">
            {overdue.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50/60 transition-colors">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <span className="text-red-600 text-[11px] font-bold font-heading">
                    {e.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-heading text-gray-800 truncate">{e.full_name}</p>
                  <p className="text-xs text-gray-400 font-body truncate">{e.email}</p>
                </div>
                <span className="text-[10px] font-semibold font-heading px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">
                  {e.form_status ? e.form_status.replace('_', ' ') : 'Not started'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400 font-body text-center">{overdue.length} overdue</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CyclesPage() {
  const { adminCycles, activeCycle, loading, refresh } = useCycle();
  const { user } = useAuth();
  const { toast: showToast } = useToast();

  const [cyclesWithProgress, setCyclesWithProgress] = useState<CycleWithProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState<ReviewCycle | null>(null);
  const [activatingCycle, setActivatingCycle] = useState<CycleWithProgress | null>(null);
  const [activating, setActivating] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [deletingCycle, setDeletingCycle] = useState<ReviewCycle | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [suspendingCycle, setSuspendingCycle] = useState<ReviewCycle | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [defaultersDrawer, setDefaultersDrawer] = useState<{ cycle: ReviewCycle; type: 'employee' | 'manager' } | null>(null);
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

  const loadProgress = useCallback(async (cycles: typeof adminCycles) => {
    if (cycles.length === 0) {
      setCyclesWithProgress([]);
      setEmployees([]);
      setProgressLoading(false);
      return;
    }

    setProgressLoading(true);

    // Single query: all employees
    const { data: empData } = await supabase
      .from('users')
      .select('id, full_name, email, designation')
      .eq('role', 'employee')
      .eq('is_active', true);

    const empList = empData ?? [];
    const totalEmployees = empList.length;

    // Fetch forms for all relevant cycle ids in one shot
    const cycleIds = cycles.map((c) => c.id);
    const { data: formsData } = await supabase
      .from('skill_forms')
      .select('id, employee_id, status, cycle_id')
      .in('cycle_id', cycleIds);

    const allForms = formsData ?? [];

    // Build per-cycle form lookup: cycleId → { employeeId → form }
    const formsByCycle: Record<string, Record<string, { id: string; status: FormStatus }>> = {};
    for (const f of allForms) {
      if (!f.cycle_id) continue;
      if (!formsByCycle[f.cycle_id]) formsByCycle[f.cycle_id] = {};
      formsByCycle[f.cycle_id][f.employee_id] = { id: f.id, status: f.status as FormStatus };
    }

    // Build employee rows keyed to the active cycle (for defaulters drawer)
    const activeCycleId = cycles.find((c) => c.status === 'active')?.id ?? null;
    const activeCycleForms = activeCycleId ? (formsByCycle[activeCycleId] ?? {}) : {};
    const empRows: EmployeeRow[] = empList.map((e) => ({
      id: e.id,
      full_name: e.full_name,
      email: e.email,
      designation: e.designation ?? '',
      form_status: activeCycleForms[e.id]?.status ?? null,
      form_id: activeCycleForms[e.id]?.id ?? null,
      cycle_id: activeCycleId,
    }));
    setEmployees(empRows);

    const withProgress = cycles.map((cycle) => {
      const cycleForms = formsByCycle[cycle.id] ?? {};
      const employeesWithForm = Object.values(cycleForms);

      const approved = employeesWithForm.filter((f) => f.status === 'approved').length;
      const pending_review = employeesWithForm.filter((f) => f.status === 'pending_review').length;
      const returned = employeesWithForm.filter((f) => f.status === 'returned').length;
      const draft = employeesWithForm.filter((f) => f.status === 'draft').length;
      const not_started = totalEmployees - employeesWithForm.length;

      const progress: CycleProgress = {
        total: totalEmployees,
        approved,
        pending_review,
        returned,
        draft,
        not_started: Math.max(0, not_started),
      };

      const blockers = cycle.status === 'active'
        ? totalEmployees - approved
        : 0;

      return { ...cycle, progress, blockers };
    });

    setCyclesWithProgress(withProgress);
    setProgressLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) loadProgress(adminCycles);
  }, [loading, adminCycles, loadProgress]);

  async function handleActivate(cycle: CycleWithProgress) {
    setActivating(true);
    const { error } = await callEdgeFn('activate-cycle', { cycle_id: cycle.id });
    if (error) {
      showToast(error, 'error');
    } else {
      showToast(`Cycle "${cycle.name}" is now active. All employee forms reset to draft.`, 'success');
      await refresh();
    }
    setActivating(false);
    setActivatingCycle(null);
  }

  async function handleClose(cycle: ReviewCycle) {
    setClosingId(cycle.id);
    const { error } = await supabase
      .from('review_cycles')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', cycle.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Cycle "${cycle.name}" closed.`, 'success');
      await refresh();
    }
    setClosingId(null);
  }

  async function handleDelete(cycle: ReviewCycle) {
    setDeleting(true);
    const { error } = await supabase
      .from('review_cycles')
      .delete()
      .eq('id', cycle.id)
      .eq('status', 'draft');

    setDeleting(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Cycle "${cycle.name}" deleted.`, 'success');
      setDeletingCycle(null);
      await refresh();
    }
  }

  async function handleSuspend(cycle: ReviewCycle, reason: string) {
    setSuspending(true);
    const { error } = await callEdgeFn('suspend-cycle', {
      cycle_id: cycle.id,
      reason: reason.trim(),
      user_id: user!.id,
    });

    setSuspending(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast(`Cycle "${cycle.name}" has been suspended and all associated records purged.`, 'success');
      setSuspendingCycle(null);
      await refresh();
    }
  }

  const incompleteInActiveCycle = activeCycle
    ? employees.filter((e) =>
        e.cycle_id === activeCycle.id ? e.form_status !== 'approved' : true
      ).length
    : 0;

  const suspendedCycles = cyclesWithProgress.filter((c) => c.status === 'suspended');
  const nonSuspendedCycles = cyclesWithProgress.filter((c) => c.status !== 'suspended');

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Review Cycles</h1>
            <p className="text-sm text-gray-500 font-body mt-0.5">
              Manage assessment cycles, timelines, and track completion progress.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold font-heading transition-all shadow-sm"
          >
            <Plus size={15} />
            New Cycle
          </button>
        </div>

        {/* Active cycle banner */}
        {activeCycle && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-heading font-bold text-emerald-800 text-base">{activeCycle.name}</p>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-700 text-[10px] font-bold font-heading tracking-wider uppercase">Active</span>
              </div>
              <div className="flex items-center gap-5 mt-1.5 flex-wrap text-xs text-emerald-700 font-body">
                <span className="flex items-center gap-1.5">
                  <Users size={11} />
                  Employee deadline: <strong>{formatDate(activeCycle.employee_deadline)}</strong>
                  <span className={`ml-1 ${deadlineColor(daysUntil(activeCycle.employee_deadline))}`}>
                    ({deadlineLabel(daysUntil(activeCycle.employee_deadline))})
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={11} />
                  Manager deadline: <strong>{formatDate(activeCycle.manager_deadline)}</strong>
                  <span className={`ml-1 ${deadlineColor(daysUntil(activeCycle.manager_deadline))}`}>
                    ({deadlineLabel(daysUntil(activeCycle.manager_deadline))})
                  </span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSuspendingCycle(activeCycle)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold font-heading transition-colors"
              >
                <PauseCircle size={12} />
                Suspend
              </button>
              <button
                onClick={() => handleClose(activeCycle)}
                disabled={closingId === activeCycle.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold font-heading transition-colors disabled:opacity-50"
              >
                {closingId === activeCycle.id ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                Close Cycle
              </button>
            </div>
          </div>
        )}

        {/* Incomplete forms warning */}
        {activeCycle && incompleteInActiveCycle > 0 && (
          <div className="flex items-start gap-3 px-5 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold font-heading text-amber-800">
                {incompleteInActiveCycle} incomplete assessment{incompleteInActiveCycle !== 1 ? 's' : ''} in current cycle
              </p>
              <p className="text-xs text-amber-700 font-body mt-0.5">
                All assessments must be approved before you can start a new cycle.
              </p>
            </div>
          </div>
        )}

        {/* Active + closed + draft cycles */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Calendar size={16} className="text-primary-500" />
            <h2 className="font-heading font-semibold text-base text-gray-900">All Cycles</h2>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold font-heading">{nonSuspendedCycles.length}</span>
          </div>

          {loading || progressLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-primary-300" />
            </div>
          ) : nonSuspendedCycles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Calendar size={28} className="text-gray-200 mb-3" />
              <p className="font-heading font-semibold text-gray-500 text-sm">No cycles yet</p>
              <p className="text-xs text-gray-400 font-body mt-1">Create your first review cycle to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {nonSuspendedCycles.map((cycle) => {
                const statusCfg = CYCLE_STATUS_CONFIG[cycle.status];
                const empDays = daysUntil(cycle.employee_deadline);
                const mgrDays = daysUntil(cycle.manager_deadline);
                const isExpanded = expandedCycle === cycle.id;
                const completionPct = cycle.progress.total > 0
                  ? Math.round((cycle.progress.approved / cycle.progress.total) * 100)
                  : 0;

                return (
                  <div key={cycle.id} className="transition-colors">
                    <div
                      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 cursor-pointer"
                      onClick={() => setExpandedCycle(isExpanded ? null : cycle.id)}
                    >
                      {/* Status dot */}
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        cycle.status === 'active' ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' :
                        cycle.status === 'closed' ? 'bg-gray-300' : 'bg-amber-400'
                      }`} />

                      {/* Name + type */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-heading font-semibold text-gray-900 text-sm truncate">{cycle.name}</p>
                          <span className={`text-[10px] font-semibold font-heading px-2 py-0.5 rounded-full ${statusCfg.badgeClass}`}>
                            {statusCfg.label}
                          </span>
                          <span className="text-[10px] text-gray-400 font-body">
                            {CYCLE_TYPE_LABELS[cycle.cycle_type]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-0.5 text-[11px] text-gray-400 font-body flex-wrap">
                          <span>Created {formatDate(cycle.created_at)}</span>
                          {cycle.triggered_at && <span>Activated {formatDatetime(cycle.triggered_at)}</span>}
                          {cycle.closed_at && <span>Closed {formatDate(cycle.closed_at)}</span>}
                        </div>
                      </div>

                      {/* Completion */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold font-heading ${
                          completionPct === 100 ? 'text-emerald-600' : completionPct >= 50 ? 'text-amber-600' : 'text-gray-400'
                        }`}>{completionPct}%</span>
                        <span className="text-xs text-gray-400 font-body">approved</span>
                      </div>

                      {/* Deadlines */}
                      <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 text-[11px] font-body">
                        <span className={cycle.status === 'active' ? deadlineColor(empDays) : 'text-gray-400'}>
                          Emp: {formatDate(cycle.employee_deadline)}
                        </span>
                        <span className={cycle.status === 'active' ? deadlineColor(mgrDays) : 'text-gray-400'}>
                          Mgr: {formatDate(cycle.manager_deadline)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Edit (draft only — not active, not closed) */}
                        {cycle.status === 'draft' && (
                          <button
                            onClick={() => setEditingCycle(cycle)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Edit cycle"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}

                        {/* Delete (draft only) */}
                        {cycle.status === 'draft' && (
                          <button
                            onClick={() => setDeletingCycle(cycle)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete cycle"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}

                        {/* Activate draft cycle */}
                        {cycle.status === 'draft' && !activeCycle && (
                          <button
                            onClick={() => setActivatingCycle(cycle)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold font-heading transition-colors"
                          >
                            <Play size={11} />
                            Activate
                          </button>
                        )}

                        {cycle.status === 'draft' && activeCycle && (
                          <span className="text-[10px] text-gray-400 font-body">Another cycle active</span>
                        )}

                        {/* Defaulters for active */}
                        {cycle.status === 'active' && (
                          <>
                            <button
                              onClick={() => setDefaultersDrawer({ cycle, type: 'employee' })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold font-heading transition-colors hover:bg-amber-100"
                            >
                              <Users size={11} />
                              Emp Defaulters
                            </button>
                            <button
                              onClick={() => setDefaultersDrawer({ cycle, type: 'manager' })}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold font-heading transition-colors hover:bg-sky-100"
                            >
                              <Clock size={11} />
                              Mgr Defaulters
                            </button>
                          </>
                        )}
                      </div>

                      <ChevronDown
                        size={14}
                        className={`text-gray-300 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 bg-gray-50/60 border-t border-gray-100 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Approved', value: cycle.progress.approved, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: CheckCircle2 },
                            { label: 'Pending Review', value: cycle.progress.pending_review, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: Clock },
                            { label: 'Returned', value: cycle.progress.returned, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', icon: RotateCcw },
                            { label: 'Draft / Not Started', value: cycle.progress.draft + cycle.progress.not_started, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: FileX },
                          ].map((s) => (
                            <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
                              <s.icon size={14} className={`${s.color} mb-1.5`} />
                              <p className={`font-heading font-bold text-xl ${s.color}`}>{s.value}</p>
                              <p className="text-[10px] text-gray-500 font-body">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        <ProgressBar progress={cycle.progress} />

                        {cycle.notes && (
                          <p className="text-xs text-gray-500 font-body italic">{cycle.notes}</p>
                        )}

                        <div className="flex flex-wrap gap-3 text-xs font-body text-gray-500">
                          <span>Employee deadline: <strong className={deadlineColor(daysUntil(cycle.employee_deadline))}>{formatDatetime(cycle.employee_deadline)}</strong></span>
                          <span>·</span>
                          <span>Manager deadline: <strong className={deadlineColor(daysUntil(cycle.manager_deadline))}>{formatDatetime(cycle.manager_deadline)}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Suspended cycles — admin view only */}
        {suspendedCycles.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2 bg-red-50/40">
              <Ban size={15} className="text-red-400" />
              <h2 className="font-heading font-semibold text-base text-red-700">Suspended Cycles</h2>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[11px] font-semibold font-heading">{suspendedCycles.length}</span>
              <span className="ml-auto text-[11px] text-red-400 font-body">Visible on this page only · Not shown in cycle selectors</span>
            </div>

            <div className="divide-y divide-red-50">
              {suspendedCycles.map((cycle) => (
                <div key={cycle.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-heading font-semibold text-gray-800 text-sm">{cycle.name}</p>
                        <span className="text-[10px] font-semibold font-heading px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Suspended
                        </span>
                        <span className="text-[10px] text-gray-400 font-body">{CYCLE_TYPE_LABELS[cycle.cycle_type]}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-0.5 text-[11px] text-gray-400 font-body flex-wrap">
                        <span>Created {formatDate(cycle.created_at)}</span>
                        {cycle.triggered_at && <span>Activated {formatDatetime(cycle.triggered_at)}</span>}
                        {cycle.suspended_at && <span className="text-red-500">Suspended {formatDatetime(cycle.suspended_at)}</span>}
                      </div>
                    </div>
                  </div>
                  {cycle.suspension_reason && (
                    <div className="ml-5 flex items-start gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                      <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold font-heading text-red-500 uppercase tracking-wide mb-0.5">Suspension Reason</p>
                        <p className="text-xs text-red-700 font-body leading-relaxed">{cycle.suspension_reason}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {(showCreateModal || editingCycle) && (
        <CycleModal
          initial={editingCycle}
          onClose={() => { setShowCreateModal(false); setEditingCycle(null); }}
          onSaved={() => { refresh(); }}
        />
      )}

      {activatingCycle && (
        <ActivateModal
          cycle={activatingCycle}
          blockerCount={incompleteInActiveCycle}
          onConfirm={() => handleActivate(activatingCycle)}
          onCancel={() => setActivatingCycle(null)}
          activating={activating}
        />
      )}

      {deletingCycle && (
        <DeleteModal
          cycle={deletingCycle}
          onConfirm={() => handleDelete(deletingCycle)}
          onCancel={() => setDeletingCycle(null)}
          deleting={deleting}
        />
      )}

      {suspendingCycle && (
        <SuspendModal
          cycle={suspendingCycle}
          onConfirm={(reason) => handleSuspend(suspendingCycle, reason)}
          onCancel={() => setSuspendingCycle(null)}
          suspending={suspending}
        />
      )}

      {defaultersDrawer && (
        <DefaultersDrawer
          cycle={defaultersDrawer.cycle}
          type={defaultersDrawer.type}
          employees={employees}
          onClose={() => setDefaultersDrawer(null)}
        />
      )}
    </AppShell>
  );
}
