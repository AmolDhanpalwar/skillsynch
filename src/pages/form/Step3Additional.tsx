import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Lock, Search, X, ChevronDown, Loader2, Server } from 'lucide-react';
import type { SkillRow, SkillRating, SkillRatingOption, StepAdditionalValues } from '../../types/form';
import { makeSkillRow } from '../../types/form';
import { supabase } from '../../lib/supabaseClient';
import { useSkillRatings } from '../../lib/useSkillRatings';

export interface Step3AdditionalHandle {
  validate: () => boolean;
}

interface Step3AdditionalProps {
  values: StepAdditionalValues;
  onChange: (values: StepAdditionalValues) => void;
  locked?: boolean;
}

// ─── Shared primitives (mirror Step2Skills pattern) ──────────────────────────

const LOCKED_CELL = 'bg-[#F3F4F6] text-gray-400 cursor-not-allowed';

function RatingSelect({
  value,
  onChange,
  locked,
  error,
  options,
}: {
  value: SkillRating | null;
  onChange?: (v: SkillRating) => void;
  locked?: boolean;
  error?: boolean;
  options: SkillRatingOption[];
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
            : error
              ? 'border-red-400 bg-red-50 text-gray-800 focus:border-red-500 focus:ring-1 focus:ring-red-100'
              : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100'
          }`}
      >
        <option value="" disabled>Select…</option>
        {options.map((opt) => (
          <option key={opt.sort_order} value={opt.sort_order}>{opt.label}</option>
        ))}
      </select>
      {!locked && (
        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      )}
      {locked && (
        <Lock size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
      )}
      {error && (
        <p className="text-[10px] text-red-500 font-body mt-0.5">Required</p>
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

// ─── Skill Name Picker ────────────────────────────────────────────────────────

interface SkillNamePickerProps {
  value: string;
  masterList: string[];
  usedNames: string[];
  onChange: (name: string) => void;
  error?: string;
  locked?: boolean;
}

function SkillNamePicker({ value, masterList, usedNames, onChange, error, locked }: SkillNamePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const available = masterList.filter(
    (n) =>
      !usedNames.some((u) => u.trim().toLowerCase() === n.toLowerCase()) ||
      n.toLowerCase() === value.toLowerCase(),
  );

  const filtered = query.trim()
    ? available.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : available;

  function openDropdown() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownH = Math.min(filtered.length * 32 + 44, 220);
    const top = spaceBelow >= dropdownH || spaceBelow >= 150
      ? rect.bottom + window.scrollY + 4
      : rect.top + window.scrollY - dropdownH - 4;
    setDropdownStyle({
      position: 'absolute',
      top,
      left: rect.left + window.scrollX,
      width: rect.width,
      minWidth: 180,
      zIndex: 9999,
    });
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

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

  if (locked) {
    return (
      <div className={`w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs font-body ${LOCKED_CELL}`}>
        {value || '—'}
      </div>
    );
  }

  const dropdown = open ? createPortal(
    <div
      style={dropdownStyle}
      className="bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
    >
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
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (open) { setOpen(false); setQuery(''); } else { openDropdown(); }
        }}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-xs font-body outline-none transition-colors text-left
          ${error ? 'border-red-300 bg-white' : open ? 'border-primary-400 ring-1 ring-primary-100 bg-white' : 'border-gray-200 bg-white hover:border-primary-300'}
          ${!value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate">{value || 'Select item…'}</span>
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
      {dropdown}
      {error && <p className="text-[10px] text-red-500 font-body mt-0.5">{error}</p>}
    </div>
  );
}

// ─── getDuplicateIds ──────────────────────────────────────────────────────────

function getDuplicateIds(rows: SkillRow[]): Set<string> {
  const seen = new Map<string, string>();
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

// ─── Main component ───────────────────────────────────────────────────────────

async function fetchEnvironmentsList(): Promise<string[]> {
  const { data } = await supabase
    .from('settings_environments')
    .select('name')
    .eq('is_active', true)
    .order('name');
  return (data ?? []).map((r: { name: string }) => r.name);
}

const Step3Additional = forwardRef<Step3AdditionalHandle, Step3AdditionalProps>(function Step3Additional({ values, onChange, locked }, ref) {
  const [masterList, setMasterList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingErrorIds, setRatingErrorIds] = useState<Set<string>>(new Set());
  const { ratings: ratingOptions } = useSkillRatings();

  useEffect(() => {
    fetchEnvironmentsList().then((list) => {
      setMasterList(list);
      setLoading(false);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    validate() {
      const errors = new Set(
        values.environments.filter((r) => r.name.trim() !== '' && r.employee_rating === null).map((r) => r.id)
      );
      setRatingErrorIds(errors);
      return errors.size === 0;
    },
  }));

  const rows = values.environments;
  const dupeIds = getDuplicateIds(rows);
  const canAdd = rows.every((r) => r.name.trim() !== '');

  function otherNames(currentId: string) {
    return rows.filter((r) => r.id !== currentId).map((r) => r.name);
  }

  function addRow() {
    onChange({ ...values, environments: [...rows, makeSkillRow('', false)] });
  }

  function removeRow(id: string) {
    onChange({ ...values, environments: rows.filter((r) => r.id !== id) });
  }

  function changeName(id: string, name: string) {
    onChange({
      ...values,
      environments: rows.map((r) => (r.id === id ? { ...r, name } : r)),
    });
  }

  function changeRating(id: string, rating: SkillRating) {
    setRatingErrorIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    onChange({
      ...values,
      environments: rows.map((r) => (r.id === id ? { ...r, employee_rating: rating } : r)),
    });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">3</span>
          Additional Skills
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Select environments, infrastructure, OS, and management systems you have worked with, and rate your proficiency.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-[11px] font-semibold font-heading uppercase tracking-wide flex items-center gap-1.5">
            <Server size={11} />
            Env / Infra / Mgmt Sys / OS
          </span>
          {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full min-w-[520px] text-left border-collapse">
            <thead>
              <tr className="bg-[#F0F7FA] sticky top-0 z-10">
                <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[40%]">
                  Item
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[24%]">
                  Self-Rating
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide w-[24%]">
                  <span className="flex items-center gap-1">
                    <Lock size={10} className="text-gray-300" />
                    Manager Rating
                  </span>
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide w-[12%]">
                  <span className="flex items-center gap-1">
                    <Lock size={10} className="text-gray-300" />
                    Comment
                  </span>
                </th>
                {!locked && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={locked ? 4 : 5} className="px-4 py-6 text-center text-xs text-gray-400 font-body">
                    No items added yet. Click "Add Item" below.
                  </td>
                </tr>
              )}
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
                      onChange={(name) => changeName(row.id, name)}
                      error={dupeIds.has(row.id) ? 'Duplicate' : undefined}
                      locked={locked}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <RatingSelect
                      value={row.employee_rating}
                      onChange={(v) => changeRating(row.id, v)}
                      locked={locked}
                      error={!locked && ratingErrorIds.has(row.id)}
                      options={ratingOptions}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <RatingSelect value={row.manager_rating} locked options={ratingOptions} />
                  </td>
                  <td className="px-4 py-2.5">
                    <LockedTextarea value={row.manager_comment} />
                  </td>
                  {!locked && (
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!locked && (
          <button
            type="button"
            onClick={addRow}
            disabled={!canAdd}
            className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold font-heading text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
            Add Item
          </button>
        )}

        <div className="mt-4">
          <div className="flex items-center gap-1 mb-1.5">
            <Lock size={11} className="text-gray-300" />
            <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Manager Comment</span>
          </div>
          <LockedTextarea value={values.environments_manager_comment} />
        </div>
      </section>
    </div>
  );
});

export default Step3Additional;
