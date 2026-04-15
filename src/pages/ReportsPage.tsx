import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  FileX,
  BarChart2,
  TrendingUp,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { supabase } from '../lib/supabaseClient';
import type { FormStatus } from '../types';

interface FormRow {
  status: FormStatus;
  grade: string | null;
  designation: string | null;
}

interface BarData {
  label: string;
  approved: number;
  pending: number;
  draft: number;
  returned: number;
  total: number;
}

const STATUS_COLORS: Record<FormStatus, string> = {
  approved:       '#10b981',
  pending_review: '#f59e0b',
  returned:       '#f97316',
  draft:          '#9ca3af',
};

const STATUS_LABELS: Record<FormStatus, string> = {
  approved:       'Approved',
  pending_review: 'Pending Review',
  returned:       'Returned',
  draft:          'Draft',
};

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-heading font-semibold text-gray-700 w-6 text-right">{value}</span>
    </div>
  );
}

function GroupedBarChart({ data }: { data: BarData[] }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.slice(0, 8).map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-body w-28 shrink-0 truncate">{d.label}</span>
          <div className="flex-1 space-y-1">
            <MiniBar value={d.approved} max={maxVal} color={STATUS_COLORS.approved} />
            <MiniBar value={d.pending} max={maxVal} color={STATUS_COLORS.pending_review} />
            {d.draft > 0 && <MiniBar value={d.draft} max={maxVal} color={STATUS_COLORS.draft} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return (
    <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
      <span className="text-xs text-gray-400 font-body">No data</span>
    </div>
  );

  let cumAngle = -90;
  const r = 54;
  const cx = 64;
  const cy = 64;

  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = s.value / total;
      const angle = pct * 360;
      const startRad = (cumAngle * Math.PI) / 180;
      const endRad = ((cumAngle + angle) * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const large = angle > 180 ? 1 : 0;
      cumAngle += angle;
      return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: s.color, label: s.label, value: s.value };
    });

  return (
    <svg viewBox="0 0 128 128" className="w-32 h-32">
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color} opacity={0.9} />
      ))}
      <circle cx={cx} cy={cy} r={32} fill="white" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="text-lg font-bold" fontSize="18" fontWeight="700" fill="#111827">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="#9ca3af">total</text>
    </svg>
  );
}

export default function ReportsPage() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count }, { data: formData }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
        supabase
          .from('skill_forms')
          .select('status, users!skill_forms_employee_id_fkey(grade, designation)')
      ]);

      setTotalEmployees(count ?? 0);

      if (formData) {
        setForms(
          formData.map((f) => {
            const u = f.users as Record<string, unknown> | null;
            return {
              status: f.status as FormStatus,
              grade: (u?.grade as string) || null,
              designation: (u?.designation as string) || null,
            };
          })
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => ({
    total: totalEmployees,
    approved: forms.filter((f) => f.status === 'approved').length,
    pending: forms.filter((f) => f.status === 'pending_review').length,
    notStarted: totalEmployees - forms.length,
  }), [forms, totalEmployees]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<FormStatus, number> = { approved: 0, pending_review: 0, returned: 0, draft: 0 };
    forms.forEach((f) => { counts[f.status]++; });
    return counts;
  }, [forms]);

  const byGrade = useMemo<BarData[]>(() => {
    const map: Record<string, BarData> = {};
    forms.forEach((f) => {
      const g = f.grade || 'Unknown';
      if (!map[g]) map[g] = { label: g, approved: 0, pending: 0, draft: 0, returned: 0, total: 0 };
      map[g].total++;
      if (f.status === 'approved') map[g].approved++;
      else if (f.status === 'pending_review') map[g].pending++;
      else if (f.status === 'draft') map[g].draft++;
      else map[g].returned++;
    });
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label));
  }, [forms]);

  const STAT_CARDS = [
    { label: 'Total Employees', value: stats.total,      icon: Users,        color: 'text-primary-500', bg: 'bg-primary-50',  border: 'border-primary-100' },
    { label: 'Approved',        value: stats.approved,   icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
    { label: 'Pending Review',  value: stats.pending,    icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
    { label: 'Not Started',     value: stats.notStarted, icon: FileX,        color: 'text-gray-500',    bg: 'bg-gray-50',     border: 'border-gray-200' },
  ];

  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  const submissionRate = stats.total > 0 ? Math.round((forms.length / stats.total) * 100) : 0;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 font-body mt-1">Organisation-wide skill insights — read-only view.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-primary-300" />
          </div>
        ) : (
          <>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                    <BarChart2 size={15} className="text-primary-500" />
                  </div>
                  <h2 className="font-heading font-bold text-sm text-gray-900">Status Breakdown</h2>
                </div>

                <div className="flex items-start gap-6">
                  <DonutChart
                    segments={[
                      { value: statusBreakdown.approved,       color: STATUS_COLORS.approved,       label: 'Approved' },
                      { value: statusBreakdown.pending_review, color: STATUS_COLORS.pending_review, label: 'Pending' },
                      { value: statusBreakdown.returned,       color: STATUS_COLORS.returned,       label: 'Returned' },
                      { value: statusBreakdown.draft,          color: STATUS_COLORS.draft,          label: 'Draft' },
                    ]}
                  />
                  <div className="flex-1 space-y-2.5 mt-2">
                    {(Object.keys(statusBreakdown) as FormStatus[]).map((s) => (
                      <div key={s} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                          <span className="text-xs text-gray-600 font-body">{STATUS_LABELS[s]}</span>
                        </div>
                        <span className="text-xs font-semibold font-heading text-gray-800">{statusBreakdown[s]}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-body">Not Started</span>
                        <span className="text-xs font-semibold font-heading text-gray-800">{stats.notStarted}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-accent-50 flex items-center justify-center">
                    <TrendingUp size={15} className="text-accent-500" />
                  </div>
                  <h2 className="font-heading font-bold text-sm text-gray-900">Key Metrics</h2>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-500 font-body">Submission Rate</span>
                      <span className="text-xs font-semibold font-heading text-gray-800">{submissionRate}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-accent-400 transition-all duration-700" style={{ width: `${submissionRate}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-body mt-1">{forms.length} of {stats.total} employees submitted a form</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-500 font-body">Approval Rate</span>
                      <span className="text-xs font-semibold font-heading text-gray-800">{approvalRate}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${approvalRate}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-body mt-1">{stats.approved} of {stats.total} employees approved</p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-500 font-body">Pending / Returned</span>
                      <span className="text-xs font-semibold font-heading text-gray-800">{stats.pending + statusBreakdown.returned}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${stats.total > 0 ? ((stats.pending + statusBreakdown.returned) / stats.total) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 font-body mt-1">{stats.pending} pending + {statusBreakdown.returned} returned</p>
                  </div>
                </div>
              </div>
            </div>

            {byGrade.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <RotateCcw size={15} className="text-emerald-500" />
                    </div>
                    <h2 className="font-heading font-bold text-sm text-gray-900">Submissions by Grade</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {[
                      { label: 'Approved',       color: STATUS_COLORS.approved },
                      { label: 'Pending',        color: STATUS_COLORS.pending_review },
                      { label: 'Draft',          color: STATUS_COLORS.draft },
                    ].map((l) => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                        <span className="text-[10px] text-gray-500 font-body">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <GroupedBarChart data={byGrade} />
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
