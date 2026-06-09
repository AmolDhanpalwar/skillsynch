import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  FileX,
  BarChart2,
  TrendingUp,
  Loader2,
  Award,
  Code2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from 'recharts';
import AppShell from '../components/layout/AppShell';
import { db } from '../lib/db';
import type { FormStatus } from '../types';

const BRAND = {
  primary: '#1A3C5E',
  accent:  '#00A9CE',
  success: '#059669',
  warning: '#f59e0b',
  danger:  '#f97316',
  muted:   '#9ca3af',
};

const STATUS_COLORS: Record<string, string> = {
  approved:       BRAND.success,
  pending_review: BRAND.warning,
  returned:       BRAND.danger,
  draft:          BRAND.muted,
};

const STATUS_LABELS: Record<FormStatus, string> = {
  approved:       'Approved',
  pending_review: 'Pending Review',
  returned:       'Returned',
  draft:          'Draft',
};

interface AnalyticsData {
  statusBreakdown: { name: string; value: number; color: string }[];
  topLanguages: { name: string; avgMgrRating: number }[];
  topFrameworks: { name: string; avgMgrRating: number }[];
  selfVsMgr: { name: string; self: number; manager: number }[];
  certCounts: { name: string; count: number }[];
  totalEmployees: number;
  formsCount: number;
  approvedCount: number;
  pendingCount: number;
  notStartedCount: number;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
}

async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const [{ count: totalEmployees }, { data: formsRaw }, { data: skillItemsRaw }] = await Promise.all([
    db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
    db.from('skill_forms').select('id, status, certifications'),
    db.from('skill_items').select('form_id, category, name, employee_rating, manager_rating'),
  ]);

  const forms = formsRaw ?? [];
  const formsCount = forms.length;
  const approvedCount = forms.filter((f) => f.status === 'approved').length;
  const pendingCount  = forms.filter((f) => f.status === 'pending_review').length;
  const notStartedCount = (totalEmployees ?? 0) - formsCount;

  const statusCounts: Record<string, number> = { approved: 0, pending_review: 0, returned: 0, draft: 0 };
  forms.forEach((f) => { if (statusCounts[f.status] !== undefined) statusCounts[f.status]++; });
  const statusBreakdown = (Object.keys(statusCounts) as FormStatus[])
    .filter((k) => statusCounts[k] > 0)
    .map((k) => ({ name: STATUS_LABELS[k], value: statusCounts[k], color: STATUS_COLORS[k] }));

  const langMap: Record<string, number[]> = {};
  const fwkMap:  Record<string, number[]> = {};
  const skillCombined: Record<string, { self: number[]; mgr: number[] }> = {};
  const certMap: Record<string, number> = {};

  (skillItemsRaw ?? []).forEach((item) => {
    const name = item.name?.trim();
    if (!name) return;
    if (!skillCombined[name]) skillCombined[name] = { self: [], mgr: [] };
    if (item.employee_rating !== null) skillCombined[name].self.push(item.employee_rating);
    if (item.manager_rating  !== null) skillCombined[name].mgr.push(item.manager_rating);

    if (item.category === 'language') {
      if (!langMap[name]) langMap[name] = [];
      if (item.manager_rating !== null) langMap[name].push(item.manager_rating);
    } else if (item.category === 'framework') {
      if (!fwkMap[name]) fwkMap[name] = [];
      if (item.manager_rating !== null) fwkMap[name].push(item.manager_rating);
    }
  });

  forms.forEach((f) => {
    const certs = f.certifications as string[] | null;
    if (!Array.isArray(certs)) return;
    certs.filter((c) => c?.trim()).forEach((cert) => {
      const key = cert.trim();
      certMap[key] = (certMap[key] ?? 0) + 1;
    });
  });

  const topLanguages = Object.entries(langMap)
    .map(([name, ratings]) => ({ name, avgMgrRating: avg(ratings) }))
    .filter((x) => x.avgMgrRating > 0)
    .sort((a, b) => b.avgMgrRating - a.avgMgrRating)
    .slice(0, 10);

  const topFrameworks = Object.entries(fwkMap)
    .map(([name, ratings]) => ({ name, avgMgrRating: avg(ratings) }))
    .filter((x) => x.avgMgrRating > 0)
    .sort((a, b) => b.avgMgrRating - a.avgMgrRating)
    .slice(0, 10);

  const selfVsMgr = Object.entries(skillCombined)
    .map(([name, { self, mgr }]) => ({ name, self: avg(self), manager: avg(mgr) }))
    .filter((x) => x.self > 0 || x.manager > 0)
    .sort((a, b) => b.manager - a.manager)
    .slice(0, 8);

  const certCounts = Object.entries(certMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    statusBreakdown,
    topLanguages,
    topFrameworks,
    selfVsMgr,
    certCounts,
    totalEmployees: totalEmployees ?? 0,
    formsCount,
    approvedCount,
    pendingCount,
    notStartedCount,
  };
}

function ChartCard({ title, icon: Icon, iconBg, iconColor, children }: {
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon size={15} className={iconColor} />
        </div>
        <h2 className="font-heading font-bold text-sm text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2.5 text-xs font-body">
      {label && <p className="font-semibold font-heading text-gray-800 mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2 text-xs font-body">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.payload.color }} />
        <span className="font-semibold text-gray-800">{item.name}:</span>
        <span className="text-gray-600">{item.value}</span>
      </div>
    </div>
  );
};

