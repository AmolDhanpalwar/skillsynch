import { useEffect, useRef, useState } from 'react';
import { Trash2, Plus, Lock, Award, Search, X, ChevronDown, Loader2 } from 'lucide-react';
import type { Step3Values } from '../../types/form';
import { supabase } from '../../lib/db';

interface Step3CertificationsProps {
  values: Step3Values;
  onChange: (values: Step3Values) => void;
  locked?: boolean;
}

async function fetchCertifications(): Promise<string[]> {
  const { data } = await supabase
    .from('settings_certifications')
    .select('name')
    .eq('is_active', true)
    .order('name');
  return (data ?? []).map((r: { name: string }) => r.name);
}

// ─── CertPicker ──────────────────────────────────────────────────────────────

interface CertPickerProps {
  value: string;
  masterList: string[];
  usedNames: string[];
  loading: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  isDuplicate: boolean;
}

function CertPicker({ value, masterList, usedNames, loading, onChange, placeholder, isDuplicate }: CertPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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

  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setQuery('');
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-body outline-none transition-all text-left
          ${isDuplicate
            ? 'border-red-300 bg-red-50'
            : open
            ? 'border-primary-400 ring-1 ring-primary-100 bg-white'
            : 'bg-white border-gray-200 hover:border-primary-300'
          }
          ${!value ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
          {value && !loading ? (
            <X
              size={13}
              className="text-gray-400 hover:text-gray-600"
              onMouseDown={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            />
          ) : (
            <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          )}
        </span>
      </button>

      {isDuplicate && (
        <p className="text-[10px] text-red-500 font-body mt-0.5 pl-1">Duplicate — already selected above</p>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search certifications…"
              className="flex-1 text-sm font-body text-gray-700 bg-transparent outline-none placeholder-gray-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 font-body text-center">No options available</p>
            ) : (
              filtered.map((name) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => { onChange(name); setOpen(false); setQuery(''); }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-body transition-colors
                    ${name === value ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Step3Certifications({
  values,
  onChange,
  locked = false,
}: Step3CertificationsProps) {
  const [masterList, setMasterList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertifications().then((d) => { setMasterList(d); setLoading(false); });
  }, []);

  function addRow() {
    onChange({ ...values, certifications: [...values.certifications, ''] });
  }

  function removeRow(idx: number) {
    const updated = values.certifications.filter((_, i) => i !== idx);
    onChange({ ...values, certifications: updated.length === 0 ? [''] : updated });
  }

  function updateRow(idx: number, val: string) {
    onChange({ ...values, certifications: values.certifications.map((c, i) => (i === idx ? val : c)) });
  }

  function isDuplicate(idx: number): boolean {
    const v = values.certifications[idx].trim().toLowerCase();
    if (!v) return false;
    return values.certifications.some(
      (c, i) => i !== idx && c.trim().toLowerCase() === v,
    );
  }

  function otherNames(idx: number): string[] {
    return values.certifications.filter((_, i) => i !== idx);
  }

  // Can add: only if last entry is filled and not duplicate
  const canAdd = values.certifications.every((c) => c.trim() !== '') && !values.certifications.some((_, i) => isDuplicate(i));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">
            3
          </span>
          Certifications
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Select all relevant certifications you have earned or are currently pursuing.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Award size={14} className="text-sky-500" />
          <span className="text-sm font-semibold font-heading text-gray-700">Certification List</span>
          {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
        </div>

        <div className="space-y-2">
          {values.certifications.map((cert, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="w-6 pt-3 text-center text-[11px] text-gray-400 font-mono shrink-0">
                {idx + 1}.
              </span>

              {locked ? (
                <div className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-100 text-sm font-body text-gray-500 cursor-not-allowed">
                  {cert || '—'}
                </div>
              ) : (
                <CertPicker
                  value={cert}
                  masterList={masterList}
                  usedNames={otherNames(idx)}
                  loading={loading}
                  onChange={(v) => updateRow(idx, v)}
                  placeholder={`Select certification ${idx + 1}…`}
                  isDuplicate={isDuplicate(idx)}
                />
              )}

              {!locked && values.certifications.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="mt-1 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {!locked && (
          <button
            type="button"
            onClick={addRow}
            disabled={!canAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold font-heading text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            Add Certification
          </button>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Lock size={12} className="text-gray-300" />
          <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wide">
            Manager Comment
          </span>
        </div>
        <div className="relative">
          <textarea
            disabled
            value={values.certifications_manager_comment}
            rows={3}
            placeholder="Manager's feedback on certifications will appear here after review."
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-100 text-sm font-body text-gray-400 resize-none outline-none cursor-not-allowed"
          />
          <Lock size={12} className="absolute right-3 top-3 text-gray-300 pointer-events-none" />
        </div>
      </section>
    </div>
  );
}
