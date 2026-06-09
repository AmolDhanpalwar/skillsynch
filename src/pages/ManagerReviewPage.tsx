import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Loader2,
  X,
  AlertTriangle,
  Save,
  User,
  Briefcase,
  Hash,
  Star,
  Clock,
  Eye,
  UserCog,
  Search,
  Download,
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import StepIndicator from '../components/form/StepIndicator';
import StatusBadge from '../components/form/StatusBadge';
import Toast from '../components/form/Toast';
import Step1Profile from './form/Step1Profile';
import Step2SkillsManager from './form/Step2SkillsManager';
import type { Step2SkillsManagerHandle } from './form/Step2SkillsManager';
import Step3AdditionalManager from './form/Step3AdditionalManager';
import type { Step3AdditionalManagerHandle } from './form/Step3AdditionalManager';
import Step3CertificationsManager from './form/Step3CertificationsManager';
import type { Step3CertificationsManagerHandle } from './form/Step3CertificationsManager';
import Step4PlansManager from './form/Step4PlansManager';
import type { Step4PlansManagerHandle } from './form/Step4PlansManager';
import { supabase } from '../lib/supabaseClient';
import { callEdgeFn } from '../lib/edgeFunctions';
import { exportSkillAssessmentReport } from '../lib/exportService';
import { useAuth } from '../context/AuthContext';
import { useCycle } from '../context/CycleContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  step1Schema,
  FORM_STEPS,
  SEED_LANGUAGES,
  SEED_FRAMEWORKS,
  makeSkillRow,
  makeDefaultStepAdditional,
  makeDefaultStep3,
  makeDefaultStep4,
} from '../types/form';
import type {
  Step1Values,
  Step2Values,
  StepAdditionalValues,
  Step3Values,
  Step4Values,
  SkillRow,
  SkillRating,
} from '../types/form';
import type { FormStatus } from '../types';