export default function ReportsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const approvalRate   = data && data.totalEmployees > 0 ? Math.round((data.approvedCount / data.totalEmployees) * 100) : 0;
  const submissionRate = data && data.totalEmployees > 0 ? Math.round((data.formsCount / data.totalEmployees) * 100) : 0;
  const pendingReturnedRate = useMemo(() => {
    if (!data || data.totalEmployees === 0) return 0;
    const returned = data.statusBreakdown.find((s) => s.name === 'Returned')?.value ?? 0;
    return Math.round(((data.pendingCount + returned) / data.totalEmployees) * 100);
  }, [data]);

  const STAT_CARDS = useMemo(() => [
    { label: 'Total Employees', value: data?.totalEmployees ?? 0, icon: Users,        color: 'text-primary-500', bg: 'bg-primary-50',  border: 'border-primary-100' },
    { label: 'Approved',        value: data?.approvedCount ?? 0,  icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
    { label: 'Pending Review',  value: data?.pendingCount ?? 0,   icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
    { label: 'Not Started',     value: data?.notStartedCount ?? 0, icon: FileX,       color: 'text-gray-500',    bg: 'bg-gray-50',     border: 'border-gray-200' },
  ], [data]);

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
              <ChartCard title="Submission Status Breakdown" icon={BarChart2} iconBg="bg-primary-50" iconColor="text-primary-500">
                {(data?.statusBreakdown?.length ?? 0) === 0 ? (
                  <div className="flex items-center justify-center h-48 text-gray-300 text-sm font-body">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data!.statusBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {data!.statusBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend
                        formatter={(value) => <span className="text-xs font-body text-gray-600">{value}</span>}
                        iconType="circle"
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Key Metrics" icon={TrendingUp} iconBg="bg-accent-50" iconColor="text-accent-500">
                <div className="space-y-5 pt-1">
                  {[
                    {
                      label: 'Submission Rate',
                      value: submissionRate,
                      color: 'bg-accent-400',
                      subtitle: `${data?.formsCount ?? 0} of ${data?.totalEmployees ?? 0} employees`,
                    },
                    {
                      label: 'Approval Rate',
                      value: approvalRate,
                      color: 'bg-emerald-400',
                      subtitle: `${data?.approvedCount ?? 0} of ${data?.totalEmployees ?? 0} employees approved`,
                    },
                    {
                      label: 'Pending / Returned',
                      value: pendingReturnedRate,
                      color: 'bg-amber-400',
                      subtitle: `${data?.pendingCount ?? 0} pending forms`,
                    },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-gray-500 font-body">{m.label}</span>
                        <span className="text-xs font-semibold font-heading text-gray-800">{m.value}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.color} transition-all duration-700`}
                          style={{ width: `${m.value}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 font-body mt-1">{m.subtitle}</p>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            <ChartCard title="Top 10 Languages by Average Manager Rating" icon={Code2} iconBg="bg-primary-50" iconColor="text-primary-500">
              {(data?.topLanguages?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm font-body">No manager ratings recorded yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data!.topLanguages} margin={{ top: 5, right: 20, left: -10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis domain={[0, 4]} tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }} tickCount={5} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgMgrRating" name="Avg Mgr Rating" fill={BRAND.primary} radius={[4, 4, 0, 0]} maxBarSize={40}>
                      <LabelList
                        dataKey="avgMgrRating"
                        position="top"
                        formatter={(v: number) => v.toFixed(1)}
                        style={{ fontSize: 10, fill: '#374151', fontFamily: 'Inter' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Top 10 Frameworks by Average Manager Rating" icon={Code2} iconBg="bg-accent-50" iconColor="text-accent-500">
              {(data?.topFrameworks?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm font-body">No manager ratings recorded yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data!.topFrameworks} margin={{ top: 5, right: 20, left: -10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis domain={[0, 4]} tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }} tickCount={5} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgMgrRating" name="Avg Mgr Rating" fill={BRAND.accent} radius={[4, 4, 0, 0]} maxBarSize={40}>
                      <LabelList
                        dataKey="avgMgrRating"
                        position="top"
                        formatter={(v: number) => v.toFixed(1)}
                        style={{ fontSize: 10, fill: '#374151', fontFamily: 'Inter' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Self-Rating vs Manager Rating — Top 8 Skills" icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-500">
              {(data?.selfVsMgr?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm font-body">No ratings recorded yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data!.selfVsMgr} margin={{ top: 5, right: 20, left: -10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis domain={[0, 4]} tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }} tickCount={5} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      formatter={(value) => <span className="text-xs font-body text-gray-600">{value}</span>}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="self" name="Self Rating" fill={BRAND.accent} radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="manager" name="Manager Rating" fill={BRAND.primary} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Certification Count by Name — Top 10" icon={Award} iconBg="bg-amber-50" iconColor="text-amber-500">
              {(data?.certCounts?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm font-body">No certifications recorded yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(220, data!.certCounts.length * 38)}>
                  <BarChart
                    data={data!.certCounts}
                    layout="vertical"
                    margin={{ top: 4, right: 50, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#6b7280' }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'Inter', fill: '#374151' }}
                      width={160}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Employees" fill={BRAND.success} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList
                        dataKey="count"
                        position="right"
                        style={{ fontSize: 11, fill: '#374151', fontFamily: 'Inter', fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </>
        )}
      </div>
    </AppShell>
  );
}
