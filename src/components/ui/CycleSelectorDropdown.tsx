import { useRef, useState, useEffect } from 'react';
import { ChevronDown, History, RefreshCw } from 'lucide-react';
import type { ReviewCycle } from '../../types';
import { CYCLE_TYPE_LABELS } from '../../types';

export interface CycleOption {
  id: string | 'current';
  label: string;
  sublabel?: string;
  isCurrent: boolean;
}

interface Props {
  cycles: ReviewCycle[];
  activeCycle: ReviewCycle | null;
  selectedId: string | 'current';
  onChange: (id: string | 'current') => void;
}

export function buildCycleOptions(cycles: ReviewCycle[], activeCycle: ReviewCycle | null): CycleOption[] {
  const opts: CycleOption[] = [];

  if (activeCycle) {
    opts.push({
      id: 'current',
      label: activeCycle.name,
      sublabel: `${CYCLE_TYPE_LABELS[activeCycle.cycle_type]} · Current`,
      isCurrent: true,
    });
  } else {
    opts.push({ id: 'current', label: 'Current Cycle', sublabel: 'No active cycle', isCurrent: true });
  }

  const closed = cycles
    .filter((c) => c.status === 'closed')
    .sort((a, b) => new Date(b.closed_at ?? b.created_at).getTime() - new Date(a.closed_at ?? a.created_at).getTime());

  closed.forEach((c) => {
    opts.push({
      id: c.id,
      label: c.name,
      sublabel: `${CYCLE_TYPE_LABELS[c.cycle_type]} · Closed ${c.closed_at ? new Date(c.closed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}`,
      isCurrent: false,
    });
  });

  return opts;
}

export default function CycleSelectorDropdown({ cycles, activeCycle, selectedId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const options = buildCycleOptions(cycles, activeCycle);
  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (options.length <= 1 && !activeCycle) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold font-heading text-gray-700 transition-colors shadow-sm"
      >
        {selected?.isCurrent ? (
          <RefreshCw size={13} className="text-emerald-500 shrink-0" />
        ) : (
          <History size={13} className="text-gray-400 shrink-0" />
        )}
        <span className="max-w-[180px] truncate">{selected?.label ?? 'Select Cycle'}</span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/60 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-semibold font-heading text-gray-400 uppercase tracking-wider">Select Cycle</p>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                  opt.id === selectedId ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  {opt.isCurrent ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold font-heading truncate ${opt.id === selectedId ? 'text-primary-700' : 'text-gray-800'}`}>
                      {opt.label}
                    </p>
                    {opt.sublabel && (
                      <p className="text-[11px] text-gray-400 font-body truncate">{opt.sublabel}</p>
                    )}
                  </div>
                  {opt.id === selectedId && (
                    <span className="ml-auto w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3 5.5L6.5 2" stroke="#2563eb" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
