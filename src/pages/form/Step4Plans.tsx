import { Lock, Lightbulb, ClipboardList } from 'lucide-react';
import type { Step4Values } from '../../types/form';

interface Step4PlansProps {
  values: Step4Values;
  onChange: (values: Step4Values) => void;
  locked?: boolean;
}

export default function Step4Plans({ values, onChange, locked = false }: Step4PlansProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">
            4
          </span>
          Plans &amp; Submit
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Share your development goals for the next 6 months. Manager feedback is added during the review stage.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-500" />
          <span className="text-sm font-semibold font-heading text-gray-700">
            Next 6-Month Upskilling / Certification Plan
          </span>
        </div>
        <textarea
          value={values.upskilling_plan}
          disabled={locked}
          onChange={(e) => onChange({ ...values, upskilling_plan: e.target.value })}
          rows={6}
          placeholder="Describe skills you plan to develop or certifications to pursue..."
          className={`w-full px-3.5 py-3 rounded-xl border text-sm font-body resize-y outline-none transition-colors
            ${locked
              ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100'
            }`}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-gray-300" />
          <ClipboardList size={14} className="text-gray-400" />
          <span className="text-sm font-semibold font-heading text-gray-500">
            Manager's Feedback and Expectation Plan
          </span>
        </div>
        <div className="relative">
          <textarea
            disabled
            value={values.manager_expectation_plan}
            rows={6}
            placeholder="Manager's feedback and expectations will appear here after the review."
            className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-100 text-sm font-body text-gray-400 resize-none outline-none cursor-not-allowed"
          />
          <Lock size={12} className="absolute right-3 top-3 text-gray-300 pointer-events-none" />
        </div>
        <p className="text-[11px] text-gray-400 font-body">
          This field is filled by your manager during the review stage.
        </p>
      </section>

      <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3.5 flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sky-600 text-[10px] font-bold">i</span>
        </div>
        <p className="text-xs text-sky-700 font-body leading-relaxed">
          Once you submit, your form will be locked for editing until your manager returns it for revisions.
          Make sure all sections are complete before submitting.
        </p>
      </div>
    </div>
  );
}
