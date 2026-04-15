import { Trash2, Plus, Lock, Award } from 'lucide-react';
import type { Step3Values } from '../../types/form';

interface Step3CertificationsProps {
  values: Step3Values;
  onChange: (values: Step3Values) => void;
  locked?: boolean;
}

export default function Step3Certifications({
  values,
  onChange,
  locked = false,
}: Step3CertificationsProps) {
  function addRow() {
    onChange({ ...values, certifications: [...values.certifications, ''] });
  }

  function removeRow(idx: number) {
    const updated = values.certifications.filter((_, i) => i !== idx);
    onChange({ ...values, certifications: updated.length === 0 ? [''] : updated });
  }

  function updateRow(idx: number, val: string) {
    const updated = values.certifications.map((c, i) => (i === idx ? val : c));
    onChange({ ...values, certifications: updated });
  }

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
          List all relevant certifications you have earned or are currently pursuing.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Award size={14} className="text-sky-500" />
          <span className="text-sm font-semibold font-heading text-gray-700">
            Certification List
          </span>
        </div>

        <div className="space-y-2">
          {values.certifications.map((cert, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 text-center text-[11px] text-gray-400 font-mono shrink-0">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={cert}
                disabled={locked}
                onChange={(e) => updateRow(idx, e.target.value)}
                placeholder={`Certification ${idx + 1} (e.g. AWS Solutions Architect)`}
                className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm font-body outline-none transition-colors
                  ${locked
                    ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-white border-gray-200 text-gray-800 placeholder-gray-400 hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100'
                  }`}
              />
              {!locked && values.certifications.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold font-heading text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
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
