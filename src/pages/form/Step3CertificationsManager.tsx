import { Award } from 'lucide-react';
import type { Step3Values } from '../../types/form';

interface Step3CertificationsManagerProps {
  values: Step3Values;
  onChange: (values: Step3Values) => void;
}

export default function Step3CertificationsManager({
  values,
  onChange,
}: Step3CertificationsManagerProps) {
  const filled = values.certifications.filter((c) => c.trim() !== '');

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
          Employee's certifications are listed below. Add your comment in the manager section.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Award size={14} className="text-sky-500" />
          <span className="text-sm font-semibold font-heading text-gray-700">
            Certification List
          </span>
        </div>

        {filled.length === 0 ? (
          <p className="text-sm text-gray-400 font-body italic px-1">No certifications provided.</p>
        ) : (
          <ul className="space-y-2">
            {filled.map((cert, idx) => (
              <li key={idx} className="flex items-center gap-2.5">
                <span className="w-5 text-center text-[11px] text-gray-400 font-mono shrink-0">
                  {idx + 1}.
                </span>
                <span className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-body text-gray-700">
                  {cert}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-heading font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
          Manager Comment
        </p>
        <textarea
          value={values.certifications_manager_comment}
          onChange={(e) =>
            onChange({ ...values, certifications_manager_comment: e.target.value })
          }
          rows={4}
          placeholder="Add your feedback on the employee's certifications…"
          className="w-full px-3.5 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm font-body text-amber-900 placeholder-amber-300 resize-y outline-none hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100 transition-colors"
        />
      </section>
    </div>
  );
}
