import { useEffect, useRef, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowRight, ArrowLeft, Loader2, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import AppShell from '../components/layout/AppShell';
import StepIndicator from '../components/form/StepIndicator';
import StatusBadge from '../components/form/StatusBadge';
import Toast from '../components/form/Toast';
import Step1Profile from './form/Step1Profile';
import Step2Skills from './form/Step2Skills';
import Step3Certifications from './form/Step3Certifications';
import Step4Plans from './form/Step4Plans';
import { FormProvider, useFormContext } from '../context/FormContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  step1Schema,
  DRAFT_KEY,
  FORM_STEPS,
  SEED_LANGUAGES,
  SEED_FRAMEWORKS,
  makeSkillRow,
  makeDefaultStep3,
  makeDefaultStep4,
} from '../types/form';
import type {
  Step1Values,
  Step2Values,
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

interface ConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}

function ConfirmModal({ onConfirm, onCancel, submitting }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[fadeUp_0.2s_ease]">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mb-4">
          <ShieldCheck size={22} className="text-sky-500" />
        </div>

        <h3 className="font-heading font-bold text-gray-900 text-lg mb-2">
          Submit for Manager Review?
        </h3>
        <p className="text-sm text-gray-500 font-body leading-relaxed mb-6">
          Once submitted, you cannot edit this form until your manager returns it for revisions.
          Please ensure all sections are complete and accurate before confirming.
        </p>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            {submitting ? 'Submitting…' : 'Confirm Submission'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApprovedBanner() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100">
      <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold font-heading text-emerald-700">Form Approved</p>
        <p className="text-xs text-emerald-600 font-body">
          This skill assessment has been reviewed and approved. All fields are read-only.
        </p>
      </div>
      <span className="ml-auto px-3 py-1 rounded-full border-2 border-emerald-300 text-emerald-600 text-[11px] font-bold font-heading tracking-widest uppercase">
        APPROVED
      </span>
    </div>
  );
}

function SkillFormInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentStep, setCurrentStep, formId, setFormId, formStatus, setFormStatus } =
    useFormContext();

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('Draft saved');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializing = useRef(true);

  const [step2, setStep2] = useState<Step2Values>(makeDefaultStep2);
  const [step3, setStep3] = useState<Step3Values>(makeDefaultStep3);
  const [step4, setStep4] = useState<Step4Values>(makeDefaultStep4);

  const isApproved = formStatus === 'approved';
  const isLocked = isApproved || formStatus === 'pending_review';

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      full_name: '',
      email: '',
      employee_number: '',
      designation: '',
      grade: '',
      current_project: '',
      total_exp: undefined,
      relevant_exp: undefined,
      haptiq_exp: undefined,
      manager_name: '',
      manager_email: '',
    },
    mode: 'onTouched',
  });

  const { watch, reset, getValues, trigger } = form;

  useEffect(() => {
    if (!user) return;

    async function init() {
      const { data: existingForm } = await supabase
        .from('skill_forms')
        .select('*')
        .eq('employee_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const baseValues = {
        full_name: user!.full_name || '',
        email: user!.email || '',
        employee_number: user!.employee_number || '',
        designation: user!.designation || '',
        grade: user!.grade || '',
        current_project: '',
        total_exp: undefined as unknown as number,
        relevant_exp: undefined as unknown as number,
        haptiq_exp: undefined as unknown as number,
        manager_name: '',
        manager_email: '',
      };

      if (existingForm) {
        setFormId(existingForm.id);
        setFormStatus(existingForm.status as FormStatus);
        reset({
          ...baseValues,
          current_project: existingForm.current_project || '',
          total_exp: existingForm.total_exp ?? undefined,
          relevant_exp: existingForm.relevant_exp ?? undefined,
          haptiq_exp: existingForm.haptiq_exp ?? undefined,
        });

        const { data: items } = await supabase
          .from('skill_items')
          .select('*')
          .eq('form_id', existingForm.id)
          .order('sort_order');

        if (items && items.length > 0) {
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
          const langs = items.filter((i) => i.category === 'language').map(toRow);
          const frams = items.filter((i) => i.category === 'framework').map(toRow);
          setStep2({
            languages: langs.length > 0 ? langs : SEED_LANGUAGES.map((n) => makeSkillRow(n, true)),
            frameworks: frams.length > 0 ? frams : SEED_FRAMEWORKS.map((n) => makeSkillRow(n, true)),
            tools: existingForm.tools || '',
            tools_manager_comment: existingForm.tools_manager_comment || '',
            databases: existingForm.databases || '',
            databases_manager_comment: existingForm.databases_manager_comment || '',
          });
        } else {
          setStep2((prev) => ({
            ...prev,
            tools: existingForm.tools || '',
            tools_manager_comment: existingForm.tools_manager_comment || '',
            databases: existingForm.databases || '',
            databases_manager_comment: existingForm.databases_manager_comment || '',
          }));
        }

        const rawCerts = existingForm.certifications as string[] | null;
        setStep3({
          certifications:
            rawCerts && rawCerts.length > 0 ? rawCerts : [''],
          certifications_manager_comment: '',
        });

        setStep4({
          upskilling_plan: existingForm.upskilling_plan || '',
          manager_expectation_plan: existingForm.manager_expectation_plan || '',
        });
      } else {
        const draftJson = localStorage.getItem(DRAFT_KEY(user!.id));
        if (draftJson) {
          try {
            const draft = JSON.parse(draftJson) as Partial<Step1Values>;
            reset({ ...baseValues, ...draft });
          } catch {
            reset(baseValues);
          }
        } else {
          reset(baseValues);
        }
      }

      isInitializing.current = false;
    }

    init();
  }, [user, reset, setFormId, setFormStatus]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2800);
  }, []);

  useEffect(() => {
    const subscription = watch((values) => {
      if (isInitializing.current || !user || isLocked) return;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY(user.id), JSON.stringify(values));
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [watch, user, isLocked]);

  async function saveSkillItems(fid: string) {
    const allItems = [
      ...step2.languages.map((r, i) => ({
        form_id: fid,
        category: 'language' as const,
        name: r.name,
        employee_rating: r.employee_rating,
        manager_rating: r.manager_rating,
        manager_comment: r.manager_comment,
        sort_order: i,
      })),
      ...step2.frameworks.map((r, i) => ({
        form_id: fid,
        category: 'framework' as const,
        name: r.name,
        employee_rating: r.employee_rating,
        manager_rating: r.manager_rating,
        manager_comment: r.manager_comment,
        sort_order: i,
      })),
    ].filter((item) => item.name.trim() !== '');

    await supabase.from('skill_items').delete().eq('form_id', fid);
    if (allItems.length > 0) {
      await supabase.from('skill_items').insert(allItems);
    }
  }

  async function persistForm(statusOverride?: FormStatus): Promise<string | null> {
    if (!user) return null;
    const values = getValues();
    const certList = step3.certifications.filter((c) => c.trim() !== '');

    const upsertPayload = {
      ...(formId ? { id: formId } : {}),
      employee_id: user.id,
      manager_id: user.manager_id || null,
      status: statusOverride ?? ('draft' as FormStatus),
      current_project: values.current_project,
      total_exp: isNaN(Number(values.total_exp)) ? null : Number(values.total_exp),
      relevant_exp: isNaN(Number(values.relevant_exp)) ? null : Number(values.relevant_exp),
      haptiq_exp: isNaN(Number(values.haptiq_exp)) ? null : Number(values.haptiq_exp),
      tools: step2.tools,
      tools_manager_comment: step2.tools_manager_comment,
      databases: step2.databases,
      databases_manager_comment: step2.databases_manager_comment,
      certifications: certList,
      upskilling_plan: step4.upskilling_plan,
      manager_expectation_plan: step4.manager_expectation_plan,
      ...(statusOverride === 'pending_review' ? { submitted_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('skill_forms')
      .upsert(upsertPayload)
      .select('id')
      .maybeSingle();

    if (error) return null;

    await supabase
      .from('users')
      .update({
        full_name: values.full_name,
        employee_number: values.employee_number,
        designation: values.designation,
        grade: values.grade,
      })
      .eq('id', user.id);

    const savedId = data?.id ?? formId;
    if (data?.id) setFormId(data.id);
    if (savedId) await saveSkillItems(savedId);

    return savedId ?? null;
  }

  async function handleSaveDraft() {
    if (!user || isLocked) return;
    setSaveState('saving');
    const savedId = await persistForm('draft');
    if (!savedId) {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    } else {
      setFormStatus('draft');
      setSaveState('saved');
      showToast('Draft saved');
      setTimeout(() => setSaveState('idle'), 2000);
    }
  }

  async function handleNext() {
    if (currentStep === 1) {
      const valid = await trigger();
      if (!valid) return;
    }
    if (!isLocked) await handleSaveDraft();
    setCurrentStep(currentStep + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBack() {
    setCurrentStep(currentStep - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleConfirmSubmit() {
    if (!user) return;
    setSubmitting(true);
    const savedId = await persistForm('pending_review');
    if (!savedId) {
      setSubmitting(false);
      showToast('Submission failed — please try again.');
      return;
    }

    setFormStatus('pending_review');

    if (user.manager_id) {
      await supabase.from('notifications').insert({
        user_id: user.manager_id,
        type: 'form_submitted',
        message: `${user.full_name || user.email} submitted their Skill Profile.`,
        form_id: savedId,
      });
    }

    localStorage.removeItem(DRAFT_KEY(user.id));
    setSubmitting(false);
    setShowConfirmModal(false);
    navigate('/dashboard', { state: { toast: 'Form submitted for manager review!' } });
  }

  const isLastStep = currentStep === FORM_STEPS.length;

  const nextLabel =
    currentStep === 1
      ? 'Next: Skills'
      : currentStep === 2
      ? 'Next: Certifications'
      : currentStep === 3
      ? 'Next: Plans'
      : '';

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading font-bold text-2xl text-gray-900">Skill Assessment Form</h1>
            <p className="text-sm text-gray-500 font-body mt-0.5">
              Complete all steps to submit your skill profile for review.
            </p>
          </div>
          <StatusBadge status={formStatus} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm shadow-gray-200/80 border border-gray-100 overflow-hidden">
          {isApproved && <ApprovedBanner />}

          <div className="px-6 pt-6 pb-5 border-b border-gray-100">
            <StepIndicator currentStep={currentStep} />
            <div className="flex items-center justify-between mt-5">
              <p className="text-xs text-gray-400 font-body">
                Step{' '}
                <span className="font-semibold text-gray-600">{currentStep}</span> of{' '}
                <span className="font-semibold text-gray-600">{FORM_STEPS.length}</span>
                {' — '}
                <span className="text-primary-500 font-medium font-heading">
                  {FORM_STEPS.find((s) => s.number === currentStep)?.label}
                </span>
              </p>
              {formId && (
                <p className="text-[10px] text-gray-400 font-body font-mono">
                  #{formId.slice(0, 8)}
                </p>
              )}
            </div>
          </div>

          <div className="px-6 py-7">
            {currentStep === 1 && <Step1Profile form={form} />}
            {currentStep === 2 && (
              <Step2Skills values={step2} onChange={isLocked ? () => {} : setStep2} />
            )}
            {currentStep === 3 && (
              <Step3Certifications
                values={step3}
                onChange={isLocked ? () => {} : setStep3}
                locked={isLocked}
              />
            )}
            {currentStep === 4 && (
              <Step4Plans
                values={step4}
                onChange={isLocked ? () => {} : setStep4}
                locked={isLocked}
              />
            )}
          </div>

          <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-white hover:border-gray-300 transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
              {!isLocked && (
                <button
                  onClick={handleSaveDraft}
                  disabled={saveState === 'saving'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold font-heading text-gray-600 hover:bg-white hover:border-gray-300 transition-all disabled:opacity-50"
                >
                  {saveState === 'saving' ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {saveState === 'saving'
                    ? 'Saving…'
                    : saveState === 'saved'
                    ? 'Saved!'
                    : saveState === 'error'
                    ? 'Error — Retry'
                    : 'Save Draft'}
                </button>
              )}
            </div>

            {isLastStep ? (
              !isApproved && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isLocked && !isApproved}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={15} />
                  Submit for Manager Review
                </button>
              )
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold font-heading transition-all active:scale-[0.98]"
              >
                {nextLabel}
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <ConfirmModal
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowConfirmModal(false)}
          submitting={submitting}
        />
      )}

      <Toast
        message={toastMsg}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </>
  );
}

export default function SkillFormPage() {
  return (
    <AppShell>
      <FormProvider>
        <SkillFormInner />
      </FormProvider>
    </AppShell>
  );
}
