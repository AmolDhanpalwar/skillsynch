import { useEffect, useState, useRef } from 'react';
import {
  Award,
  Code2,
  Layers,
  Wrench,
  Database,
  Server,
  Star,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  Download,
  Loader2,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { Skeleton } from '../components/ui/Skeleton';
import { db } from '../lib/db';
import { exportSkillSettings } from '../lib/exportService';

type TableName =
  | 'settings_certifications'
  | 'settings_languages'
  | 'settings_frameworks'
  | 'settings_tools'
  | 'settings_databases'
  | 'settings_environments';

interface SettingItem {
  id: string;
  name: string;
  is_active: boolean;
  is_haptiq_demand: boolean;
  created_at: string;
}

type TabId = 'certifications' | 'languages' | 'frameworks' | 'tools' | 'databases' | 'environments' | 'ratings';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
  table: TableName;
  description: string;
  placeholder: string;
}

const TABS: TabConfig[] = [
  {
    id: 'certifications',
    label: 'Certifications',
    icon: Award,
    table: 'settings_certifications',
    description: 'Manage the list of certifications employees can select in their skill form.',
    placeholder: 'e.g. AWS Certified Solutions Architect',
  },
  {
    id: 'languages',
    label: 'Languages',
    icon: Code2,
    table: 'settings_languages',
    description: 'Manage programming languages shown in the skills section.',
    placeholder: 'e.g. TypeScript',
  },
  {
    id: 'frameworks',
    label: 'Frameworks',
    icon: Layers,
    table: 'settings_frameworks',
    description: 'Manage frameworks and libraries available in the skills section.',
    placeholder: 'e.g. Next.js',
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    table: 'settings_tools',
    description: 'Manage tools and technologies employees can list in their profile.',
    placeholder: 'e.g. Docker',
  },
  {
    id: 'databases',
    label: 'Databases',
    icon: Database,
    table: 'settings_databases',
    description: 'Manage database technologies available in the skill form.',
    placeholder: 'e.g. PostgreSQL',
  },
  {
    id: 'environments',
    label: 'Additional Skills',
    icon: Server,
    table: 'settings_environments',
    description: 'Manage environment, infrastructure, OS, and management system options for the Additional Skills step.',
    placeholder: 'e.g. Kubernetes',
  },
];

type FilterStatus = 'all' | 'active' | 'inactive';

