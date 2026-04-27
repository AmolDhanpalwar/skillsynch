import { useEffect, useState, useRef } from 'react';
import {
  GraduationCap,
  Briefcase,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Check,
  X,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import { Skeleton } from '../components/ui/Skeleton';
import { supabase } from '../lib/supabaseClient';

type EmpTableName = 'settings_grades' | 'settings_designations';

interface SettingItem {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

type TabId = 'grades' | 'designations';
type FilterStatus = 'all' | 'active' | 'inactive';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
  table: EmpTableName;
  description: string;
  placeholder: string;
}

const TABS: TabConfig[] = [
  {
    id: 'grades',
    label: 'Grades',
    icon: GraduationCap,
    table: 'settings_grades',
    description: 'Manage the list of employee grades shown as a searchable dropdown on the skill form.',
    placeholder: 'e.g. L3 or Senior',
  },
  {
    id: 'designations',
    label: 'Designations',
    icon: Briefcase,
    table: 'settings_designations',
    description: 'Manage the list of designations shown as a searchable dropdown on the skill form.',
    placeholder: 'e.g. Senior Software Engineer',
  },
];

function useSettingsData(table: EmpTableName) {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetch() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from(table)
      .select('id, name, is_active, created_at')
      .order('name', { ascending: true });
    if (err) setError(err.message);
    else setItems((data as SettingItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { fetch(); }, [table]);

  return { items, loading, error, setItems };
}

function SettingsPanel({ tab }: { tab: TabConfig }) {
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
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
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
      prev.map((i) => i.id === item.id ? { ...i, name: trimmed } : i)
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditId(null);
    setSavingId(null);
  }

  const filterLabel: Record<FilterStatus, string> = { all: 'All', active: 'Active', inactive: 'Inactive' };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 font-body">{tab.description}</p>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden">
        {/* Toolbar */}
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
            </div>
          </div>
        </div>

        {/* Add row */}
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

        {/* List */}
        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="h-4 flex-1 max-w-xs" />
                <Skeleton className="h-6 w-14 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-20 rounded-lg" />
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
                      <button
                        onClick={() => handleSaveEdit(item)}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold font-heading transition-colors shrink-0"
                      >
                        <Check size={12} />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs font-semibold font-heading transition-colors shrink-0"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 min-w-0 text-sm font-body truncate ${item.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {item.name}
                      </span>
                      <span className={`shrink-0 text-[11px] font-semibold font-heading px-2.5 py-1 rounded-full border ${
                        item.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 transition-colors shrink-0"
                        title="Edit name"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={isSaving}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-heading border transition-colors shrink-0 disabled:opacity-50 ${
                          item.is_active
                            ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {item.is_active
                          ? <><ToggleRight size={13} /> Deactivate</>
                          : <><ToggleLeft size={13} /> Activate</>
                        }
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

export default function EmpSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('grades');
  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-gray-900">Emp Settings</h1>
          <p className="text-sm text-gray-400 font-body mt-1">
            Manage grade and designation lists shown to employees on their skill form.
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-heading whitespace-nowrap transition-all flex-1 justify-center ${
                  active
                    ? 'bg-white text-primary-600 shadow-sm shadow-gray-200/80'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <SettingsPanel key={activeTab} tab={currentTab} />
      </div>
    </AppShell>
  );
}
