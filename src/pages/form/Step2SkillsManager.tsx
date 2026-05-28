import { forwardRef, useImperativeHandle } from 'react';
import { Lock } from 'lucide-react';
import type { SkillRow, SkillRating, SkillRatingOption, Step2Values } from '../../types/form';
import { useSkillRatings } from '../../lib/useSkillRatings';

export interface Step2SkillsManagerHandle {
  validate: () => string[];
}

interface Step2SkillsManagerProps {
  values: Step2Values;
  onChange: (values: Step2Values) => void;
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

function EditableTextarea({
  value,
  onChange,
  locked,
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  locked?: boolean;
  placeholder?: string;
}) {
  if (locked) {
    return (
      <div className="relative">
        <textarea
          disabled
          value={value}
          rows={1}
          className={`w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs font-body resize-none outline-none ${LOCKED_CELL}`}
          placeholder="—"
        />
        <Lock size={10} className="absolute right-2 top-2.5 text-gray-300 pointer-events-none" />
      </div>
    );
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={2}
      placeholder={placeholder ?? 'Add manager comment… (required)'}
      className="w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-body text-amber-900 placeholder-amber-300 resize-none outline-none hover:border-amber-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-100 transition-colors"
    />
  );
}

interface SkillTableManagerProps {
  rows: SkillRow[];
  onChangeManagerRating: (id: string, rating: SkillRating) => void;
  onChangeManagerComment: (id: string, comment: string) => void;
  ratingOptions: SkillRatingOption[];
}

function SkillTableManager({ rows, onChangeManagerRating, onChangeManagerComment, ratingOptions }: SkillTableManagerProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full min-w-[620px] text-left border-collapse">
        <thead>
          <tr className="bg-[#F0F7FA] sticky top-0 z-10">
            <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[28%]">
              Skill Name
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
            <th className="px-4 py-3 text-[11px] font-semibold font-heading text-amber-600 uppercase tracking-wide w-[36%]">
              Manager Comment <span className="text-red-400 text-[10px]">*</span>
            </th>
          </tr>
        </thead>
        <tbody>
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
                  onChange={(v) => onChangeManagerRating(row.id, v)}
                  options={ratingOptions}
                />
              </td>
              <td className="px-4 py-2.5">
                <EditableTextarea
                  value={row.manager_comment}
                  onChange={(v) => onChangeManagerComment(row.id, v)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Step2SkillsManager = forwardRef<Step2SkillsManagerHandle, Step2SkillsManagerProps>(
  function Step2SkillsManagerInner({ values, onChange }, ref) {
    const { ratings: ratingOptions } = useSkillRatings();

    useImperativeHandle(ref, () => ({
      validate() {
        const errors: string[] = [];

        const langRatingMissing = values.languages.filter((r) => r.name.trim() && r.manager_rating === null);
        const langCommentMissing = values.languages.filter((r) => r.name.trim() && !r.manager_comment.trim());
        const framRatingMissing = values.frameworks.filter((r) => r.name.trim() && r.manager_rating === null);
        const framCommentMissing = values.frameworks.filter((r) => r.name.trim() && !r.manager_comment.trim());

        if (langRatingMissing.length > 0)
          errors.push(`Manager rating required for ${langRatingMissing.length} language${langRatingMissing.length > 1 ? 's' : ''}: ${langRatingMissing.map((r) => r.name).join(', ')}`);
        if (langCommentMissing.length > 0)
          errors.push(`Manager comment required for ${langCommentMissing.length} language${langCommentMissing.length > 1 ? 's' : ''}: ${langCommentMissing.map((r) => r.name).join(', ')}`);
        if (framRatingMissing.length > 0)
          errors.push(`Manager rating required for ${framRatingMissing.length} framework${framRatingMissing.length > 1 ? 's' : ''}: ${framRatingMissing.map((r) => r.name).join(', ')}`);
        if (framCommentMissing.length > 0)
          errors.push(`Manager comment required for ${framCommentMissing.length} framework${framCommentMissing.length > 1 ? 's' : ''}: ${framCommentMissing.map((r) => r.name).join(', ')}`);
        if (!values.tools_manager_comment.trim())
          errors.push('Manager comment for Tools is required');
        if (!values.databases_manager_comment.trim())
          errors.push('Manager comment for Databases is required');

        return errors;
      },
    }));

    function updateRow(category: 'languages' | 'frameworks', id: string, patch: Partial<SkillRow>) {
      const updated = values[category].map((r) => (r.id === id ? { ...r, ...patch } : r));
      onChange({ ...values, [category]: updated });
    }

    return (
      <div className="space-y-10">
        <div className="space-y-1">
          <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">2</span>
            Skill Taxonomy
          </h2>
          <p className="text-xs text-gray-400 font-body pl-7">
            Review employee self-ratings and fill in manager ratings and comments. All fields marked <span className="text-red-400 font-semibold">*</span> are required before proceeding.
          </p>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-[11px] font-semibold font-heading uppercase tracking-wide">
              Languages
            </span>
          </div>
          <SkillTableManager
            rows={values.languages}
            onChangeManagerRating={(id, v) => updateRow('languages', id, { manager_rating: v })}
            onChangeManagerComment={(id, v) => updateRow('languages', id, { manager_comment: v })}
            ratingOptions={ratingOptions}
          />
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 text-[11px] font-semibold font-heading uppercase tracking-wide">
              Frameworks
            </span>
          </div>
          <SkillTableManager
            rows={values.frameworks}
            onChangeManagerRating={(id, v) => updateRow('frameworks', id, { manager_rating: v })}
            onChangeManagerComment={(id, v) => updateRow('frameworks', id, { manager_comment: v })}
            ratingOptions={ratingOptions}
          />
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold font-heading text-gray-700 mb-1">Tools</p>
            <p className="text-xs font-body text-gray-500 mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
              {values.tools || '—'}
            </p>
            <div>
              <p className="text-[11px] font-heading font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
                Manager Comment <span className="text-red-400">*</span>
              </p>
              <EditableTextarea
                value={values.tools_manager_comment}
                onChange={(v) => onChange({ ...values, tools_manager_comment: v })}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold font-heading text-gray-700 mb-1">Databases</p>
            <p className="text-xs font-body text-gray-500 mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
              {values.databases || '—'}
            </p>
            <div>
              <p className="text-[11px] font-heading font-semibold text-amber-600 uppercase tracking-wide mb-1.5">
                Manager Comment <span className="text-red-400">*</span>
              </p>
              <EditableTextarea
                value={values.databases_manager_comment}
                onChange={(v) => onChange({ ...values, databases_manager_comment: v })}
              />
            </div>
          </div>
        </section>
      </div>
    );
  }
);

export default Step2SkillsManager;