function makeDefaultStep2(): Step2Values {
  return {
    languages: SEED_LANGUAGES.map((n) => makeSkillRow(n, true)),
    frameworks: SEED_FRAMEWORKS.map((n) => makeSkillRow(n, true)),
    tools: '',
    tools_manager_comment: '',
    databases: '',
    databases_manager_comment: '',
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface EmployeeHeaderProps {
  form: ReturnType<typeof useForm<Step1Values>>;
  formStatus: FormStatus;
  employeeData: {
    full_name: string;
    email: string;
    employee_number: string;
    designation: string;
    grade: string;
    current_project: string;
    total_exp?: number;
    relevant_exp?: number;
    haptiq_exp?: number;
  };
}

function EmployeeHeader({ form: _form, formStatus, employeeData }: EmployeeHeaderProps) {
  const fields = [
    { icon: User,     label: 'Name',       value: employeeData.full_name },
    { icon: Hash,     label: 'Emp No.',    value: employeeData.employee_number },
    { icon: Briefcase,label: 'Designation',value: employeeData.designation },
    { icon: Star,     label: 'Grade',      value: employeeData.grade },
    { icon: Clock,    label: 'Total Exp',  value: employeeData.total_exp != null ? `${employeeData.total_exp} yrs` : '—' },
    { icon: Clock,    label: 'Haptiq Exp', value: employeeData.haptiq_exp != null ? `${employeeData.haptiq_exp} yrs` : '—' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">1</span>
        <h2 className="font-heading font-semibold text-base text-gray-800">Employee Profile</h2>
        <StatusBadge status={formStatus} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map((f) => (
          <div key={f.label} className="flex flex-col gap-1 px-3.5 py-3 rounded-xl border border-gray-100 bg-gray-50">
            <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold text-gray-400 uppercase tracking-wide">
              <f.icon size={11} />
              {f.label}
            </span>
            <span className="text-sm font-body text-gray-800 font-medium truncate">{f.value || '—'}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 px-3.5 py-3 rounded-xl border border-gray-100 bg-gray-50">
          <span className="text-[10px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Email</span>
          <span className="text-sm font-body text-gray-800 truncate">{employeeData.email || '—'}</span>
        </div>
        <div className="flex flex-col gap-1 px-3.5 py-3 rounded-xl border border-gray-100 bg-gray-50">
          <span className="text-[10px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Current Project</span>
          <span className="text-sm font-body text-gray-800 truncate">{employeeData.current_project || '—'}</span>
        </div>
      </div>
    </div>
  );
}

function ReturnModal({ onConfirm, onCancel, submitting }: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onCancel} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <RotateCcw size={20} className="text-red-500" />
        </div>
        <h3 className="font-heading font-bold text-gray-900 text-lg mb-1">Return to Employee</h3>
        <p className="text-sm text-gray-500 font-body mb-5">
          Provide a reason for returning this form. The employee will be notified and can revise their submission.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Please update your manager ratings for Java and clarify your upskilling plan…"
          className="w-full px-3.5 py-3 rounded-xl border border-gray-200 text-sm font-body text-gray-800 placeholder-gray-400 resize-none outline-none hover:border-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-colors mb-5"
        />
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} disabled={submitting} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={submitting || reason.trim() === ''}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-red-400 text-red-600 hover:bg-red-50 text-sm font-semibold font-heading transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            {submitting ? 'Returning…' : 'Return to Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ employeeName, onConfirm, onCancel, submitting }: {
  employeeName: string;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onCancel} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
          <CheckCircle2 size={22} className="text-emerald-500" />
        </div>
        <h3 className="font-heading font-bold text-gray-900 text-lg mb-2">Approve Skill Profile?</h3>
        <p className="text-sm text-gray-500 font-body leading-relaxed mb-6">
          You are about to approve <span className="font-semibold text-gray-700">{employeeName}'s</span> Skill Profile.
          All ratings and comments will be saved, the form will be locked, and the employee will be notified.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <button onClick={onCancel} disabled={submitting} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {submitting ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AlreadyApprovedBanner({ employeeName }: { employeeName: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold font-heading text-emerald-700">Form Approved</p>
        <p className="text-xs text-emerald-600 font-body">
          {employeeName}'s Skill Profile has been reviewed and approved. All fields are read-only.
        </p>
      </div>
      <span className="ml-auto px-3 py-1 rounded-full border-2 border-emerald-300 text-emerald-600 text-[11px] font-bold font-heading tracking-widest uppercase">
        APPROVED
      </span>
    </div>
  );
}

// ─── Change Manager Modal (TMG only) ─────────────────────────────────────────

interface ManagerOption { id: string; full_name: string; email: string; }

function ChangeManagerModal({ currentManagerName, employeeId, formId, onClose, onChanged }: {
  currentManagerName: string;
  employeeId: string | null;
  formId: string;
  onClose: () => void;
  onChanged: (newName: string, newId: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ManagerOption[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ManagerOption | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showManualEmail = !selected && searched && results.length === 0 && query.trim().length > 1;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email')
        .ilike('full_name', `%${query.trim()}%`)
        .eq('is_active', true)
        .limit(10);
      setResults(data ?? []);
      setSearched(true);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, selected]);

  function clearSelection() {
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearched(false);
    setManualEmail('');
  }

  const canSave = selected
    ? true
    : showManualEmail && query.trim().length > 1 && manualEmail.trim().includes('@');

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    if (selected) {
      await supabase.from('skill_forms').update({ manager_id: selected.id }).eq('id', formId);
      if (employeeId) {
        await supabase.from('users').update({ manager_id: selected.id }).eq('id', employeeId);
      }
      onChanged(selected.full_name, selected.id);
    } else {
      // Manual entry — no linked user row
      await supabase.from('skill_forms').update({ manager_id: null }).eq('id', formId);
      if (employeeId) {
        await supabase.from('users').update({ manager_id: null }).eq('id', employeeId);
      }
      onChanged(query.trim(), null);
    }

    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <button onClick={onClose} className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={15} />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-4">
          <UserCog size={22} className="text-sky-500" />
        </div>
        <h3 className="font-heading font-bold text-gray-900 text-lg mb-1">Change Manager</h3>
        <p className="text-sm text-gray-500 font-body mb-5">
          Current manager: <span className="font-semibold text-gray-700">{currentManagerName || '—'}</span>
        </p>

        {/* Name search */}
        <div className="relative mb-2">
          <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all bg-white
            ${selected ? 'border-sky-300 ring-1 ring-sky-100' : 'border-gray-200 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100'}`}>
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={selected ? selected.full_name : query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); setManualEmail(''); }}
              placeholder="Search by name…"
              className="flex-1 bg-transparent text-sm font-body text-gray-800 placeholder-gray-400 outline-none"
              readOnly={!!selected}
              autoFocus
            />
            {searching && <Loader2 size={13} className="text-gray-400 animate-spin shrink-0" />}
            {(selected || query) && !searching && (
              <button type="button" onClick={clearSelection} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>

          {results.length > 0 && !selected && (
            <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={() => { setSelected(m); setResults([]); setManualEmail(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
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
        </div>

        {/* DB user confirmed */}
        {selected && (
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-sky-50 border border-sky-100 mb-4">
            <CheckCircle2 size={15} className="text-sky-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold font-heading text-sky-800 truncate">{selected.full_name}</p>
              <p className="text-xs text-sky-600 font-body truncate">{selected.email}</p>
            </div>
          </div>
        )}

        {/* No match found — ask for email */}
        {showManualEmail && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-amber-600 font-body bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
              No user found with that name. Enter their email to save manually.
            </p>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100 transition-all bg-white">
              <span className="text-xs text-gray-400 font-body shrink-0">@</span>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="manager@company.com"
                className="flex-1 bg-transparent text-sm font-body text-gray-800 placeholder-gray-400 outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-sm font-semibold font-heading transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCog size={14} />}
            {saving ? 'Saving…' : 'Assign Manager'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ManagerReviewPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { activeCycle } = useCycle();

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [formStatus, setFormStatus] = useState<FormStatus>('pending_review');
  const [formManagerId, setFormManagerId] = useState<string | null>(null);
  const [formManagerName, setFormManagerName] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState({
    full_name: '', email: '', employee_number: '',
    designation: '', grade: '', current_project: '',
    total_exp: undefined as number | undefined,
    relevant_exp: undefined as number | undefined,
    haptiq_exp: undefined as number | undefined,
  });

  const [step2, setStep2] = useState<Step2Values>(makeDefaultStep2);
  const [stepAdditional, setStepAdditional] = useState<StepAdditionalValues>(makeDefaultStepAdditional);
  const [step3, setStep3] = useState<Step3Values>(makeDefaultStep3);
  const [step4, setStep4] = useState<Step4Values>(makeDefaultStep4);

  const step2Ref = useRef<Step2SkillsManagerHandle>(null);
  const step3AdditionalRef = useRef<Step3AdditionalManagerHandle>(null);
  const step3CertsRef = useRef<Step3CertificationsManagerHandle>(null);
  const step4Ref = useRef<Step4PlansManagerHandle>(null);

  const [stepErrors, setStepErrors] = useState<string[]>([]);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showChangeManagerModal, setShowChangeManagerModal] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [saving, setSavingState] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [approveErrors, setApproveErrors] = useState<string[]>([]);

  const isApproved = formStatus === 'approved';
  const isTmg = user?.role === 'tmg';
  // View-only if TMG AND not the assigned manager
  const isViewOnly = isApproved || (isTmg && formManagerId !== user?.id);

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      full_name: '', email: '', employee_number: '',
      designation: '', grade: '', current_project: '',
      total_exp: undefined, relevant_exp: undefined, haptiq_exp: undefined,
      manager_name: '', manager_email: '',
    },
  });

  useEffect(() => {
    if (!formId) return;
    async function load() {
      setLoading(true);
      const { data: sf } = await supabase
        .from('skill_forms')
        .select('*, users!skill_forms_employee_id_fkey(id, full_name, email, employee_number, designation, grade)')
        .eq('id', formId!)
        .maybeSingle();

      if (!sf) { navigate('/inbox'); return; }

      setFormStatus(sf.status as FormStatus);
      setEmployeeId(sf.employee_id);
      setFormManagerId(sf.manager_id ?? null);

      // Fetch manager name if we have a manager_id
      if (sf.manager_id) {
        const { data: mgr } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', sf.manager_id)
          .maybeSingle();
        setFormManagerName(mgr?.full_name ?? '');
      }

      const emp = sf.users as Record<string, unknown>;
      const ed = {
        full_name: (emp?.full_name as string) || '',
        email: (emp?.email as string) || '',
        employee_number: (emp?.employee_number as string) || '',
        designation: (emp?.designation as string) || '',
        grade: (emp?.grade as string) || '',
        current_project: sf.current_project || '',
        total_exp: sf.total_exp ?? undefined,
        relevant_exp: sf.relevant_exp ?? undefined,
        haptiq_exp: sf.haptiq_exp ?? undefined,
      };
      setEmployeeData(ed);

      const { data: items } = await supabase
        .from('skill_items')
        .select('*')
        .eq('form_id', formId!)
        .order('sort_order');

      const toRow = (item: Record<string, unknown>): SkillRow => ({
        id: item.id as string,
        name: item.name as string,
        employee_rating: item.employee_rating as SkillRating | null,
        manager_rating: item.manager_rating as SkillRating | null,
        manager_comment: (item.manager_comment as string) || '',
        is_seed:
          SEED_LANGUAGES.includes(item.name as string) ||
          SEED_FRAMEWORKS.includes(item.name as string),
      });

      if (items && items.length > 0) {
        const langs = items.filter((i) => i.category === 'language').map(toRow);
        const frams = items.filter((i) => i.category === 'framework').map(toRow);
        const envs = items.filter((i) => i.category === 'environment').map(toRow);
        setStep2({
          languages: langs.length > 0 ? langs : SEED_LANGUAGES.map((n) => makeSkillRow(n, true)),
          frameworks: frams.length > 0 ? frams : SEED_FRAMEWORKS.map((n) => makeSkillRow(n, true)),
          tools: sf.tools || '',
          tools_manager_comment: sf.tools_manager_comment || '',
          databases: sf.databases || '',
          databases_manager_comment: sf.databases_manager_comment || '',
        });
        setStepAdditional({
          environments: envs,
          environments_manager_comment: (sf as Record<string, unknown>).environments_manager_comment as string || '',
        });
      } else {
        setStep2((prev) => ({
          ...prev,
          tools: sf.tools || '',
          tools_manager_comment: sf.tools_manager_comment || '',
          databases: sf.databases || '',
          databases_manager_comment: sf.databases_manager_comment || '',
        }));
        setStepAdditional({
          environments: [],
          environments_manager_comment: (sf as Record<string, unknown>).environments_manager_comment as string || '',
        });
      }

      const rawCerts = sf.certifications as string[] | null;
      setStep3({
        certifications: rawCerts && rawCerts.length > 0 ? rawCerts : [''],
        certifications_manager_comment: '',
      });
      setStep4({
        upskilling_plan: sf.upskilling_plan || '',
        manager_expectation_plan: sf.manager_expectation_plan || '',
      });

      setLoading(false);
    }
    load();
  }, [formId, navigate]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }

  function validateCurrentStep(): string[] {
    if (currentStep === 2) return step2Ref.current?.validate() ?? [];
    if (currentStep === 3) return step3AdditionalRef.current?.validate() ?? [];
    if (currentStep === 4) return step3CertsRef.current?.validate() ?? [];
    if (currentStep === 5) return step4Ref.current?.validate() ?? [];
    return [];
  }

  function validateBeforeApprove(): string[] {
    return [
      ...(step2Ref.current?.validate() ?? []),
      ...(step3AdditionalRef.current?.validate() ?? []),
      ...(step3CertsRef.current?.validate() ?? []),
      ...(step4Ref.current?.validate() ?? []),
    ];
  }

  async function saveManagerInputs() {
    if (!formId) return false;

    const allItems = [
      ...step2.languages.map((r, i) => ({
        form_id: formId,
        category: 'language' as const,
        name: r.name,
        employee_rating: r.employee_rating,
        manager_rating: r.manager_rating,
        manager_comment: r.manager_comment,
        sort_order: i,
      })),
      ...step2.frameworks.map((r, i) => ({
        form_id: formId,
        category: 'framework' as const,
        name: r.name,
        employee_rating: r.employee_rating,
        manager_rating: r.manager_rating,
        manager_comment: r.manager_comment,
        sort_order: i,
      })),
      ...stepAdditional.environments.map((r, i) => ({
        form_id: formId,
        category: 'environment' as const,
        name: r.name,
        employee_rating: r.employee_rating,
        manager_rating: r.manager_rating,
        manager_comment: r.manager_comment,
        sort_order: i,
      })),
    ].filter((item) => item.name.trim() !== '');

    await supabase.from('skill_items').delete().eq('form_id', formId);
    if (allItems.length > 0) await supabase.from('skill_items').insert(allItems);

    const patch: Record<string, unknown> = {
      tools_manager_comment: step2.tools_manager_comment,
      databases_manager_comment: step2.databases_manager_comment,
      environments_manager_comment: stepAdditional.environments_manager_comment,
      upskilling_plan: step4.upskilling_plan,
      manager_expectation_plan: step4.manager_expectation_plan,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('skill_forms').update(patch).eq('id', formId);
    return !error;
  }

  function buildManagerInputs() {
    return {
      tools_manager_comment: step2.tools_manager_comment,
      databases_manager_comment: step2.databases_manager_comment,
      environments_manager_comment: stepAdditional.environments_manager_comment,
      upskilling_plan: step4.upskilling_plan,
      manager_expectation_plan: step4.manager_expectation_plan,
    };
  }

  async function handleSave() {
    setSaveState('saving');
    const ok = await saveManagerInputs();
    if (ok) {
      setSaveState('saved');
      showToast('Progress saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } else {
      setSaveState('idle');
      showToast('Save failed — please retry.');
    }
  }

  async function handleApprove() {
    setActioning(true);

    // Save skill items first so the edge function snapshot captures them
    const itemsSaved = await saveManagerInputs();
    if (!itemsSaved) {
      setActioning(false);
      showToast('Approval failed — please retry.');
      return;
    }

    const { error } = await callEdgeFn('approve-form', {
      form_id: formId,
      manager_id: formManagerId ?? null,
      manager_inputs: buildManagerInputs(),
      cycle_id: activeCycle?.id ?? null,
      employee_id: employeeId,
      cycle_name: activeCycle?.name ?? null,
      approved_by: user?.id ?? null,
    });

    if (error) {
      setActioning(false);
      showToast(`Approval failed: ${error}`);
      return;
    }

    setFormStatus('approved');
    setActioning(false);
    setShowApproveModal(false);
    navigate('/inbox', { state: { toast: `${employeeData.full_name}'s Skill Profile approved!` } });
  }

  async function handleReturn(reason: string) {
    setActioning(true);

    // Save skill items so manager's partial inputs are persisted
    await saveManagerInputs();

    const { error } = await callEdgeFn('return-form', {
      form_id: formId,
      manager_id: formManagerId ?? null,
      manager_inputs: buildManagerInputs(),
      employee_id: employeeId,
      reason,
    });

    if (error) {
      setActioning(false);
      showToast(`Action failed: ${error}`);
      return;
    }

    setFormStatus('returned');
    setActioning(false);
    setShowReturnModal(false);
    navigate('/inbox', { state: { toast: `Form returned to ${employeeData.full_name} for revision.` } });
  }

  async function handleDownloadReport() {
    if (!formId) return;
    setSavingState(true);
    try {
      await exportSkillAssessmentReport(formId);
    } catch (err) {
      showToast('Failed to generate report. Please try again.');
    } finally {
      setSavingState(false);
    }
  }

  const isLastStep = currentStep === FORM_STEPS.length;

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-primary-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-6 pb-28">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/inbox')}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors shrink-0"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading font-bold text-xl text-gray-900 truncate">
                {isViewOnly && !isApproved ? 'Viewing: ' : 'Reviewing: '}{employeeData.full_name || 'Employee'}
              </h1>
              <p className="text-xs text-gray-400 font-body">
                {employeeData.designation}
                {employeeData.grade ? ` · ${employeeData.grade}` : ''}
                {formManagerName ? ` · Manager: ${formManagerName}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isApproved && (
                <button
                  onClick={handleDownloadReport}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold font-heading transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {saving ? 'Generating…' : 'Download Report'}
                </button>
              )}
              {isTmg && (
                <button
                  onClick={() => setShowChangeManagerModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100 text-xs font-semibold font-heading transition-colors"
                >
                  <UserCog size={13} />
                  Change Manager
                </button>
              )}
              <StatusBadge status={formStatus} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm shadow-gray-200/80 border border-gray-100 overflow-hidden">
            {isApproved && <AlreadyApprovedBanner employeeName={employeeData.full_name} />}

            {/* Mode banner */}
            {!isApproved && isViewOnly && (
              <div className="flex items-center gap-2 px-5 py-3 bg-sky-50 border-b border-sky-100">
                <Eye size={14} className="text-sky-500 shrink-0" />
                <p className="text-xs text-sky-700 font-body">
                  You are in <span className="font-semibold">view-only mode</span>. You can read this form but cannot edit it — you are not the assigned manager.
                </p>
              </div>
            )}
            {!isApproved && !isViewOnly && (
              <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-100">
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 font-body">
                  You are in <span className="font-semibold">manager review mode</span>. Amber fields are editable by you; grey fields are employee-only.
                </p>
              </div>
            )}

            <div className="px-6 pt-6 pb-5 border-b border-gray-100">
              <StepIndicator currentStep={currentStep} />
              <div className="flex items-center justify-between mt-5">
                <p className="text-xs text-gray-400 font-body">
                  Step <span className="font-semibold text-gray-600">{currentStep}</span> of{' '}
                  <span className="font-semibold text-gray-600">{FORM_STEPS.length}</span>
                  {' — '}
                  <span className="text-primary-500 font-medium font-heading">
                    {FORM_STEPS.find((s) => s.number === currentStep)?.label}
                  </span>
                </p>
                <p className="text-[10px] text-gray-400 font-body font-mono">#{formId?.slice(0, 8)}</p>
              </div>
            </div>

            {stepErrors.length > 0 && (
              <div className="mx-6 mt-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold font-heading text-red-700 mb-1">Complete the following before proceeding:</p>
                  <ul className="space-y-0.5">
                    {stepErrors.map((err, i) => (
                      <li key={i} className="text-xs font-body text-red-600">• {err}</li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => setStepErrors([])} className="shrink-0 text-red-400 hover:text-red-600 transition-colors">
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="px-6 py-7">
              {currentStep === 1 && (
                <EmployeeHeader form={form} formStatus={formStatus} employeeData={employeeData} />
              )}
              {currentStep === 2 && (
                <Step2SkillsManager
                  ref={step2Ref}
                  values={step2}
                  onChange={isViewOnly ? () => {} : setStep2}
                />
              )}
              {currentStep === 3 && (
                <Step3AdditionalManager
                  ref={step3AdditionalRef}
                  values={stepAdditional}
                  onChange={isViewOnly ? () => {} : setStepAdditional}
                />
              )}
              {currentStep === 4 && (
                <Step3CertificationsManager
                  ref={step3CertsRef}
                  values={step3}
                  onChange={isViewOnly ? () => {} : setStep3}
                />
              )}
              {currentStep === 5 && (
                <Step4PlansManager
                  ref={step4Ref}
                  values={step4}
                  onChange={isViewOnly ? () => {} : setStep4}
                />
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
              {currentStep > 1 && (
                <button
                  onClick={() => { setCurrentStep(currentStep - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-white hover:border-gray-300 transition-all"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              )}
              {!isViewOnly && (
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-white hover:border-gray-300 transition-all disabled:opacity-50"
                >
                  {saveState === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved!' : 'Save Progress'}
                </button>
              )}
              {!isLastStep && (
                <button
                  onClick={() => {
                    const errs = validateCurrentStep();
                    if (errs.length > 0) {
                      setStepErrors(errs);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      return;
                    }
                    setStepErrors([]);
                    setCurrentStep(currentStep + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98]"
                >
                  Next <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom action bar — only for the assigned manager, not TMG viewers */}
        {!isViewOnly && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl shadow-black/5">
            <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
              {approveErrors.length > 0 && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold font-heading text-red-700 mb-1">Complete the following before approving:</p>
                    <ul className="space-y-0.5">
                      {approveErrors.map((err, i) => (
                        <li key={i} className="text-xs font-body text-red-600">• {err}</li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={() => setApproveErrors([])} className="shrink-0 text-red-400 hover:text-red-600 transition-colors">
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold font-heading text-gray-800 truncate">{employeeData.full_name}</p>
                <p className="text-xs text-gray-400 font-body">Pending your review</p>
              </div>
              <button
                onClick={() => setShowReturnModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-red-400 text-red-600 hover:bg-red-50 text-sm font-semibold font-heading transition-all active:scale-[0.98]"
              >
                <RotateCcw size={14} />
                Return to Employee
              </button>
              <button
                onClick={() => {
                  const errs = validateBeforeApprove();
                  if (errs.length > 0) {
                    setApproveErrors(errs);
                    return;
                  }
                  setApproveErrors([]);
                  setShowApproveModal(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98]"
              >
                <CheckCircle2 size={15} />
                Approve
              </button>
              </div>
            </div>
          </div>
        )}
      </AppShell>

      {showApproveModal && (
        <ApproveModal
          employeeName={employeeData.full_name}
          onConfirm={handleApprove}
          onCancel={() => setShowApproveModal(false)}
          submitting={actioning}
        />
      )}
      {showReturnModal && (
        <ReturnModal
          onConfirm={handleReturn}
          onCancel={() => setShowReturnModal(false)}
          submitting={actioning}
        />
      )}
      {showChangeManagerModal && (
        <ChangeManagerModal
          currentManagerName={formManagerName}
          employeeId={employeeId}
          formId={formId!}
          onClose={() => setShowChangeManagerModal(false)}
          onChanged={(newName, newId) => {
            setFormManagerName(newName);
            setFormManagerId(newId);
            showToast(`Manager changed to ${newName}`);
            refreshProfile();
          }}

        />
      )}

      <Toast message={toastMsg} visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </>
  );
}
