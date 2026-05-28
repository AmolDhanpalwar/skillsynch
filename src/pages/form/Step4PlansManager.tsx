import { forwardRef, useImperativeHandle } from 'react';
import { Lock, Lightbulb, ClipboardList } from 'lucide-react';
import type { Step4Values } from '../../types/form';

export interface Step4PlansManagerHandle {
  validate: () => string[];
}

interface Step4PlansManagerProps {
  values: Step4Values;
  onChange: (values: Step4Values) => void;
}

const Step4PlansManager = forwardRef<Step4PlansManagerHandle, Step4PlansManagerProps>(
  function Step4PlansManagerInner({ values, onChange }, ref) {
    useImperativeHandle(ref, () => ({
      validate() {
        const errors: string[] = [];
        if (!values.manager_expectation_plan.trim())
          errors.push("Manager's Feedback & Expectation Plan is required");
        return errors;
      },
    }));

    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">
              4
            </span>
            Plans &amp; Review
          </h2>
          <p className="text-xs text-gray-400 font-body pl-7">
            Review the employee's plan and add your feedback and expectations. Fields marked <span className="text-red-400 font-semibold">*</span> are required before approving.
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-gray-300" />
            <Lightbulb size={14} className="text-gray-400" />
            <span className="text-sm font-semibold font-heading text-gray-500">
              Employee's Upskilling Plan
            </span>
          </div>
          <div className="relative">
            <textarea
              disabled
              value={values.upskilling_plan}
              rows={6}
              placeholder="Employee has not provided a plan yet."
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-100 text-sm font-body text-gray-600 resize-none outline-none cursor-not-allowed"
            />
            <Lock size={12} className="absolute right-3 top-3 text-gray-300 pointer-events-none" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={14} className="text-amber-500" />
            <span className="text-sm font-semibold font-heading text-gray-700">
              Manager's Feedback and Expectation Plan <span className="text-red-400">*</span>
            </span>
          </div>
          <textarea
            value={values.manager_expectation_plan}
            onChange={(e) => onChange({ ...values, manager_expectation_plan: e.target.value })}
            rows={6}
            placeholder="Describe your expectations and development goals for this employee… (required)"
            className="w-full px-3.5 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm font-body text-amber-900 placeholder-amber-300 resize-y outline-none hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100 transition-colors"
          />
        </section>
      </div>
    );
  }
);

export default Step4PlansManager;