function useSettingsData(table: TableName) {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetch() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await db
      .from(table)
      .select('id, name, is_active, is_haptiq_demand, created_at')
      .order('name', { ascending: true });
    if (err) setError(err.message);
    else setItems((data as SettingItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, [table]);

  return { items, loading, error, refetch: fetch, setItems };
}

interface SettingsPanelProps {
  tab: TabConfig & { table: TableName; placeholder: string };
}

function SettingsPanel({ tab }: SettingsPanelProps) {
  const { items, loading, error, setItems } = useSettingsData(tab.table);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch('');
    setFilter('all');
    setNewName('');
    setAddError(null);
    setEditId(null);
  }, [tab.id]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = items.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && item.is_active) ||
      (filter === 'inactive' && !item.is_active);
    return matchSearch && matchFilter;
  });

  const activeCount = items.filter((i) => i.is_active).length;
  const inactiveCount = items.filter((i) => !i.is_active).length;

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) { setAddError('Name is required.'); return; }
    if (items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      setAddError('This entry already exists.');
      return;
    }
    setAdding(true);
    setAddError(null);
    const { data, error: err } = await supabase
      .from(tab.table)
      .insert({ name: trimmed })
      .select('id, name, is_active, created_at')
      .single();
    if (err) {
      setAddError(err.message);
    } else {
      setItems((prev) => [...prev, data as SettingItem].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      addInputRef.current?.focus();
    }
    setAdding(false);
  }

  async function handleToggle(item: SettingItem) {
    setSavingId(item.id);
    const { error: err } = await supabase
      .from(tab.table)
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (!err) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i))
      );
    }
    setSavingId(null);
  }

  async function handleDemandToggle(item: SettingItem) {
    setSavingId(item.id);
    const { error: err } = await supabase
      .from(tab.table)
      .update({ is_haptiq_demand: !item.is_haptiq_demand })
      .eq('id', item.id);
    if (!err) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_haptiq_demand: !i.is_haptiq_demand } : i))
      );
    }
    setSavingId(null);
  }

  function startEdit(item: SettingItem) {
    setEditId(item.id);
    setEditName(item.name);
    setEditError(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditId(null);
    setEditName('');
    setEditError(null);
  }

  async function handleSaveEdit(item: SettingItem) {
    const trimmed = editName.trim();
    if (!trimmed) { setEditError('Name is required.'); return; }
    if (
      trimmed.toLowerCase() !== item.name.toLowerCase() &&
      items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      setEditError('This name already exists.');
      return;
    }
    setSavingId(item.id);
    setEditError(null);
    const { error: err } = await supabase
      .from(tab.table)
      .update({ name: trimmed })
      .eq('id', item.id);
    if (err) {
      setEditError(err.message);
      setSavingId(null);
      return;
    }
    setItems((prev) =>
      prev
        .map((i) => (i.id === item.id ? { ...i, name: trimmed } : i))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditId(null);
    setSavingId(null);
  }

  const filterLabel: Record<FilterStatus, string> = {
    all: 'All',
    active: 'Active',
    inactive: 'Inactive',
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 font-body">{tab.description}</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-body text-gray-600 bg-white hover:bg-gray-50 transition-colors"
              >
                <span>{filterLabel[filter]}</span>
                <ChevronDown size={13} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
              </button>
              {filterOpen && (
                <div className="absolute right-0 mt-1.5 w-32 bg-white rounded-xl border border-gray-100 shadow-lg z-10 overflow-hidden">
                  {(['all', 'active', 'inactive'] as FilterStatus[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => { setFilter(f); setFilterOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-body transition-colors ${
                        filter === f ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {filterLabel[f]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs font-body text-gray-400 shrink-0">
              <span className="text-emerald-600 font-semibold">{activeCount} active</span>
              <span>·</span>
              <span className="text-gray-400">{inactiveCount} inactive</span>
              <span>·</span>
              <span className="text-sky-600 font-semibold">{items.filter((i) => i.is_haptiq_demand).length} in demand</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
          <div className="flex items-center gap-2">
            <input
              ref={addInputRef}
              type="text"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder={tab.placeholder}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-body text-gray-700 placeholder-gray-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors bg-white"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold font-heading transition-colors shadow-sm shadow-primary-200 shrink-0"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {addError && (
            <p className="flex items-center gap-1.5 text-xs text-red-500 font-body mt-2">
              <AlertCircle size={12} />
              {addError}
            </p>
          )}
        </div>

        {/* Column header */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100">
            <span className="flex-1 text-[11px] font-bold font-heading uppercase tracking-wider text-gray-400">Name</span>
            <span className="w-24 text-center text-[11px] font-bold font-heading uppercase tracking-wider text-sky-500 shrink-0">Haptiq Demand</span>
            <span className="w-16 text-center text-[11px] font-bold font-heading uppercase tracking-wider text-gray-400 shrink-0">Status</span>
            <span className="w-6 shrink-0" />
            <span className="w-20 shrink-0" />
          </div>
        )}

        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="h-4 flex-1 max-w-xs" />
                <Skeleton className="h-5 w-5 rounded mx-auto" />
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-5 py-8 text-red-500 text-sm font-body">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <tab.icon size={24} className="text-gray-200 mb-2" />
            <p className="text-sm text-gray-400 font-body">
              {search ? 'No results match your search.' : 'No entries yet. Add one above.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((item) => {
              const isEditing = editId === item.id;
              const isSaving = savingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    !item.is_active ? 'bg-gray-50/60' : 'hover:bg-gray-50/40'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => { setEditName(e.target.value); setEditError(null); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(item);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-primary-300 text-sm font-body text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-100 transition-colors"
                        />
                        {editError && (
                          <p className="flex items-center gap-1 text-[11px] text-red-500 font-body mt-1">
                            <AlertCircle size={10} />
                            {editError}
                          </p>
                        )}
                      </div>
                      <span className="w-24 shrink-0" />
                      <button
                        onClick={() => handleSaveEdit(item)}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold font-heading transition-colors shrink-0"
                      >
                        <Check size={12} />Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs font-semibold font-heading transition-colors shrink-0"
                      >
                        <X size={12} />Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 min-w-0 text-sm font-body truncate ${item.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {item.name}
                      </span>

                      {/* HaptiqDemand checkbox — column-aligned */}
                      <div className="w-24 flex justify-center shrink-0">
                        <input
                          type="checkbox"
                          checked={item.is_haptiq_demand}
                          onChange={() => handleDemandToggle(item)}
                          disabled={isSaving}
                          title="Mark as Haptiq Demand"
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-sky-500 disabled:opacity-50"
                        />
                      </div>

                      <span className={`w-16 text-center shrink-0 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full border ${
                        item.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button onClick={() => startEdit(item)} className="w-6 flex justify-center p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors shrink-0" title="Edit name">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={isSaving}
                        className={`w-20 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold font-heading border transition-colors shrink-0 disabled:opacity-50 ${
                          item.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {item.is_active ? <><ToggleRight size={13} />Deactivate</> : <><ToggleLeft size={13} />Activate</>}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skill Ratings Panel ──────────────────────────────────────────────────────

interface RatingItem {
  id: string;
  sort_order: number;
  label: string;
  is_active: boolean;
}

function SkillRatingsPanel() {
  const [items, setItems] = useState<RatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  async function fetchItems() {
    setLoading(true);
    const { data } = await supabase
      .from('settings_skill_ratings')
      .select('id, sort_order, label, is_active')
      .order('sort_order');
    setItems((data as RatingItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, []);

  function startEdit(item: RatingItem) {
    setEditId(item.id);
    setEditLabel(item.label);
    setEditError(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditId(null);
    setEditLabel('');
    setEditError(null);
  }

  async function handleSaveEdit(item: RatingItem) {
    const trimmed = editLabel.trim();
    if (!trimmed) { setEditError('Label is required'); return; }
    if (items.some((i) => i.id !== item.id && i.label.toLowerCase() === trimmed.toLowerCase())) {
      setEditError('Label already exists'); return;
    }
    setSavingId(item.id);
    const { error } = await db.from('settings_skill_ratings').update({ label: trimmed }).eq('id', item.id);
    if (error) { setEditError(error.message); } else {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, label: trimmed } : i));
      cancelEdit();
    }
    setSavingId(null);
  }

  async function handleToggle(item: RatingItem) {
    setSavingId(item.id);
    const { error } = await db.from('settings_skill_ratings').update({ is_active: !item.is_active }).eq('id', item.id);
    if (!error) setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_active: !item.is_active } : i));
    setSavingId(null);
  }

  async function handleAdd() {
    const trimmed = newLabel.trim();
    if (!trimmed) { setAddError('Label is required'); return; }
    if (items.some((i) => i.label.toLowerCase() === trimmed.toLowerCase())) {
      setAddError('Label already exists'); return;
    }
    setAdding(true);
    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('settings_skill_ratings')
      .insert({ sort_order: nextOrder, label: trimmed, is_active: true })
      .select('id, sort_order, label, is_active')
      .single();
    if (error) { setAddError(error.message); } else {
      setItems((prev) => [...prev, data as RatingItem]);
      setNewLabel('');
      setAddError(null);
    }
    setAdding(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Star size={15} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-sm text-gray-800">Self-Rating Scale</h2>
            <p className="text-xs text-gray-400 font-body mt-0.5">
              Manage the rating levels shown to employees in the Self-Rating dropdown across Steps 2 &amp; 3.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs font-body text-gray-400">
          <span className="font-semibold text-emerald-600">{items.filter((i) => i.is_active).length} active</span>
          <span>·</span>
          <span>{items.filter((i) => !i.is_active).length} inactive</span>
        </div>
      </div>

      {/* Add new rating */}
      <div className="px-6 py-4 border-b border-gray-100 bg-amber-50/30">
        <p className="text-[11px] font-heading font-semibold text-gray-500 uppercase tracking-wide mb-2">Add New Rating Level</p>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold font-heading flex items-center justify-center shrink-0">
                {items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 1}
              </span>
              <input
                ref={addInputRef}
                type="text"
                value={newLabel}
                onChange={(e) => { setNewLabel(e.target.value); setAddError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="e.g. 6 — Advanced Expert"
                className={`flex-1 px-3 py-2 rounded-lg border text-sm font-body text-gray-700 outline-none transition-colors
                  ${addError ? 'border-red-300 bg-red-50 focus:ring-red-100' : 'border-gray-200 bg-white focus:border-primary-400 focus:ring-1 focus:ring-primary-100'}`}
              />
            </div>
            {addError && (
              <p className="flex items-center gap-1 text-[11px] text-red-500 font-body mt-1.5 ml-9">
                <AlertCircle size={10} />{addError}
              </p>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newLabel.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold font-heading transition-colors shrink-0"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-3">
              <Skeleton className="w-8 h-5 rounded" />
              <Skeleton className="flex-1 h-5 rounded" />
              <Skeleton className="w-20 h-7 rounded-lg" />
            </div>
          ))
        ) : (
          items.map((item) => {
            const isEditing = editId === item.id;
            const isSaving = savingId === item.id;
            return (
              <div key={item.id} className={`px-6 py-3 flex items-center gap-3 transition-colors ${isEditing ? 'bg-primary-50/40' : 'hover:bg-gray-50/60'}`}>
                <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold font-heading flex items-center justify-center shrink-0">
                  {item.sort_order}
                </span>
                {isEditing ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editLabel}
                        onChange={(e) => { setEditLabel(e.target.value); setEditError(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(item);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-primary-300 text-sm font-body text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-100 transition-colors"
                      />
                      {editError && (
                        <p className="flex items-center gap-1 text-[11px] text-red-500 font-body mt-1">
                          <AlertCircle size={10} />{editError}
                        </p>
                      )}
                    </div>
                    <button onClick={() => handleSaveEdit(item)} disabled={isSaving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold font-heading transition-colors shrink-0">
                      <Check size={12} />Save
                    </button>
                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs font-semibold font-heading transition-colors shrink-0">
                      <X size={12} />Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`flex-1 min-w-0 text-sm font-body truncate ${item.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {item.label}
                    </span>
                    <span className={`shrink-0 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full border ${item.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors shrink-0" title="Edit label">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleToggle(item)} disabled={isSaving} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading border transition-colors shrink-0 disabled:opacity-50 ${item.is_active ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                      {item.is_active ? <><ToggleRight size={13} />Deactivate</> : <><ToggleLeft size={13} />Activate</>}
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Nav items including ratings ─────────────────────────────────────────────

type AnyTabId = TabId;

interface NavEntry {
  id: AnyTabId;
  label: string;
  icon: React.ElementType;
  section: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { id: 'certifications', label: 'Certifications',   icon: Award,     section: 'Skill Masters' },
  { id: 'languages',      label: 'Languages',         icon: Code2,     section: 'Skill Masters' },
  { id: 'frameworks',     label: 'Frameworks',        icon: Layers,    section: 'Skill Masters' },
  { id: 'tools',          label: 'Tools',             icon: Wrench,    section: 'Skill Masters' },
  { id: 'databases',      label: 'Databases',         icon: Database,  section: 'Skill Masters' },
  { id: 'environments',   label: 'Additional Skills', icon: Server,    section: 'Skill Masters' },
  { id: 'ratings',        label: 'Self-Rating Scale', icon: Star,      section: 'Assessment' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<AnyTabId>('certifications');
  const [exporting, setExporting] = useState(false);

  const currentTab = TABS.find((t) => t.id === activeTab);

  async function handleExport() {
    setExporting(true);
    try {
      await exportSkillSettings();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  const sections = Array.from(new Set(NAV_ENTRIES.map((e) => e.section)));
  const activeEntry = NAV_ENTRIES.find((e) => e.id === activeTab);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Skills Settings</h1>
            <p className="text-sm text-gray-400 font-body mt-1">
              Manage master data for the employee skill form.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            Download
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex gap-6 items-start">

          {/* Left nav */}
          <aside className="w-52 shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
            {sections.map((section) => {
              const entries = NAV_ENTRIES.filter((e) => e.section === section);
              return (
                <div key={section}>
                  <p className="px-4 pt-4 pb-1.5 text-[10px] font-bold font-heading uppercase tracking-widest text-gray-400 select-none">
                    {section}
                  </p>
                  <ul className="pb-2">
                    {entries.map((entry) => {
                      const Icon = entry.icon;
                      const active = activeTab === entry.id;
                      return (
                        <li key={entry.id}>
                          <button
                            onClick={() => setActiveTab(entry.id)}
                            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body transition-colors text-left
                              ${active
                                ? 'bg-primary-50 text-primary-700 font-semibold border-r-2 border-primary-500'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                              }`}
                          >
                            <Icon size={14} className={active ? 'text-primary-500' : 'text-gray-400'} />
                            {entry.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {section !== sections[sections.length - 1] && (
                    <div className="mx-4 border-t border-gray-100" />
                  )}
                </div>
              );
            })}
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeEntry && (
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                  <activeEntry.icon size={15} className="text-primary-500" />
                </div>
                <div>
                  <h2 className="font-heading font-bold text-lg text-gray-900">{activeEntry.label}</h2>
                </div>
              </div>
            )}

            {activeTab === 'ratings' ? (
              <SkillRatingsPanel />
            ) : currentTab ? (
              <SettingsPanel key={activeTab} tab={currentTab} />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
