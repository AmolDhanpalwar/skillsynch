import { useEffect, useState, useMemo } from 'react';
import {
  Code2,
  Layers,
  Wrench,
  Database,
  Award,
  Star,
  TrendingUp,
  Users,
  ChevronDown,
  Search,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import AppShell from '../components/layout/AppShell';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabaseClient';
import { exportSkillsMatrix } from '../lib/exportService';

type TabId = 'languages' | 'frameworks' | 'tools' | 'databases' | 'certifications';

interface SkillStat {
  name: string;
  count: number;
  avg_employee: number;
  avg_manager: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  expert: number;
}

interface SimpleStat {
  name: string;
  count: number;
}

interface MatrixData {
  languages: SkillStat[];
  frameworks: SkillStat[];
  tools: SimpleStat[];
  databases: SimpleStat[];
  certifications: SimpleStat[];
  totalForms: number;
  approvedForms: number;
}

const RATING_LABELS = ['No Knowledge', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

const RATING_COLORS = ['#e5e7eb', '#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8'];

const BAR_COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'];

const TAB_CONFIG: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'languages',     label: 'Languages',     icon: Code2 },
  { id: 'frameworks',    label: 'Frameworks',     icon: Layers },
  { id: 'tools',         label: 'Tools',          icon: Wrench },
  { id: 'databases',     label: 'Databases',      icon: Database },
  { id: 'certifications', label: 'Certifications', icon: Award },
];

function getRatingBand(avg: number): { label: string; color: string } {
  if (avg < 1) return { label: 'No Knowledge', color: 'text-gray-400' };
  if (avg < 2) return { label: 'Beginner',     color: 'text-sky-400' };
  if (avg < 3) return { label: 'Intermediate', color: 'text-sky-500' };
  if (avg < 3.5) return { label: 'Advanced',   color: 'text-blue-600' };
  return { label: 'Expert',                    color: 'text-blue-800' };
}

function AvgBar({ value }: { value: number }) {
  const pct = Math.round((value / 4) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-500 font-body w-7 text-right shrink-0">{value.toFixed(1)}</span>
    </div>
  );
}

interface SkillTableProps {
  data: SkillStat[];
  search: string;
  sort: SortKey;
  onSort: (k: SortKey) => void;
}

type SortKey = 'name' | 'count' | 'avg_employee' | 'avg_manager';

function SortTh({ label, sortKey, current, onSort }: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ChevronDown size={11} className={`transition-transform ${active ? 'text-primary-500 rotate-0' : 'opacity-30'}`} />
      </span>
    </th>
  );
}

