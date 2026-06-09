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
  ArrowLeft,
  Zap,
  User,
  Briefcase,
  ChevronRight,
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
import CycleSelectorDropdown from '../components/ui/CycleSelectorDropdown';
import { db } from '../lib/db';
import { exportSkillsMatrix } from '../lib/exportService';
import { useCycle } from '../context/CycleContext';

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'languages' | 'frameworks' | 'tools' | 'databases' | 'certifications';
type DemandFilter = 'all' | 'haptiq' | 'non-haptiq';
type DrillLevel = 'main' | 'skill-list' | 'employee-list';

interface SkillStat {
  name: string;
  count: number;
  avg_employee: number;
  avg_manager: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  expert: number;
  is_haptiq_demand: boolean;
}

interface SimpleStat {
  name: string;
  count: number;
  is_haptiq_demand: boolean;
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

interface EmployeeRow {
  form_id: string;
  employee_name: string;
  employee_number: string;
  designation: string;
  grade: string;
  manager_name: string;
  status: string;
  total_exp: number;
  relevant_exp: number;
  haptiq_exp: number;
  current_project: string;
  employee_rating: number;
  manager_rating: number | null;
  manager_comment: string | null;
}

// category for simple tabs
type SimpleCategory = 'tools' | 'databases' | 'certifications';

// drill state
interface DrillState {
  level: DrillLevel;
  tab: TabId;
  tabLabel: string;
  skillName?: string; // set when level === 'employee-list'
}

// ── Constants ────────────────────────────────────────────────────────────────

const RATING_LABELS = ['No Knowledge', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
const RATING_COLORS = ['#e5e7eb', '#93c5fd', '#60a5fa', '#2563eb', '#1d4ed8'];
const BAR_COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'];
const TEAL_COLORS = ['#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59'];

const TAB_CONFIG: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'languages',      label: 'Languages',     icon: Code2 },
  { id: 'frameworks',     label: 'Frameworks',     icon: Layers },
  { id: 'tools',          label: 'Tools',          icon: Wrench },
  { id: 'databases',      label: 'Databases',      icon: Database },
  { id: 'certifications', label: 'Certifications', icon: Award },
];

const DEMAND_FILTERS: { id: DemandFilter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'haptiq',     label: 'Haptiq Demand' },
  { id: 'non-haptiq', label: 'Non Haptiq' },
];

const RATING_BAND_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700',
  2: 'bg-sky-200 text-sky-800',
  3: 'bg-blue-200 text-blue-800',
  4: 'bg-blue-600 text-white',
};

const STATUS_STYLES: Record<string, string> = {
  approved:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  returned:       'bg-red-50 text-red-700 border-red-200',
  draft:          'bg-gray-100 text-gray-500 border-gray-200',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function applyDemandFilter<T extends { is_haptiq_demand: boolean }>(items: T[], filter: DemandFilter): T[] {
  if (filter === 'haptiq') return items.filter((i) => i.is_haptiq_demand);
  if (filter === 'non-haptiq') return items.filter((i) => !i.is_haptiq_demand);
  return items;
}

function getRatingBand(avg: number): { label: string; color: string } {
  if (avg < 1) return { label: 'No Knowledge', color: 'text-gray-400' };
  if (avg < 2) return { label: 'Beginner',      color: 'text-sky-400' };
  if (avg < 3) return { label: 'Intermediate',  color: 'text-sky-500' };
  if (avg < 3.5) return { label: 'Advanced',    color: 'text-blue-600' };
  return { label: 'Expert',                      color: 'text-blue-800' };
}

function AvgBar({ value }: { value: number }) {
  const pct = Math.round((value / 4) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-gray-500 font-body w-7 text-right shrink-0">{value.toFixed(1)}</span>
    </div>
  );
}

function HaptiqBadge({ demand }: { demand: boolean }) {
  if (!demand) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold font-heading bg-sky-50 text-sky-600 border border-sky-200 rounded-full px-1.5 py-0.5 ml-1.5 shrink-0">
      <Zap size={8} className="fill-sky-500" />HD
    </span>
  );
}

type SortKey = 'name' | 'count' | 'avg_employee' | 'avg_manager';

