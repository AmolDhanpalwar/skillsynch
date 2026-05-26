import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Inbox,
  Clock,
  CheckCircle2,
  RotateCcw,
  Eye,
  ClipboardList,
  Users,
  ChevronRight,
  Loader2,
  Download,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import Toast from '../components/form/Toast';
import { SkeletonListItem } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabaseClient';
import { exportSkillAssessmentReport } from '../lib/exportService';
import { useAuth } from '../context/AuthContext';
import type { FormStatus } from '../types';

interface TeamForm {
  id: string;
  status: FormStatus;
  submitted_at: string | null;
  updated_at: string;
  employee: {
    id: string;
    full_name: string;
    email: string;
    designation: string;
    grade: string;
  };
}

type FilterStatus = 'all' | 'pending_review' | 'approved' | 'returned';

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'returned', label: 'Returned' },
];

const STATUS_CONFIG: Record<
  FormStatus,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  draft: { label: 'Draft', badgeClass: 'bg-gray-100 text-gray-600', icon: ClipboardList },
  pending_review: { label: 'Pending Review', badgeClass: 'bg-amber-100 text-amber-700', icon: Clock },
  returned: { label: 'Returned', badgeClass: 'bg-red-100 text-red-700', icon: RotateCcw },
  approved: { label: 'Approved', badgeClass: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        <Inbox size={28} className="text-gray-300" />
      </div>
      <p className="font-heading font-semibold text-gray-700 text-base mb-1.5">
        {filtered ? 'No forms match this filter' : 'No pending reviews'}
      </p>
      <p className="text-sm text-gray-400 font-body max-w-xs leading-relaxed">
        {filtered
          ? 'Try selecting a different status filter to see more forms.'
          : 'When your team members submit their Skill Profiles, they will appear here for review.'}
      </p>
    </div>
  );
}

export default function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [forms, setForms] = useState<TeamForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const state = location.state as { toast?: string } | null;
    if (state?.toast) {
      setToastMsg(state.toast);
      setToastVisible(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('skill_forms')
        .select(
          'id, status, submitted_at, updated_at, users!skill_forms_employee_id_fkey(id, full_name, email, designation, grade)'
        )
        .eq('manager_id', user!.id)
        .order('updated_at', { ascending: false });

      if (data) {
        setForms(
          data.map((row) => {
            const emp = row.users as Record<string, unknown>;
            return {
              id: row.id,
              status: row.status as FormStatus,
              submitted_at: row.submitted_at,
              updated_at: row.updated_at,
              employee: {
                id: (emp?.id as string) || '',
                full_name: (emp?.full_name as string) || 'Unknown',
                email: (emp?.email as string) || '',
                designation: (emp?.designation as string) || '—',
                grade: (emp?.grade as string) || '—',
              },
            };
          })
        );
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const filtered = filter === 'all' ? forms : forms.filter((f) => f.status === filter);

  const pendingCount = forms.filter((f) => f.status === 'pending_review').length;
  const approvedCount = forms.filter((f) => f.status === 'approved').length;
  const returnedCount = forms.filter((f) => f.status === 'returned').length;

  async function handleDownloadReport(formId: string) {
    setDownloadingId(formId);
    try {
      await exportSkillAssessmentReport(formId);
    } catch (err) {
      setToastMsg('Failed to generate report. Please try again.');
      setToastVisible(true);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading font-bold text-2xl text-gray-900">Team Skill Reviews</h1>
              {pendingCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-xs font-bold font-heading min-w-[26px] text-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 font-body mt-0.5">
              Review and approve skill assessments submitted by your team.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-amber-50 rounded-xl border border-amber-100 px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <Clock size={16} className="text-amber-400" />
            </div>
            <p className="font-heading font-bold text-2xl text-amber-600">{pendingCount}</p>
            <p className="text-xs text-amber-700 font-body mt-0.5">Pending Review</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <RotateCcw size={16} className="text-red-400" />
            </div>
            <p className="font-heading font-bold text-2xl text-red-500">{returnedCount}</p>
            <p className="text-xs text-red-700 font-body mt-0.5">Returned</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="font-heading font-bold text-2xl text-emerald-600">{approvedCount}</p>
            <p className="text-xs text-emerald-700 font-body mt-0.5">Approved</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary-500" />
              <h2 className="font-heading font-semibold text-base text-gray-900">
                Team Submissions
              </h2>
              <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold font-heading">
                {forms.length}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-heading transition-all
                    ${filter === f.value
                      ? 'bg-white text-gray-800 shadow-sm shadow-gray-200/80'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {f.label}
                  {f.value === 'pending_review' && pendingCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonListItem key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState filtered={filter !== 'all'} />
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((form) => {
                const cfg = STATUS_CONFIG[form.status];
                const Icon = cfg.icon;
                const initials = getInitials(form.employee.full_name);
                const isPending = form.status === 'pending_review';
                return (
                  <div
                    key={form.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/inbox/review/${form.id}`)}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <span className="text-primary-600 text-xs font-bold font-heading">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 font-heading truncate">
                          {form.employee.full_name}
                        </p>
                        {isPending && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-body truncate">
                        {form.employee.designation}
                        {form.employee.grade !== '—' ? ` · ${form.employee.grade}` : ''}
                        {form.submitted_at ? ` · Submitted ${formatDate(form.submitted_at)}` : ` · Updated ${formatDate(form.updated_at)}`}
                      </p>
                    </div>

                    <span className={`flex items-center gap-1.5 text-xs font-semibold font-heading px-2.5 py-1 rounded-full shrink-0 ${cfg.badgeClass}`}>
                      <Icon size={11} />
                      {cfg.label}
                    </span>

                    {form.status === 'approved' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadReport(form.id); }}
                        disabled={downloadingId === form.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-semibold font-heading transition-all shrink-0 disabled:opacity-50"
                      >
                        {downloadingId === form.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Download size={12} />
                        )}
                        {downloadingId === form.id ? 'Generating…' : 'Download'}
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/inbox/review/${form.id}`); }}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold font-heading transition-all shrink-0
                        ${isPending
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200'
                          : 'border border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                      {isPending ? <ClipboardList size={12} /> : <Eye size={12} />}
                      {isPending ? 'Review' : 'View'}
                      <ChevronRight size={12} className="opacity-60" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Toast message={toastMsg} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </AppShell>
  );
}