function SkillTable({ data, search, sort, onSort }: SkillTableProps) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'count') return b.count - a.count;
        if (sort === 'avg_employee') return b.avg_employee - a.avg_employee;
        return b.avg_manager - a.avg_manager;
      });
  }, [data, search, sort]);

  if (filtered.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400 font-body">No data found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <SortTh label="Skill" sortKey="name" current={sort} onSort={onSort} />
            <SortTh label="Employees" sortKey="count" current={sort} onSort={onSort} />
            <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Rating Distribution</th>
            <SortTh label="Avg Self" sortKey="avg_employee" current={sort} onSort={onSort} />
            <SortTh label="Avg Manager" sortKey="avg_manager" current={sort} onSort={onSort} />
            <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Level</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((row) => {
            const total = row.beginner + row.intermediate + row.advanced + row.expert || 1;
            const band = getRatingBand(row.avg_employee);
            return (
              <tr key={row.name} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3.5 font-semibold font-heading text-gray-800 text-sm whitespace-nowrap">{row.name}</td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 text-xs font-body text-gray-600">
                    <Users size={11} className="text-gray-400" />
                    {row.count}
                  </span>
                </td>
                <td className="px-4 py-3.5 min-w-[160px]">
                  <div className="flex h-3 rounded-full overflow-hidden gap-px">
                    {[row.beginner, row.intermediate, row.advanced, row.expert].map((v, i) => {
                      const pct = Math.round((v / total) * 100);
                      return pct > 0 ? (
                        <div
                          key={i}
                          title={`${RATING_LABELS[i + 1]}: ${v}`}
                          className="h-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[i + 1] }}
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-2 mt-1">
                    {[row.beginner, row.intermediate, row.advanced, row.expert].map((v, i) =>
                      v > 0 ? (
                        <span key={i} className="text-[10px] text-gray-400 font-body">
                          {RATING_LABELS[i + 1][0]}: {v}
                        </span>
                      ) : null
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 min-w-[110px]">
                  <AvgBar value={row.avg_employee} />
                </td>
                <td className="px-4 py-3.5 min-w-[110px]">
                  {row.avg_manager > 0 ? (
                    <AvgBar value={row.avg_manager} />
                  ) : (
                    <span className="text-[11px] text-gray-300 font-body">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-semibold font-heading ${band.color}`}>{band.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ data, search }: { data: SimpleStat[]; search: string }) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count);
  }, [data, search]);

  if (filtered.length === 0) {
    return <div className="py-12 text-center text-sm text-gray-400 font-body">No data found.</div>;
  }

  const max = filtered[0]?.count || 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Name</th>
            <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Usage</th>
            <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider w-1/2">Distribution</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((row, idx) => (
            <tr key={row.name} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-3.5 font-semibold font-heading text-gray-800 whitespace-nowrap">{row.name}</td>
              <td className="px-4 py-3.5">
                <span className="inline-flex items-center gap-1 text-xs font-body text-gray-600">
                  <Users size={11} className="text-gray-400" />
                  {row.count}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((row.count / max) * 100)}%`,
                        backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 font-body w-8 shrink-0">
                    {Math.round((row.count / max) * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SkillsMatrixPage() {
  const [activeTab, setActiveTab] = useState<TabId>('languages');
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('count');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportSkillsMatrix();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [formsRes, itemsRes] = await Promise.all([
        supabase.from('skill_forms').select('id, status, tools, databases, certifications'),
        supabase
          .from('skill_items')
          .select('category, name, employee_rating, manager_rating'),
      ]);

      const forms = formsRes.data ?? [];
      const items = itemsRes.data ?? [];

      const totalForms = forms.length;
      const approvedForms = forms.filter((f) => f.status === 'approved').length;

      function aggregateSkillItems(category: 'language' | 'framework'): SkillStat[] {
        const map = new Map<string, { emp: number[]; mgr: number[]; dist: number[] }>();
        items
          .filter((i) => i.category === category && i.employee_rating !== null)
          .forEach((i) => {
            if (!map.has(i.name)) map.set(i.name, { emp: [], mgr: [], dist: [0, 0, 0, 0] });
            const entry = map.get(i.name)!;
            const er = Number(i.employee_rating);
            entry.emp.push(er);
            if (i.manager_rating !== null) entry.mgr.push(Number(i.manager_rating));
            if (er >= 1 && er <= 4) entry.dist[er - 1]++;
          });
        const result: SkillStat[] = [];
        map.forEach((v, name) => {
          const avg_emp = v.emp.length ? v.emp.reduce((a, b) => a + b, 0) / v.emp.length : 0;
          const avg_mgr = v.mgr.length ? v.mgr.reduce((a, b) => a + b, 0) / v.mgr.length : 0;
          result.push({
            name,
            count: v.emp.length,
            avg_employee: Math.round(avg_emp * 100) / 100,
            avg_manager: Math.round(avg_mgr * 100) / 100,
            beginner: v.dist[0],
            intermediate: v.dist[1],
            advanced: v.dist[2],
            expert: v.dist[3],
          });
        });
        return result.sort((a, b) => b.count - a.count);
      }

      function aggregateText(field: 'tools' | 'databases'): SimpleStat[] {
        const map = new Map<string, number>();
        forms.forEach((f) => {
          const raw: string = f[field] ?? '';
          raw.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((t: string) => {
            map.set(t, (map.get(t) ?? 0) + 1);
          });
        });
        return Array.from(map.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      }

      function aggregateCertifications(): SimpleStat[] {
        const map = new Map<string, number>();
        forms.forEach((f) => {
          const certs: string[] = f.certifications ?? [];
          certs.filter(Boolean).forEach((c: string) => {
            const t = c.trim();
            if (t) map.set(t, (map.get(t) ?? 0) + 1);
          });
        });
        return Array.from(map.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      }

      setData({
        languages: aggregateSkillItems('language'),
        frameworks: aggregateSkillItems('framework'),
        tools: aggregateText('tools'),
        databases: aggregateText('databases'),
        certifications: aggregateCertifications(),
        totalForms,
        approvedForms,
      });
      setLoading(false);
    }
    load();
  }, []);

  const topLanguages = useMemo(() => {
    if (!data) return [];
    return data.languages.slice(0, 8).map((l, i) => ({
      name: l.name,
      'Self Rating': l.avg_employee,
      'Manager Rating': l.avg_manager,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    }));
  }, [data]);

  const topFrameworks = useMemo(() => {
    if (!data) return [];
    return data.frameworks.slice(0, 8).map((f, i) => ({
      name: f.name,
      'Self Rating': f.avg_employee,
      'Manager Rating': f.avg_manager,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    }));
  }, [data]);

  const radarData = useMemo(() => {
    if (!data) return [];
    const top5 = data.languages.slice(0, 5);
    return top5.map((l) => ({
      skill: l.name,
      Self: l.avg_employee,
      Manager: l.avg_manager,
    }));
  }, [data]);

  const currentTabData = data
    ? (activeTab === 'languages' || activeTab === 'frameworks')
      ? (data[activeTab] as SkillStat[])
      : (data[activeTab] as SimpleStat[])
    : [];

  const totalSkills =
    (data?.languages.length ?? 0) +
    (data?.frameworks.length ?? 0) +
    (data?.tools.length ?? 0) +
    (data?.databases.length ?? 0) +
    (data?.certifications.length ?? 0);

  const SUMMARY_CARDS = [
    { label: 'Total Forms',    value: data?.totalForms ?? 0,    icon: Users,     color: 'text-primary-500', bg: 'bg-primary-50',  border: 'border-primary-100' },
    { label: 'Approved Forms', value: data?.approvedForms ?? 0, icon: Star,      color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
    { label: 'Unique Skills',  value: totalSkills,              icon: TrendingUp, color: 'text-sky-600',    bg: 'bg-sky-50',      border: 'border-sky-100' },
    { label: 'Languages',      value: data?.languages.length ?? 0, icon: Code2,  color: 'text-blue-600',   bg: 'bg-blue-50',     border: 'border-blue-100' },
    { label: 'Frameworks',     value: data?.frameworks.length ?? 0, icon: Layers, color: 'text-teal-600',  bg: 'bg-teal-50',     border: 'border-teal-100' },
    { label: 'Certifications', value: data?.certifications.length ?? 0, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Skills Matrix</h1>
            <p className="text-sm text-gray-500 font-body mt-1">
              Aggregated skill statistics across all submitted employee forms.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting || loading || !data}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Download size={15} />
            Download
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <Skeleton className="w-9 h-9 rounded-xl" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {SUMMARY_CARDS.map((c) => (
              <div key={c.label} className={`bg-white rounded-2xl border ${c.border} p-5 shadow-sm`}>
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
                  <c.icon size={16} className={c.color} />
                </div>
                <p className="font-heading font-bold text-xl text-gray-900">{c.value}</p>
                <p className="text-[11px] text-gray-500 font-body mt-0.5 leading-tight">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && data && (topLanguages.length > 0 || topFrameworks.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {topLanguages.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="font-heading font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
                  <Code2 size={14} className="text-sky-500" />
                  Top Languages — Avg Self Rating
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topLanguages} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" domain={[0, 4]} tickCount={5} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={90} />
                    <Tooltip
                      formatter={(v: number) => [v.toFixed(2), 'Avg Self Rating']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Bar dataKey="Self Rating" radius={[0, 4, 4, 0]}>
                      {topLanguages.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {topFrameworks.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="font-heading font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
                  <Layers size={14} className="text-teal-500" />
                  Top Frameworks — Avg Self Rating
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topFrameworks} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" domain={[0, 4]} tickCount={5} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={90} />
                    <Tooltip
                      formatter={(v: number) => [v.toFixed(2), 'Avg Self Rating']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                    <Bar dataKey="Self Rating" radius={[0, 4, 4, 0]}>
                      {topFrameworks.map((_, i) => (
                        <Cell key={i} fill={['#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59'][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {radarData.length >= 3 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
                <p className="font-heading font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
                  <Star size={14} className="text-amber-500" />
                  Top 5 Languages — Self vs Manager Rating
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#374151' }} />
                    <Radar name="Self" dataKey="Self" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} dot={{ r: 3 }} />
                    <Radar name="Manager" dataKey="Manager" stroke="#10b981" fill="#10b981" fillOpacity={0.15} dot={{ r: 3 }} />
                    <Tooltip
                      formatter={(v: number) => v.toFixed(2)}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs font-body text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" /> Self Rating
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-body text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Manager Rating
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-0 border-b border-gray-100">
            <div className="flex items-center justify-between gap-3 flex-wrap pb-4">
              <h2 className="font-heading font-semibold text-sm text-gray-700">Detailed Breakdown</h2>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto">
              {TAB_CONFIG.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                const count = data ? (data[t.id] as { length: number }).length : 0;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTab(t.id); setSearch(''); setSort('count'); }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-heading whitespace-nowrap border-b-2 transition-all ${
                      active
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon size={13} />
                    {t.label}
                    {!loading && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-body ${active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : !data || currentTabData.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400 font-body">No skill data available yet.</p>
              <p className="text-xs text-gray-300 font-body mt-1">Data appears once employees submit their skill forms.</p>
            </div>
          ) : activeTab === 'languages' || activeTab === 'frameworks' ? (
            <SkillTable
              data={data[activeTab] as SkillStat[]}
              search={search}
              sort={sort}
              onSort={setSort}
            />
          ) : (
            <SimpleTable data={data[activeTab] as SimpleStat[]} search={search} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