function SortTh({ label, sortKey, current, onSort }: { label: string; sortKey: SortKey; current: SortKey; onSort: (k: SortKey) => void }) {
  const active = current === sortKey;
  return (
    <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none" onClick={() => onSort(sortKey)}>
      <span className="flex items-center gap-1">
        {label}
        <ChevronDown size={11} className={`transition-transform ${active ? 'text-primary-500' : 'opacity-30'}`} />
      </span>
    </th>
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ crumbs, onNavigate }: { crumbs: { label: string; level: DrillLevel; tab?: TabId; skillName?: string }[]; onNavigate: (idx: number) => void }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm font-body">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
            {isLast ? (
              <span className="font-semibold text-gray-800 font-heading">{c.label}</span>
            ) : (
              <button onClick={() => onNavigate(i)} className="text-sky-500 hover:text-sky-700 hover:underline transition-colors">
                {c.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ── Skill list view (intermediate drill) ─────────────────────────────────────

function SkillListView({
  tab, tabLabel, data, onSkillClick, onBack,
}: {
  tab: TabId; tabLabel: string; data: MatrixData; onSkillClick: (skillName: string) => void; onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('count');
  const isRated = tab === 'languages' || tab === 'frameworks';
  const items = data[tab];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = (items as (SkillStat | SimpleStat)[]).filter((d) => !q || d.name.toLowerCase().includes(q));
    if (isRated) {
      return (base as SkillStat[]).sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'count') return b.count - a.count;
        if (sort === 'avg_employee') return b.avg_employee - a.avg_employee;
        return b.avg_manager - a.avg_manager;
      });
    }
    return (base as SimpleStat[]).sort((a, b) => b.count - a.count);
  }, [items, search, sort, isRated]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
          <ArrowLeft size={14} />Back
        </button>
        <Breadcrumb
          crumbs={[{ label: 'Skills Matrix', level: 'main' }, { label: tabLabel, level: 'skill-list' }]}
          onNavigate={onBack}
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-heading font-bold text-base text-gray-900">{tabLabel}</h2>
            <p className="text-xs text-gray-400 font-body mt-0.5">Click any skill to view employees</p>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400 font-body">No results found.</div>
        ) : isRated ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <SortTh label="Skill" sortKey="name" current={sort} onSort={setSort} />
                  <SortTh label="Employees" sortKey="count" current={sort} onSort={setSort} />
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Rating Distribution</th>
                  <SortTh label="Avg Self" sortKey="avg_employee" current={sort} onSort={setSort} />
                  <SortTh label="Avg Manager" sortKey="avg_manager" current={sort} onSort={setSort} />
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Level</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(filtered as SkillStat[]).map((row) => {
                  const total = row.beginner + row.intermediate + row.advanced + row.expert || 1;
                  const band = getRatingBand(row.avg_employee);
                  return (
                    <tr key={row.name} className="hover:bg-sky-50/40 cursor-pointer transition-colors group" onClick={() => onSkillClick(row.name)}>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-semibold font-heading text-gray-800 group-hover:text-sky-700 transition-colors">{row.name}</span>
                        <HaptiqBadge demand={row.is_haptiq_demand} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs font-body text-gray-600"><Users size={11} className="text-gray-400" />{row.count}</span>
                      </td>
                      <td className="px-4 py-3.5 min-w-[160px]">
                        <div className="flex h-3 rounded-full overflow-hidden gap-px">
                          {[row.beginner, row.intermediate, row.advanced, row.expert].map((v, i) => {
                            const pct = Math.round((v / total) * 100);
                            return pct > 0 ? <div key={i} title={`${RATING_LABELS[i + 1]}: ${v}`} className="h-full" style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[i + 1] }} /> : null;
                          })}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {[row.beginner, row.intermediate, row.advanced, row.expert].map((v, i) => v > 0 ? <span key={i} className="text-[10px] text-gray-400 font-body">{RATING_LABELS[i + 1][0]}: {v}</span> : null)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 min-w-[110px]"><AvgBar value={row.avg_employee} /></td>
                      <td className="px-4 py-3.5 min-w-[110px]">
                        {row.avg_manager > 0 ? <AvgBar value={row.avg_manager} /> : <span className="text-[11px] text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5"><span className={`text-xs font-semibold font-heading ${band.color}`}>{band.label}</span></td>
                      <td className="px-4 py-3.5"><ChevronRight size={14} className="text-gray-300 group-hover:text-sky-400 transition-colors" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Employees</th>
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider w-1/2">Distribution</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(filtered as SimpleStat[]).map((row, idx) => {
                  const max = (filtered as SimpleStat[])[0]?.count || 1;
                  return (
                    <tr key={row.name} className="hover:bg-sky-50/40 cursor-pointer transition-colors group" onClick={() => onSkillClick(row.name)}>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-semibold font-heading text-gray-800 group-hover:text-sky-700 transition-colors">{row.name}</span>
                        <HaptiqBadge demand={row.is_haptiq_demand} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs font-body text-gray-600"><Users size={11} className="text-gray-400" />{row.count}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.round((row.count / max) * 100)}%`, backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }} />
                          </div>
                          <span className="text-[11px] text-gray-400 font-body w-8 shrink-0">{Math.round((row.count / max) * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><ChevronRight size={14} className="text-gray-300 group-hover:text-sky-400 transition-colors" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Employee list view (deepest drill) ───────────────────────────────────────

function EmployeeListView({
  tab, tabLabel, skillName, onBack, onBackToSkillList,
}: {
  tab: TabId; tabLabel: string; skillName: string; onBack: () => void; onBackToSkillList: () => void;
}) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchEmployees();
  }, [tab, skillName]);

  async function fetchEmployees() {
    const isRated = tab === 'languages' || tab === 'frameworks';
    const category = tab === 'languages' ? 'language' : tab === 'frameworks' ? 'framework' : null;

    if (isRated && category) {
      // Join skill_items → skill_forms
      const { data: items } = await supabase
        .from('skill_items')
        .select('form_id, employee_rating, manager_rating, manager_comment')
        .eq('category', category)
        .eq('name', skillName);

      if (!items || items.length === 0) { setEmployees([]); setLoading(false); return; }

      const formIds = items.map((i) => i.form_id);
      const { data: forms } = await supabase
        .from('skill_forms')
        .select('id, employee_name, employee_number, designation, grade, manager_name, status, total_exp, relevant_exp, haptiq_exp, current_project')
        .in('id', formIds);

      const formMap = new Map((forms ?? []).map((f) => [f.id, f]));
      const rows: EmployeeRow[] = items
        .filter((i) => formMap.has(i.form_id))
        .map((i) => {
          const f = formMap.get(i.form_id)!;
          return {
            form_id: f.id,
            employee_name: f.employee_name ?? '—',
            employee_number: f.employee_number ?? '—',
            designation: f.designation ?? '—',
            grade: f.grade ?? '—',
            manager_name: f.manager_name ?? '—',
            status: f.status,
            total_exp: f.total_exp ?? 0,
            relevant_exp: f.relevant_exp ?? 0,
            haptiq_exp: f.haptiq_exp ?? 0,
            current_project: f.current_project ?? '—',
            employee_rating: i.employee_rating,
            manager_rating: i.manager_rating,
            manager_comment: i.manager_comment,
          };
        })
        .sort((a, b) => (b.employee_rating ?? 0) - (a.employee_rating ?? 0));

      setEmployees(rows);
    } else {
      // For tools/databases/certifications — find forms where field contains skillName
      const fieldMap: Record<string, SimpleCategory> = { tools: 'tools', databases: 'databases', certifications: 'certifications' };
      const field = fieldMap[tab];

      let query;
      if (field === 'certifications') {
        query = supabase
          .from('skill_forms')
          .select('id, employee_name, employee_number, designation, grade, manager_name, status, total_exp, relevant_exp, haptiq_exp, current_project, certifications')
          .contains('certifications', [skillName]);
      } else {
        query = supabase
          .from('skill_forms')
          .select(`id, employee_name, employee_number, designation, grade, manager_name, status, total_exp, relevant_exp, haptiq_exp, current_project, ${field}`)
          .ilike(field, `%${skillName}%`);
      }

      const { data: forms } = await query;
      const rows: EmployeeRow[] = (forms ?? []).map((f) => ({
        form_id: f.id,
        employee_name: f.employee_name ?? '—',
        employee_number: f.employee_number ?? '—',
        designation: f.designation ?? '—',
        grade: f.grade ?? '—',
        manager_name: f.manager_name ?? '—',
        status: f.status,
        total_exp: f.total_exp ?? 0,
        relevant_exp: f.relevant_exp ?? 0,
        haptiq_exp: f.haptiq_exp ?? 0,
        current_project: f.current_project ?? '—',
        employee_rating: 0,
        manager_rating: null,
        manager_comment: null,
      }));

      setEmployees(rows);
    }
    setLoading(false);
  }

  const isRated = tab === 'languages' || tab === 'frameworks';

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(
      (e) => !q || e.employee_name.toLowerCase().includes(q) || e.designation.toLowerCase().includes(q) || e.employee_number.toLowerCase().includes(q),
    );
  }, [employees, search]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBackToSkillList} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors shrink-0">
          <ArrowLeft size={14} />Back
        </button>
        <Breadcrumb
          crumbs={[
            { label: 'Skills Matrix', level: 'main' },
            { label: tabLabel, level: 'skill-list' },
            { label: skillName, level: 'employee-list' },
          ]}
          onNavigate={(idx) => { if (idx === 0) onBack(); else onBackToSkillList(); }}
        />
      </div>

      {/* Skill header card */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sky-200 text-xs font-body font-semibold uppercase tracking-wider mb-1">{tabLabel}</p>
            <h2 className="font-heading font-bold text-2xl">{skillName}</h2>
            <p className="text-sky-100 text-sm font-body mt-1">
              {filtered.length} employee{filtered.length !== 1 ? 's' : ''} with this skill
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {isRated && employees.length > 0 && (() => {
              const validRatings = employees.filter((e) => e.employee_rating > 0).map((e) => e.employee_rating);
              const validMgr = employees.filter((e) => e.manager_rating != null && e.manager_rating > 0).map((e) => e.manager_rating as number);
              const avgSelf = validRatings.length ? validRatings.reduce((a, b) => a + b, 0) / validRatings.length : 0;
              const avgMgr = validMgr.length ? validMgr.reduce((a, b) => a + b, 0) / validMgr.length : 0;
              return (
                <>
                  <div className="text-center bg-white/15 rounded-xl px-3 py-2">
                    <p className="font-heading font-bold text-xl">{employees.length}</p>
                    <p className="text-sky-200 text-[10px] font-body">Employees</p>
                  </div>
                  <div className="text-center bg-white/15 rounded-xl px-3 py-2">
                    <p className="font-heading font-bold text-xl">{avgSelf.toFixed(1)}</p>
                    <p className="text-sky-200 text-[10px] font-body">Avg Self</p>
                  </div>
                  <div className="text-center bg-white/15 rounded-xl px-3 py-2">
                    <p className="font-heading font-bold text-xl">{avgMgr > 0 ? avgMgr.toFixed(1) : '—'}</p>
                    <p className="text-sky-200 text-[10px] font-body">Avg Manager</p>
                  </div>
                </>
              );
            })()}
            {!isRated && (
              <div className="text-center bg-white/15 rounded-xl px-4 py-2">
                <p className="font-heading font-bold text-xl">{employees.length}</p>
                <p className="text-sky-200 text-[10px] font-body">Employees</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="font-heading font-semibold text-sm text-gray-700">Employee Details</h3>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors" />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <User size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-body">No employees found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Designation</th>
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Manager</th>
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Experience</th>
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Project</th>
                  {isRated && <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Self / Mgr Rating</th>}
                  {isRated && <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Comment</th>}
                  <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((emp) => (
                  <tr key={emp.form_id} className="hover:bg-gray-50/40 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shrink-0">
                          <span className="text-white text-[11px] font-bold font-heading">
                            {(emp.employee_name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold font-heading text-gray-800 text-sm leading-tight">{emp.employee_name}</p>
                          <p className="text-[10px] text-gray-400 font-body">{emp.employee_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-xs font-body text-gray-700">{emp.designation}</p>
                        {emp.grade && emp.grade !== '—' && <p className="text-[10px] text-gray-400 font-body">Grade {emp.grade}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-body text-gray-600">{emp.manager_name}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={11} className="text-gray-300 shrink-0" />
                        <div className="text-[11px] font-body text-gray-600 space-y-0.5">
                          <p>{emp.total_exp}y total</p>
                          <p className="text-gray-400">{emp.haptiq_exp}y Haptiq</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-body text-gray-600 max-w-[120px] truncate block">{emp.current_project}</span>
                    </td>
                    {isRated && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-bold font-heading ${RATING_BAND_COLORS[emp.employee_rating] ?? 'bg-gray-100 text-gray-400'}`}>
                            {emp.employee_rating || '—'}
                          </span>
                          <span className="text-gray-300 text-xs">/</span>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-bold font-heading ${emp.manager_rating ? (RATING_BAND_COLORS[emp.manager_rating] ?? 'bg-gray-100 text-gray-400') : 'bg-gray-50 text-gray-300'}`}>
                            {emp.manager_rating ?? '—'}
                          </span>
                        </div>
                      </td>
                    )}
                    {isRated && (
                      <td className="px-4 py-3.5 max-w-[180px]">
                        {emp.manager_comment ? (
                          <p className="text-[11px] text-gray-500 font-body line-clamp-2" title={emp.manager_comment}>{emp.manager_comment}</p>
                        ) : (
                          <span className="text-[11px] text-gray-300 font-body">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold font-heading px-2 py-1 rounded-full border ${STATUS_STYLES[emp.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {emp.status?.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main matrix table (overview tab) ─────────────────────────────────────────

function MatrixTable({
  activeTab, filteredData, search, setSearch, sort, setSort,
  onSkillClick, activeTabLabel,
}: {
  activeTab: TabId;
  filteredData: MatrixData;
  search: string;
  setSearch: (s: string) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  onSkillClick: (skillName: string) => void;
  activeTabLabel: string;
}) {
  const isRated = activeTab === 'languages' || activeTab === 'frameworks';
  const tabData = filteredData[activeTab];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = (tabData as (SkillStat | SimpleStat)[]).filter((d) => !q || d.name.toLowerCase().includes(q));
    if (isRated) {
      return (base as SkillStat[]).sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'count') return b.count - a.count;
        if (sort === 'avg_employee') return b.avg_employee - a.avg_employee;
        return b.avg_manager - a.avg_manager;
      });
    }
    return (base as SimpleStat[]).sort((a, b) => b.count - a.count);
  }, [tabData, search, sort, isRated]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-heading font-semibold text-sm text-gray-700">Detailed Breakdown</h2>
          <p className="text-[11px] text-gray-400 font-body mt-0.5">Click any skill row to view employees</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-400 font-body">No skill data available for the selected filter.</p>
        </div>
      ) : isRated ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <SortTh label="Skill" sortKey="name" current={sort} onSort={setSort} />
                <SortTh label="Employees" sortKey="count" current={sort} onSort={setSort} />
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Rating Distribution</th>
                <SortTh label="Avg Self" sortKey="avg_employee" current={sort} onSort={setSort} />
                <SortTh label="Avg Manager" sortKey="avg_manager" current={sort} onSort={setSort} />
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Level</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(filtered as SkillStat[]).map((row) => {
                const total = row.beginner + row.intermediate + row.advanced + row.expert || 1;
                const band = getRatingBand(row.avg_employee);
                return (
                  <tr key={row.name} className="hover:bg-sky-50/40 cursor-pointer transition-colors group" onClick={() => onSkillClick(row.name)}>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-semibold font-heading text-gray-800 group-hover:text-sky-700 transition-colors">{row.name}</span>
                      <HaptiqBadge demand={row.is_haptiq_demand} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-body text-gray-600"><Users size={11} className="text-gray-400" />{row.count}</span>
                    </td>
                    <td className="px-4 py-3.5 min-w-[160px]">
                      <div className="flex h-3 rounded-full overflow-hidden gap-px">
                        {[row.beginner, row.intermediate, row.advanced, row.expert].map((v, i) => {
                          const pct = Math.round((v / total) * 100);
                          return pct > 0 ? <div key={i} title={`${RATING_LABELS[i + 1]}: ${v}`} className="h-full" style={{ width: `${pct}%`, backgroundColor: RATING_COLORS[i + 1] }} /> : null;
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 min-w-[110px]"><AvgBar value={row.avg_employee} /></td>
                    <td className="px-4 py-3.5 min-w-[110px]">
                      {row.avg_manager > 0 ? <AvgBar value={row.avg_manager} /> : <span className="text-[11px] text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5"><span className={`text-xs font-semibold font-heading ${band.color}`}>{band.label}</span></td>
                    <td className="px-4 py-3.5"><ChevronRight size={14} className="text-gray-300 group-hover:text-sky-400 transition-colors" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Employees</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider w-1/2">Distribution</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(filtered as SimpleStat[]).map((row, idx) => {
                const max = (filtered as SimpleStat[])[0]?.count || 1;
                return (
                  <tr key={row.name} className="hover:bg-sky-50/40 cursor-pointer transition-colors group" onClick={() => onSkillClick(row.name)}>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-semibold font-heading text-gray-800 group-hover:text-sky-700 transition-colors">{row.name}</span>
                      <HaptiqBadge demand={row.is_haptiq_demand} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-body text-gray-600"><Users size={11} className="text-gray-400" />{row.count}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round((row.count / max) * 100)}%`, backgroundColor: BAR_COLORS[idx % BAR_COLORS.length] }} />
                        </div>
                        <span className="text-[11px] text-gray-400 font-body w-8 shrink-0">{Math.round((row.count / max) * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><ChevronRight size={14} className="text-gray-300 group-hover:text-sky-400 transition-colors" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function SkillsMatrixPage() {
  const { activeCycle, allCycles } = useCycle();
  const [activeTab, setActiveTab] = useState<TabId>('languages');
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('count');
  const [exporting, setExporting] = useState(false);
  const [demandFilter, setDemandFilter] = useState<DemandFilter>('all');
  const [drill, setDrill] = useState<DrillState | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | 'current'>('current');

  const isViewingHistory = selectedCycleId !== 'current';

  // When there's no active cycle, default to the most recently closed cycle
  useEffect(() => {
    if (!activeCycle) {
      const lastClosed = allCycles
        .filter((c) => c.status === 'closed')
        .sort((a, b) => new Date(b.closed_at ?? b.created_at).getTime() - new Date(a.closed_at ?? a.created_at).getTime())[0];
      if (lastClosed) setSelectedCycleId(lastClosed.id);
    } else {
      setSelectedCycleId('current');
    }
  }, [activeCycle, allCycles]);

  async function handleExport() {
    setExporting(true);
    try { await exportSkillsMatrix(); } catch (err) { console.error(err); } finally { setExporting(false); }
  }

  useEffect(() => {
    loadData(selectedCycleId === 'current' ? null : selectedCycleId);
  }, [selectedCycleId]);

  async function loadData(cycleId: string | null) {
    setLoading(true);

    if (cycleId) {
      // Load from skill_form_versions snapshots for a closed cycle
      const [{ data: versions }, langRes, fwRes, toolRes, dbRes, certRes] = await Promise.all([
        db.from('skill_form_versions').select('snapshot').eq('cycle_id', cycleId),
        db.from('settings_languages').select('name, is_haptiq_demand'),
        db.from('settings_frameworks').select('name, is_haptiq_demand'),
        db.from('settings_tools').select('name, is_haptiq_demand'),
        db.from('settings_databases').select('name, is_haptiq_demand'),
        db.from('settings_certifications').select('name, is_haptiq_demand'),
      ]);

      const snapshots = (versions ?? []).map((v) => v.snapshot as Record<string, unknown>);

      const demandMap = {
        language:       new Map((langRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
        framework:      new Map((fwRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
        tools:          new Map((toolRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
        databases:      new Map((dbRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
        certifications: new Map((certRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
      };

      function aggregateSnapshotItems(category: 'language' | 'framework'): SkillStat[] {
        const map = new Map<string, { emp: number[]; mgr: number[]; dist: number[] }>();
        snapshots.forEach((snap) => {
          const skills = (snap.skill_items as { category: string; name: string; employee_rating: number | null; manager_rating: number | null }[] | null) ?? [];
          skills.filter((i) => i.category === category && i.employee_rating !== null).forEach((i) => {
            if (!map.has(i.name)) map.set(i.name, { emp: [], mgr: [], dist: [0, 0, 0, 0] });
            const entry = map.get(i.name)!;
            const er = Number(i.employee_rating);
            entry.emp.push(er);
            if (i.manager_rating !== null) entry.mgr.push(Number(i.manager_rating));
            if (er >= 1 && er <= 4) entry.dist[er - 1]++;
          });
        });
        const result: SkillStat[] = [];
        map.forEach((v, name) => {
          const avg_emp = v.emp.length ? v.emp.reduce((a, b) => a + b, 0) / v.emp.length : 0;
          const avg_mgr = v.mgr.length ? v.mgr.reduce((a, b) => a + b, 0) / v.mgr.length : 0;
          result.push({
            name, count: v.emp.length,
            avg_employee: Math.round(avg_emp * 100) / 100,
            avg_manager: Math.round(avg_mgr * 100) / 100,
            beginner: v.dist[0], intermediate: v.dist[1], advanced: v.dist[2], expert: v.dist[3],
            is_haptiq_demand: demandMap[category].get(name) ?? false,
          });
        });
        return result.sort((a, b) => b.count - a.count);
      }

      function aggregateSnapshotText(field: 'tools' | 'databases'): SimpleStat[] {
        const map = new Map<string, number>();
        snapshots.forEach((snap) => {
          const raw = (snap[field] as string) ?? '';
          raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((t) => { map.set(t, (map.get(t) ?? 0) + 1); });
        });
        return Array.from(map.entries()).map(([name, count]) => ({ name, count, is_haptiq_demand: demandMap[field].get(name) ?? false })).sort((a, b) => b.count - a.count);
      }

      function aggregateSnapshotCerts(): SimpleStat[] {
        const map = new Map<string, number>();
        snapshots.forEach((snap) => {
          const certs = (snap.certifications as string[]) ?? [];
          certs.filter(Boolean).forEach((c) => { const t = c.trim(); if (t) map.set(t, (map.get(t) ?? 0) + 1); });
        });
        return Array.from(map.entries()).map(([name, count]) => ({ name, count, is_haptiq_demand: demandMap.certifications.get(name) ?? false })).sort((a, b) => b.count - a.count);
      }

      setData({
        languages: aggregateSnapshotItems('language'),
        frameworks: aggregateSnapshotItems('framework'),
        tools: aggregateSnapshotText('tools'),
        databases: aggregateSnapshotText('databases'),
        certifications: aggregateSnapshotCerts(),
        totalForms: snapshots.length,
        approvedForms: snapshots.length,
      });
      setLoading(false);
      return;
    }

    const [formsRes, itemsRes, langRes, fwRes, toolRes, dbRes, certRes] = await Promise.all([
      db.from('skill_forms').select('id, status, tools, databases, certifications'),
      db.from('skill_items').select('category, name, employee_rating, manager_rating'),
      db.from('settings_languages').select('name, is_haptiq_demand'),
      db.from('settings_frameworks').select('name, is_haptiq_demand'),
      db.from('settings_tools').select('name, is_haptiq_demand'),
      db.from('settings_databases').select('name, is_haptiq_demand'),
      db.from('settings_certifications').select('name, is_haptiq_demand'),
    ]);

    const forms = formsRes.data ?? [];
    const items = itemsRes.data ?? [];

    const demandMap = {
      language:       new Map((langRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
      framework:      new Map((fwRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
      tools:          new Map((toolRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
      databases:      new Map((dbRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
      certifications: new Map((certRes.data ?? []).map((r) => [r.name, r.is_haptiq_demand as boolean])),
    };

    function aggregateSkillItems(category: 'language' | 'framework'): SkillStat[] {
      const map = new Map<string, { emp: number[]; mgr: number[]; dist: number[] }>();
      items.filter((i) => i.category === category && i.employee_rating !== null).forEach((i) => {
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
          name, count: v.emp.length,
          avg_employee: Math.round(avg_emp * 100) / 100,
          avg_manager: Math.round(avg_mgr * 100) / 100,
          beginner: v.dist[0], intermediate: v.dist[1], advanced: v.dist[2], expert: v.dist[3],
          is_haptiq_demand: demandMap[category].get(name) ?? false,
        });
      });
      return result.sort((a, b) => b.count - a.count);
    }

    function aggregateText(field: 'tools' | 'databases'): SimpleStat[] {
      const map = new Map<string, number>();
      forms.forEach((f) => {
        const raw: string = f[field] ?? '';
        raw.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((t: string) => { map.set(t, (map.get(t) ?? 0) + 1); });
      });
      return Array.from(map.entries()).map(([name, count]) => ({ name, count, is_haptiq_demand: demandMap[field].get(name) ?? false })).sort((a, b) => b.count - a.count);
    }

    function aggregateCertifications(): SimpleStat[] {
      const map = new Map<string, number>();
      forms.forEach((f) => {
        const certs: string[] = f.certifications ?? [];
        certs.filter(Boolean).forEach((c: string) => { const t = c.trim(); if (t) map.set(t, (map.get(t) ?? 0) + 1); });
      });
      return Array.from(map.entries()).map(([name, count]) => ({ name, count, is_haptiq_demand: demandMap.certifications.get(name) ?? false })).sort((a, b) => b.count - a.count);
    }

    setData({
      languages: aggregateSkillItems('language'),
      frameworks: aggregateSkillItems('framework'),
      tools: aggregateText('tools'),
      databases: aggregateText('databases'),
      certifications: aggregateCertifications(),
      totalForms: forms.length,
      approvedForms: forms.filter((f) => f.status === 'approved').length,
    });
    setLoading(false);
  }

  const filteredData = useMemo<MatrixData | null>(() => {
    if (!data) return null;
    return {
      ...data,
      languages:      applyDemandFilter(data.languages, demandFilter),
      frameworks:     applyDemandFilter(data.frameworks, demandFilter),
      tools:          applyDemandFilter(data.tools, demandFilter),
      databases:      applyDemandFilter(data.databases, demandFilter),
      certifications: applyDemandFilter(data.certifications, demandFilter),
    };
  }, [data, demandFilter]);

  const topLanguages = useMemo(() => (filteredData?.languages ?? []).slice(0, 8).map((l, i) => ({ name: l.name, 'Self Rating': l.avg_employee, fill: BAR_COLORS[i % BAR_COLORS.length] })), [filteredData]);
  const topFrameworks = useMemo(() => (filteredData?.frameworks ?? []).slice(0, 8).map((f, i) => ({ name: f.name, 'Self Rating': f.avg_employee, fill: TEAL_COLORS[i % TEAL_COLORS.length] })), [filteredData]);
  const radarData = useMemo(() => (filteredData?.languages ?? []).slice(0, 5).map((l) => ({ skill: l.name, Self: l.avg_employee, Manager: l.avg_manager })), [filteredData]);

  const totalSkills = (data?.languages.length ?? 0) + (data?.frameworks.length ?? 0) + (data?.tools.length ?? 0) + (data?.databases.length ?? 0) + (data?.certifications.length ?? 0);

  function getTabLabel(tab: TabId) { return TAB_CONFIG.find((t) => t.id === tab)?.label ?? tab; }

  function drillToSkillList(tab: TabId) {
    setDrill({ level: 'skill-list', tab, tabLabel: getTabLabel(tab) });
  }

  function drillToEmployees(tab: TabId, skillName: string) {
    setDrill({ level: 'employee-list', tab, tabLabel: getTabLabel(tab), skillName });
  }

  const SUMMARY_CARDS = [
    { label: 'Total Forms',    value: data?.totalForms ?? 0,         icon: Users,      color: 'text-primary-500', bg: 'bg-primary-50',  border: 'border-primary-100' },
    { label: 'Approved Forms', value: data?.approvedForms ?? 0,      icon: Star,       color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
    { label: 'Unique Skills',  value: totalSkills,                    icon: TrendingUp, color: 'text-sky-600',     bg: 'bg-sky-50',      border: 'border-sky-100' },
    { label: 'Languages',      value: data?.languages.length ?? 0,   icon: Code2,      color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-100' },
    { label: 'Frameworks',     value: data?.frameworks.length ?? 0,  icon: Layers,     color: 'text-teal-600',    bg: 'bg-teal-50',     border: 'border-teal-100' },
    { label: 'Certifications', value: data?.certifications.length ?? 0, icon: Award,   color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
  ];

  // ── Drill-down renders ────────────────────────────────────────────────────
  if (drill?.level === 'employee-list' && drill.skillName) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto">
          <EmployeeListView
            tab={drill.tab}
            tabLabel={drill.tabLabel}
            skillName={drill.skillName}
            onBack={() => setDrill(null)}
            onBackToSkillList={() => setDrill({ level: 'skill-list', tab: drill.tab, tabLabel: drill.tabLabel })}
          />
        </div>
      </AppShell>
    );
  }

  if (drill?.level === 'skill-list' && filteredData) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto">
          <SkillListView
            tab={drill.tab}
            tabLabel={drill.tabLabel}
            data={filteredData}
            onSkillClick={(skillName) => drillToEmployees(drill.tab, skillName)}
            onBack={() => setDrill(null)}
          />
        </div>
      </AppShell>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Skills Matrix</h1>
            <p className="text-sm text-gray-500 font-body mt-1">Aggregated skill statistics across all submitted employee forms.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <CycleSelectorDropdown
              cycles={allCycles}
              activeCycle={activeCycle}
              selectedId={selectedCycleId}
              onChange={(id) => { setSelectedCycleId(id); setDrill(null); }}
            />
            <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
              {DEMAND_FILTERS.map((f) => (
                <button key={f.id} onClick={() => setDemandFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading transition-all ${
                    demandFilter === f.id ? (f.id === 'haptiq' ? 'bg-sky-500 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm') : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {f.id === 'haptiq' && <Zap size={10} className={demandFilter === 'haptiq' ? 'fill-white' : 'fill-gray-400'} />}
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={handleExport} disabled={exporting || loading || !data}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={15} />Download
            </button>
          </div>
        </div>

        {isViewingHistory && (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-sm text-sky-800">
            <TrendingUp size={15} className="text-sky-500 shrink-0" />
            <p>
              Viewing archived skills data from{' '}
              <span className="font-semibold">
                {allCycles.find((c) => c.id === selectedCycleId)?.name ?? 'a previous cycle'}
              </span>
              {' '}&mdash; based on approved assessment snapshots.
            </p>
          </div>
        )}

        {/* Summary cards */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <Skeleton className="w-9 h-9 rounded-xl" /><Skeleton className="h-7 w-12" /><Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {SUMMARY_CARDS.map((c) => (
              <div key={c.label} className={`bg-white rounded-2xl border ${c.border} p-5 shadow-sm`}>
                <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}><c.icon size={16} className={c.color} /></div>
                <p className="font-heading font-bold text-xl text-gray-900">{c.value}</p>
                <p className="text-[11px] text-gray-500 font-body mt-0.5 leading-tight">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        {!loading && filteredData && (topLanguages.length > 0 || topFrameworks.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {topLanguages.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-heading font-semibold text-sm text-gray-700 flex items-center gap-2"><Code2 size={14} className="text-sky-500" />Top Languages</p>
                  <button onClick={() => drillToSkillList('languages')} className="text-[11px] font-semibold font-heading text-sky-500 hover:text-sky-700 hover:underline transition-colors">View all →</button>
                </div>
                <p className="text-[10px] text-gray-400 font-body mb-3">Click a bar to see employees for that language</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topLanguages} layout="vertical" margin={{ left: 0, right: 20 }} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" domain={[0, 4]} tickCount={5} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={90} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2), 'Avg Self Rating']} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} cursor={{ fill: '#f0f9ff' }} />
                    <Bar dataKey="Self Rating" radius={[0, 4, 4, 0]} onClick={(d) => drillToEmployees('languages', d.name)}>
                      {topLanguages.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {topFrameworks.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-heading font-semibold text-sm text-gray-700 flex items-center gap-2"><Layers size={14} className="text-teal-500" />Top Frameworks</p>
                  <button onClick={() => drillToSkillList('frameworks')} className="text-[11px] font-semibold font-heading text-teal-500 hover:text-teal-700 hover:underline transition-colors">View all →</button>
                </div>
                <p className="text-[10px] text-gray-400 font-body mb-3">Click a bar to see employees for that framework</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topFrameworks} layout="vertical" margin={{ left: 0, right: 20 }} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" domain={[0, 4]} tickCount={5} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={90} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2), 'Avg Self Rating']} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} cursor={{ fill: '#f0fdfa' }} />
                    <Bar dataKey="Self Rating" radius={[0, 4, 4, 0]} onClick={(d) => drillToEmployees('frameworks', d.name)}>
                      {topFrameworks.map((_, i) => <Cell key={i} fill={TEAL_COLORS[i % TEAL_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {radarData.length >= 3 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-heading font-semibold text-sm text-gray-700 flex items-center gap-2"><Star size={14} className="text-amber-500" />Top 5 Languages — Self vs Manager Rating</p>
                  <button onClick={() => drillToSkillList('languages')} className="text-[11px] font-semibold font-heading text-sky-500 hover:text-sky-700 hover:underline transition-colors">View all →</button>
                </div>
                <p className="text-[10px] text-gray-400 font-body mb-3">Click a spoke label or use "View all" to drill in</p>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: '#374151', cursor: 'pointer' }}
                      onClick={(e: { value: string }) => drillToEmployees('languages', e.value)} />
                    <Radar name="Self" dataKey="Self" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} dot={{ r: 3 }} />
                    <Radar name="Manager" dataKey="Manager" stroke="#10b981" fill="#10b981" fillOpacity={0.15} dot={{ r: 3 }} />
                    <Tooltip formatter={(v: number) => v.toFixed(2)} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <span className="flex items-center gap-1.5 text-xs font-body text-gray-500"><span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />Self Rating</span>
                  <span className="flex items-center gap-1.5 text-xs font-body text-gray-500"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Manager Rating</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detailed breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-0 border-b border-gray-100">
            <div className="flex gap-1 overflow-x-auto pb-0">
              {TAB_CONFIG.map((t) => {
                const active = activeTab === t.id;
                const Icon = t.icon;
                const count = filteredData ? (filteredData[t.id] as { length: number }).length : 0;
                return (
                  <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(''); setSort('count'); }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold font-heading whitespace-nowrap border-b-2 transition-all ${active ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Icon size={13} />
                    {t.label}
                    {!loading && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-body ${active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>{count}</span>
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
                  <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-10" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : !filteredData ? null : (
            <MatrixTable
              activeTab={activeTab}
              filteredData={filteredData}
              search={search}
              setSearch={setSearch}
              sort={sort}
              setSort={setSort}
              onSkillClick={(skillName) => drillToEmployees(activeTab, skillName)}
              activeTabLabel={getTabLabel(activeTab)}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
