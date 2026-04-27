import { useEffect, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { User, Clock, UserCheck, Search, X, Loader2 } from 'lucide-react';
import FormField from '../../components/form/FormField';
import type { Step1Input, Step1Values } from '../../types/form';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

interface Step1ProfileProps {
  form: UseFormReturn<Step1Input, unknown, Step1Values>;
}

interface ManagerOption {
  id: string;
  full_name: string;
  email: string;
}

export default function Step1Profile({ form }: Step1ProfileProps) {
  const { user } = useAuth();

  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const managerName = watch('manager_name');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ManagerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ManagerOption | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When form resets with a pre-filled manager_name (loaded from DB), sync the query input
  useEffect(() => {
    if (managerName && !selectedManager) {
      setQuery(managerName);
    }
  }, [managerName]);

  // Search managers in DB as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selectedManager) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('role', ['manager', 'tmg', 'admin'])
        .ilike('full_name', `%${query.trim()}%`)
        .limit(8);
      setResults(data ?? []);
      setOpen(true);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selectedManager]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectManager(m: ManagerOption) {
    setSelectedManager(m);
    setQuery(m.full_name);
    setOpen(false);
    setResults([]);
    setValue('manager_name', m.full_name, { shouldDirty: true });
    setValue('manager_email', m.email, { shouldDirty: true });
  }

  function clearManager() {
    setSelectedManager(null);
    setQuery('');
    setValue('manager_name', '', { shouldDirty: true });
    setValue('manager_email', '', { shouldDirty: true });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">1</span>
          Employee Information
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Verify your details and fill in any missing fields.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
        <FormField
          label="Employee Name"
          required
          placeholder="Your full name"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <FormField
          label="Employee Email"
          type="email"
          required
          placeholder="your@email.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <FormField
          label="Employee Number"
          required
          placeholder="e.g. EMP001"
          error={errors.employee_number?.message}
          {...register('employee_number')}
        />
        <FormField
          label="Designation"
          required
          placeholder="e.g. Software Engineer"
          error={errors.designation?.message}
          {...register('designation')}
        />

        <FormField
          label="Grade"
          required
          placeholder="e.g. L2"
          error={errors.grade?.message}
          {...register('grade')}
        />
        <FormField
          label="Current Project Name"
          required
          placeholder="Project name or account"
          error={errors.current_project?.message}
          {...register('current_project')}
        />

        <FormField
          label="Total Years of Experience"
          inputMode="decimal"
          required
          placeholder="e.g. 5"
          hint="Total professional experience in years"
          error={errors.total_exp?.message}
          {...register('total_exp')}
        />
        <FormField
          label="Relevant Years of Experience"
          inputMode="decimal"
          required
          placeholder="e.g. 3"
          hint="Experience relevant to current role"
          error={errors.relevant_exp?.message}
          {...register('relevant_exp')}
        />

        <FormField
          label="Haptiq Experience (Years)"
          inputMode="decimal"
          required
          placeholder="e.g. 1.5"
          hint="Years worked at Haptiq"
          error={errors.haptiq_exp?.message}
          {...register('haptiq_exp')}
        />

        {/* Manager Name — searchable lookup */}
        <div className="flex flex-col gap-1.5" ref={containerRef}>
          <label className="text-xs font-semibold font-heading text-gray-600 uppercase tracking-wide">
            Manager Name
          </label>
          <div className="relative">
            <div className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl border text-sm font-body bg-white border-gray-200 hover:border-gray-300 focus-within:border-accent-400 focus-within:ring-2 focus-within:ring-accent-400/15 transition-all">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedManager(null);
                  setValue('manager_name', e.target.value, { shouldDirty: true });
                  if (!e.target.value) setValue('manager_email', '', { shouldDirty: true });
                }}
                placeholder="Search by name or type manually"
                className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
              />
              {searching && <Loader2 size={13} className="text-gray-400 animate-spin shrink-0" />}
              {(query || selectedManager) && !searching && (
                <button
                  type="button"
                  onClick={clearManager}
                  className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {open && results.length > 0 && (
              <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                {results.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={() => selectManager(m)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary-600 text-[10px] font-bold font-heading">
                        {m.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold font-heading text-gray-800 truncate">{m.full_name}</p>
                      <p className="text-xs text-gray-400 font-body truncate">{m.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {open && !searching && results.length === 0 && query.trim().length > 1 && (
              <div className="absolute z-20 mt-1.5 w-full bg-white rounded-xl border border-gray-200 shadow-lg px-4 py-3 text-xs text-gray-400 font-body">
                No managers found — name saved as entered.
              </div>
            )}
          </div>
          {errors.manager_name?.message && (
            <p className="text-xs text-red-500 font-body flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
              {errors.manager_name.message}
            </p>
          )}
        </div>
      </div>

      {/* Manager Email — auto-filled or editable */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <FormField
          label="Manager Email"
          type="email"
          placeholder="manager@company.com"
          hint={selectedManager ? 'Auto-filled from manager lookup' : undefined}
          error={errors.manager_email?.message}
          {...register('manager_email')}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { icon: User,      label: 'Personal Info', done: true },
          { icon: Clock,     label: 'Experience',    done: true },
          { icon: UserCheck, label: 'Manager',       done: !!(selectedManager || user?.manager_id || query) },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body border
              ${item.done
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-gray-50 border-gray-100 text-gray-400'
              }`}
          >
            <item.icon size={13} className="shrink-0" />
            <span className="font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
