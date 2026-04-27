import { useEffect, useRef, useState } from 'react';
import { Trash2, Lock, Search, X, ChevronDown, Loader2 } from 'lucide-react';
import type { SkillRow, SkillRating, Step2Values } from '../../types/form';
import { SKILL_RATING_OPTIONS, makeSkillRow } from '../../types/form';
import { supabase } from '../../lib/supabaseClient';

interface Step2SkillsProps {
  values: Step2Values;
  onChange: (values: Step2Values) => void;
}

// ─── Supabase fetch ──────────────────────────────────────────────────────────

async function fetchMasterList(table: string): Promise<string[]> {
  const { data } = await supabase
    .from(table)
    .select('name')
    .eq('is_active', true)
    .order('name');
  return (data ?? []).map((r: { name: string }) => r.name);
}

// ─── Shared sub-components ───────────────────────────────────────────────────

const LOCKED_CELL = 'bg-[#F3F4F6] text-gray-400 cursor-not-allowed';

function RatingSelect({
  value,
  onChange,
  locked,
}: {
  value: SkillRating | null;
  onChange?: (v: SkillRating) => void;
  locked?: boolean;
}) {
  return (
    <div className="relative">
      <select
        disabled={locked}
        value={value ?? ''}
        onChange={(e) => onChange?.(Number(e.target.value) as SkillRating)}
        className={`w-full px-2.5 py-2 rounded-lg border text-xs font-body appearance-none pr-7 outline-none transition-colors
          ${locked
            ? `${LOCKED_CELL} border-gray-200`
            : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100'
          }`}
      >
        <option value="" disabled>Select…</option>
        {SKILL_RATING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {!locked && (
        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      )}
      {locked && (
        <Lock size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
      )}
    </div>
  );
}

function LockedTextarea({ value }: { value: string }) {
  return (
    <div className="relative">
      <textarea
        disabled
        value={value}
        rows={1}
        className={`w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs font-body resize-none outline-none ${LOCKED_CELL}`}
        placeholder="—"
      />
      <Lock size={10} className="absolute right-2 top-2.5 text-gray-300 pointer-events-none" />
    </div>
  );
}

// ─── Skill Name Picker ───────────────────────────────────────────────────────
// Dropdown restricted to items from the admin master list.
// Duplicate names already in the table are filtered out.

interface SkillNamePickerProps {
  value: string;
  masterList: string[];
  usedNames: string[];        // other rows' names to exclude
  isNew: boolean;             // seed rows are read-only
  onChange: (name: string) => void;
  error?: string;
}

function SkillNamePicker({ value, masterList, usedNames, isNew, onChange, error }: SkillNamePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // available = master list minus already-used names (case-insensitive), but keep current value
  const available = masterList.filter(
    (n) =>
      !usedNames.some((u) => u.trim().toLowerCase() === n.toLowerCase()) ||
      n.toLowerCase() === value.toLowerCase(),
  );

  const filtered = query.trim()
    ? available.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : available;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isNew) {
    return <span className="text-sm font-body text-gray-800">{value}</span>;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs font-body outline-none transition-colors text-left
          ${error ? 'border-red-300 bg-white' : open ? 'border-primary-400 ring-1 ring-primary-100 bg-white' : 'border-gray-200 bg-white hover:border-primary-300'}
          ${!value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate">{value || 'Select skill…'}</span>
        {value ? (
          <X
            size={12}
            className="shrink-0 text-gray-400 hover:text-gray-600"
            onMouseDown={(e) => {
              e.stopPropagation();
              onChange('');
              setOpen(false);
            }}
          />
        ) : (
          <ChevronDown size={12} className="shrink-0 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[180px] bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-2 py-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 text-xs font-body text-gray-700 bg-transparent outline-none placeholder-gray-400"
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 font-body text-center">No options available</p>
            ) : (
              filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => {
                    onChange(name);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-body transition-colors
                    ${name === value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="text-[10px] text-red-500 font-body mt-0.5">{error}</p>}
    </div>
  );
}

// ─── Skill Table ─────────────────────────────────────────────────────────────

interface SkillTableProps {
  rows: SkillRow[];
  masterList: string[];
  loading: boolean;
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChangeName: (id: string, name: string) => void;
  onChangeRating: (id: string, rating: SkillRating) => void;
  duplicateIds: Set<string>;
}

function SkillTable({
  rows,
  masterList,
  loading,
  addLabel,
  onAdd,
  onRemove,
  onChangeName,
  onChangeRating,
  duplicateIds,
}: SkillTableProps) {
  // Names used by other rows (for exclusion from picker)
  function otherNames(currentId: string) {
    return rows.filter((r) => r.id !== currentId).map((r) => r.name);
  }

  // Can we add another row? Only if all new rows have a name selected
  const canAdd = !loading && rows.filter((r) => !r.is_seed).every((r) => r.name.trim() !== '');

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full min-w-[580px] text-left border-collapse">
          <thead>
            <tr className="bg-[#F0F7FA] sticky top-0 z-10">
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[34%]">
                Skill Name
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[20%]">
                Self-Rating
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide w-[20%]">
                <span className="flex items-center gap-1">
                  <Lock size={10} className="text-gray-300" />
                  Manager Rating
                </span>
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide w-[26%]">
                <span className="flex items-center gap-1">
                  <Lock size={10} className="text-gray-300" />
                  Manager Comment
                </span>
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-t border-gray-100 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-[#F0F7FA]/40'
                }`}
              >
                <td className="px-4 py-2.5">
                  <SkillNamePicker
                    value={row.name}
                    masterList={masterList}
                    usedNames={otherNames(row.id)}
                    isNew={!row.is_seed}
                    onChange={(name) => onChangeName(row.id, name)}
                    error={duplicateIds.has(row.id) ? 'Duplicate' : undefined}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <RatingSelect
                    value={row.employee_rating}
                    onChange={(v) => onChangeRating(row.id, v)}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <RatingSelect value={row.manager_rating} locked />
                </td>
                <td className="px-4 py-2.5">
                  <LockedTextarea value={row.manager_comment} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  {!row.is_seed && (
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold font-heading text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        )}
        {addLabel}
      </button>
    </div>
  );
}

// ─── Tag Picker ───────────────────────────────────────────────────────────────
// Used for Tools and Databases — comma-string <-> string[] bridged here.

interface TagPickerProps {
  value: string;           // comma-separated string from Step2Values
  onChange: (v: string) => void;
  masterList: string[];
  loading: boolean;
  placeholder: string;
  color: 'amber' | 'rose';
}

function TagPicker({ value, onChange, masterList, loading, placeholder, color }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected: string[] = value
    ? value.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  function toggle(name: string) {
    const lower = name.toLowerCase();
    const exists = selected.some((s) => s.toLowerCase() === lower);
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== lower)
      : [...selected, name];
    onChange(next.join(', '));
  }

  function removeTag(name: string) {
    onChange(selected.filter((s) => s.toLowerCase() !== name.toLowerCase()).join(', '));
  }

  const available = masterList.filter(
    (n) => !selected.some((s) => s.toLowerCase() === n.toLowerCase()),
  );
  const filtered = query.trim()
    ? masterList.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : masterList;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tagBg = color === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-rose-50 border-rose-200 text-rose-800';
  const tagX = color === 'amber' ? 'text-amber-500 hover:text-amber-700' : 'text-rose-400 hover:text-rose-600';
  const btnBg = color === 'amber'
    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100';

  return (
    <div ref={containerRef}>
      {/* Tag display */}
      <div
        className={`min-h-[42px] w-full px-3 py-2 rounded-xl border bg-white flex flex-wrap gap-1.5 items-center cursor-pointer transition-colors
          ${open ? 'border-primary-400 ring-1 ring-primary-100' : 'border-gray-200 hover:border-gray-300'}`}
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        {selected.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold font-heading ${tagBg}`}
          >
            {tag}
            <button
              type="button"
              onMouseDown={(e) => { e.stopPropagation(); removeTag(tag); }}
              className={`transition-colors ${tagX}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-sm font-body text-gray-400">{placeholder}</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-400 font-body shrink-0">
          {loading && <Loader2 size={12} className="animate-spin" />}
          {available.length > 0 && !loading && (
            <span className="text-[10px] text-gray-400">+{available.length} more</span>
          )}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-20 relative">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-sm font-body text-gray-700 bg-transparent outline-none placeholder-gray-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto p-2 flex flex-wrap gap-1.5">
            {filtered.length === 0 ? (
              <p className="w-full text-xs text-gray-400 font-body text-center py-4">No options found</p>
            ) : (
              filtered.map((name) => {
                const isSelected = selected.some((s) => s.toLowerCase() === name.toLowerCase());
                return (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => toggle(name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold font-heading transition-all
                      ${isSelected ? `${tagBg} opacity-60` : `${btnBg} border-transparent`}`}
                  >
                    {isSelected && <X size={9} />}
                    {name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ title, helper }: { title: string; helper: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-heading font-semibold text-sm text-gray-800">{title}</h3>
      <p className="text-xs text-gray-400 font-body mt-0.5">{helper}</p>
    </div>
  );
}

// ─── getDuplicateIds ─────────────────────────────────────────────────────────

function getDuplicateIds(rows: SkillRow[]): Set<string> {
  const seen = new Map<string, string>(); // normalised name -> first id
  const dupes = new Set<string>();
  for (const r of rows) {
    if (!r.name.trim()) continue;
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) {
      dupes.add(r.id);
      dupes.add(seen.get(key)!);
    } else {
      seen.set(key, r.id);
    }
  }
  return dupes;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Step2Skills({ values, onChange }: Step2SkillsProps) {
  const [languages, setLanguages] = useState<string[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingLang, setLoadingLang] = useState(true);
  const [loadingFw, setLoadingFw] = useState(true);
  const [loadingTools, setLoadingTools] = useState(true);
  const [loadingDbs, setLoadingDbs] = useState(true);

  useEffect(() => {
    fetchMasterList('settings_languages').then((d) => { setLanguages(d); setLoadingLang(false); });
    fetchMasterList('settings_frameworks').then((d) => { setFrameworks(d); setLoadingFw(false); });
    fetchMasterList('settings_tools').then((d) => { setTools(d); setLoadingTools(false); });
    fetchMasterList('settings_databases').then((d) => { setDatabases(d); setLoadingDbs(false); });
  }, []);

  const dupeLangs = getDuplicateIds(values.languages);
  const dupeFws = getDuplicateIds(values.frameworks);

  function updateLanguages(updater: (rows: SkillRow[]) => SkillRow[]) {
    onChange({ ...values, languages: updater(values.languages) });
  }

  function updateFrameworks(updater: (rows: SkillRow[]) => SkillRow[]) {
    onChange({ ...values, frameworks: updater(values.frameworks) });
  }

  function addRow(category: 'languages' | 'frameworks') {
    const row = makeSkillRow('', false);
    if (category === 'languages') updateLanguages((rows) => [...rows, row]);
    else updateFrameworks((rows) => [...rows, row]);
  }

  function removeRow(category: 'languages' | 'frameworks', id: string) {
    if (category === 'languages') updateLanguages((rows) => rows.filter((r) => r.id !== id));
    else updateFrameworks((rows) => rows.filter((r) => r.id !== id));
  }

  function changeName(category: 'languages' | 'frameworks', id: string, name: string) {
    const updater = (rows: SkillRow[]) => rows.map((r) => (r.id === id ? { ...r, name } : r));
    if (category === 'languages') updateLanguages(updater);
    else updateFrameworks(updater);
  }

  function changeRating(category: 'languages' | 'frameworks', id: string, rating: SkillRating) {
    const updater = (rows: SkillRow[]) =>
      rows.map((r) => (r.id === id ? { ...r, employee_rating: rating } : r));
    if (category === 'languages') updateLanguages(updater);
    else updateFrameworks(updater);
  }

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">2</span>
          Skill Taxonomy
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Select your skills from the available list. Rate your proficiency. Manager fields are filled during review.
        </p>
      </div>

      {/* Languages */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-[11px] font-semibold font-heading uppercase tracking-wide">
            Languages
          </span>
          {loadingLang && <Loader2 size={13} className="animate-spin text-gray-400" />}
        </div>
        <SkillTable
          rows={values.languages}
          masterList={languages}
          loading={loadingLang}
          addLabel="Add Language"
          onAdd={() => addRow('languages')}
          onRemove={(id) => removeRow('languages', id)}
          onChangeName={(id, name) => changeName('languages', id, name)}
          onChangeRating={(id, rating) => changeRating('languages', id, rating)}
          duplicateIds={dupeLangs}
        />
      </section>

      {/* Frameworks */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 text-[11px] font-semibold font-heading uppercase tracking-wide">
            Frameworks
          </span>
          {loadingFw && <Loader2 size={13} className="animate-spin text-gray-400" />}
        </div>
        <SkillTable
          rows={values.frameworks}
          masterList={frameworks}
          loading={loadingFw}
          addLabel="Add Framework"
          onAdd={() => addRow('frameworks')}
          onRemove={(id) => removeRow('frameworks', id)}
          onChangeName={(id, name) => changeName('frameworks', id, name)}
          onChangeRating={(id, rating) => changeRating('frameworks', id, rating)}
          duplicateIds={dupeFws}
        />
      </section>

      {/* Tools & Databases */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <SectionLabel
            title="Tools"
            helper="Select tools from the list — click to toggle"
          />
          <TagPicker
            value={values.tools}
            onChange={(v) => onChange({ ...values, tools: v })}
            masterList={tools}
            loading={loadingTools}
            placeholder="Click to select tools…"
            color="amber"
          />
          <div className="mt-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Lock size={11} className="text-gray-300" />
              <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Manager Comment</span>
            </div>
            <LockedTextarea value={values.tools_manager_comment} />
          </div>
        </div>

        <div>
          <SectionLabel
            title="Databases"
            helper="Select databases from the list — click to toggle"
          />
          <TagPicker
            value={values.databases}
            onChange={(v) => onChange({ ...values, databases: v })}
            masterList={databases}
            loading={loadingDbs}
            placeholder="Click to select databases…"
            color="rose"
          />
          <div className="mt-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Lock size={11} className="text-gray-300" />
              <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Manager Comment</span>
            </div>
            <LockedTextarea value={values.databases_manager_comment} />
          </div>
        </div>
      </section>
    </div>
  );
}
