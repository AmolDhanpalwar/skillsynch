import { forwardRef, useImperativeHandle } from 'react';
import { Lock, Server } from 'lucide-react';
import type { SkillRow, SkillRating, SkillRatingOption, StepAdditionalValues } from '../../types/form';
import { useSkillRatings } from '../../lib/useSkillRatings';

export interface Step3AdditionalManagerHandle {
  validate: () => string[];
}

interface Step3AdditionalManagerProps {
  values: StepAdditionalValues;
  onChange: (values: StepAdditionalValues) => void;
}

const LOCKED_CELL = 'bg-[#F3F4F6] text-gray-400 cursor-not-allowed';

function RatingSelect({
  value,
  onChange,
  locked,
  options,
}: {
  value: SkillRating | null;
  onChange?: (v: SkillRating) => void;
  locked?: boolean;
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
            : 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100'
          }`}
      >
        <option value="" disabled>Select…</option>
        {options.map((opt) => (
          <option key={opt.sort_order} value={opt.sort_order}>{opt.label}</option>
        ))}
      </select>
      {locked && (
        <Lock size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
      )}
    </div>
  );
}

const Step3AdditionalManager = forwardRef<Step3AdditionalManagerHandle, Step3AdditionalManagerProps>(
  function Step3AdditionalManagerInner({ values, onChange }, ref) {
    const { ratings: ratingOptions } = useSkillRatings();
    const rows = values.environments;

    useImperativeHandle(ref, () => ({
      validate() {
        const errors: string[] = [];

        if (rows.length > 0) {
          const ratingMissing = rows.filter((r) => r.name.trim() && r.manager_rating === null);
          const commentMissing = rows.filter((r) => r.name.trim() && !r.manager_comment.trim());

          if (ratingMissing.length > 0)
            errors.push(`Manager rating required for ${ratingMissing.length} additional skill${ratingMissing.length > 1 ? 's' : ''}: ${ratingMissing.map((r) => r.name).join(', ')}`);
          if (commentMissing.length > 0)
            errors.push(`Manager comment required for ${commentMissing.length} additional skill${commentMissing.length > 1 ? 's' : ''}: ${commentMissing.map((r) => r.name).join(', ')}`);
        }

        if (!values.environments_manager_comment.trim())
          errors.push('Overall manager comment for Additional Skills is required');

        return errors;
      },
    }));

    function updateRow(id: string, patch: Partial<SkillRow>) {
      onChange({
        ...values,
        environments: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
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
            Review employee self-ratings and add manager ratings and comments. All fields marked <span className="text-red-400 font-semibold">*</span> are required before proceeding.
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-[11px] font-semibold font-heading uppercase tracking-wide flex items-center gap-1.5">
              <Server size={11} />
              Env / Infra / Mgmt Sys / OS
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full min-w-[560px] text-left border-collapse">
              <thead>
                <tr className="bg-[#F0F7FA] sticky top-0 z-10">
                  <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[32%]">
                    Item
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[18%]">
                    <span className="flex items-center gap-1">
                      <Lock size={10} className="text-gray-300" />
                      Self-Rating
                    </span>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold font-heading text-amber-600 uppercase tracking-wide w-[18%]">
                    Manager Rating <span className="text-red-400 text-[10px]">*</span>
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold font-heading text-amber-600 uppercase tracking-wide w-[32%]">
                    Manager Comment <span className="text-red-400 text-[10px]">*</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400 font-body">
                      No additional skills submitted by employee.
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
                      <span className="text-sm font-body text-gray-800">{row.name || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <RatingSelect value={row.employee_rating} locked options={ratingOptions} />
                    </td>
                    <td className="px-4 py-2.5">
                      <RatingSelect
                        value={row.manager_rating}
                        onChange={(v) => updateRow(row.id, { manager_rating: v })}
                        options={ratingOptions}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <textarea
                        value={row.manager_comment}
                        onChange={(e) => updateRow(row.id, { manager_comment: e.target.value })}
                        rows={1}
                        placeholder="Add comment… (required)"
                        className="w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-body text-amber-900 placeholder-amber-300 resize-none outline-none hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100 transition-colors"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <p className="text-[11px] font-heading font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
              Overall Manager Comment <span className="text-red-400">*</span>
            </p>
            <textarea
              value={values.environments_manager_comment}
              onChange={(e) => onChange({ ...values, environments_manager_comment: e.target.value })}
              rows={2}
              placeholder="Add overall manager comment for additional skills… (required)"
              className="w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-body text-amber-900 placeholder-amber-300 resize-none outline-none hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100 transition-colors"
            />
          </div>
        </section>
      </div>
    );
  }
);

export default Step3AdditionalManager;
