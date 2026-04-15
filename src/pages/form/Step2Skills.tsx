import { Trash2, Plus, Lock } from 'lucide-react';
import type { SkillRow, SkillRating, Step2Values } from '../../types/form';
import { SKILL_RATING_OPTIONS, makeSkillRow } from '../../types/form';

interface Step2SkillsProps {
  values: Step2Values;
  onChange: (values: Step2Values) => void;
}

const LOCKED_CELL = 'bg-[#F3F4F6] text-gray-400 cursor-not-allowed';

function RatingSelect({
  value,
  onChange,
  locked,
}: {
  value: SkillRating | null;
  onChange?: (v: SkillRating) => void;
  locked?: boolean;
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
            : 'border-gray-200 bg-white text-gray-800 hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100'
          }`}
      >
        <option value="" disabled>Select…</option>
        {SKILL_RATING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {locked && (
        <Lock size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
      )}
    </div>
  );
}

function LockedTextarea({ value }: { value: string }) {
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

interface SkillTableProps {
  category: 'languages' | 'frameworks';
  rows: SkillRow[];
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onChangeName: (id: string, name: string) => void;
  onChangeRating: (id: string, rating: SkillRating) => void;
}

function SkillTable({
  rows,
  addLabel,
  onAdd,
  onRemove,
  onChangeName,
  onChangeRating,
}: SkillTableProps) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full min-w-[580px] text-left border-collapse">
          <thead>
            <tr className="bg-[#F0F7FA] sticky top-0 z-10">
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[34%]">
                Skill Name
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-500 uppercase tracking-wide w-[20%]">
                Self-Rating
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide w-[20%] flex items-center gap-1">
                <Lock size={10} className="text-gray-300" />
                Manager Rating
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold font-heading text-gray-400 uppercase tracking-wide w-[26%]">
                <span className="flex items-center gap-1">
                  <Lock size={10} className="text-gray-300" />
                  Manager Comment
                </span>
              </th>
              <th className="w-10" />
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
                  {row.is_seed ? (
                    <span className="text-sm font-body text-gray-800">{row.name}</span>
                  ) : (
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => onChangeName(row.id, e.target.value)}
                      placeholder="Enter skill name"
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-xs font-body text-gray-800 placeholder-gray-400 outline-none hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors"
                    />
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <RatingSelect
                    value={row.employee_rating}
                    onChange={(v) => onChangeRating(row.id, v)}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <RatingSelect value={row.manager_rating} locked />
                </td>
                <td className="px-4 py-2.5">
                  <LockedTextarea value={row.manager_comment} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  {!row.is_seed && (
                    <button
                      type="button"
                      onClick={() => onRemove(row.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-dashed border-gray-300 text-xs font-semibold font-heading text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
      >
        <Plus size={13} />
        {addLabel}
      </button>
    </div>
  );
}

function SectionLabel({ title, helper }: { title: string; helper: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-heading font-semibold text-sm text-gray-800">{title}</h3>
      <p className="text-xs text-gray-400 font-body mt-0.5">{helper}</p>
    </div>
  );
}

export default function Step2Skills({ values, onChange }: Step2SkillsProps) {
  function updateLanguages(updater: (rows: SkillRow[]) => SkillRow[]) {
    onChange({ ...values, languages: updater(values.languages) });
  }

  function updateFrameworks(updater: (rows: SkillRow[]) => SkillRow[]) {
    onChange({ ...values, frameworks: updater(values.frameworks) });
  }

  function addRow(category: 'languages' | 'frameworks') {
    const row = makeSkillRow('', false);
    if (category === 'languages') {
      updateLanguages((rows) => [...rows, row]);
    } else {
      updateFrameworks((rows) => [...rows, row]);
    }
  }

  function removeRow(category: 'languages' | 'frameworks', id: string) {
    if (category === 'languages') {
      updateLanguages((rows) => rows.filter((r) => r.id !== id));
    } else {
      updateFrameworks((rows) => rows.filter((r) => r.id !== id));
    }
  }

  function changeName(category: 'languages' | 'frameworks', id: string, name: string) {
    const updater = (rows: SkillRow[]) =>
      rows.map((r) => (r.id === id ? { ...r, name } : r));
    if (category === 'languages') updateLanguages(updater);
    else updateFrameworks(updater);
  }

  function changeRating(category: 'languages' | 'frameworks', id: string, rating: SkillRating) {
    const updater = (rows: SkillRow[]) =>
      rows.map((r) => (r.id === id ? { ...r, employee_rating: rating } : r));
    if (category === 'languages') updateLanguages(updater);
    else updateFrameworks(updater);
  }

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h2 className="font-heading font-semibold text-base text-gray-800 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">2</span>
          Skill Taxonomy
        </h2>
        <p className="text-xs text-gray-400 font-body pl-7">
          Rate your proficiency in each skill. Manager fields are filled during the review stage.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 text-[11px] font-semibold font-heading uppercase tracking-wide">
            Languages
          </span>
        </div>
        <SkillTable
          category="languages"
          rows={values.languages}
          addLabel="Add Language"
          onAdd={() => addRow('languages')}
          onRemove={(id) => removeRow('languages', id)}
          onChangeName={(id, name) => changeName('languages', id, name)}
          onChangeRating={(id, rating) => changeRating('languages', id, rating)}
        />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 text-[11px] font-semibold font-heading uppercase tracking-wide">
            Frameworks
          </span>
        </div>
        <SkillTable
          category="frameworks"
          rows={values.frameworks}
          addLabel="Add Framework"
          onAdd={() => addRow('frameworks')}
          onRemove={(id) => removeRow('frameworks', id)}
          onChangeName={(id, name) => changeName('frameworks', id, name)}
          onChangeRating={(id, rating) => changeRating('frameworks', id, rating)}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <SectionLabel
            title="Tools"
            helper="Enter all tools, comma-separated"
          />
          <input
            type="text"
            value={values.tools}
            onChange={(e) => onChange({ ...values, tools: e.target.value })}
            placeholder="e.g. JIRA, Git, Confluence, Postman"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-body text-gray-800 placeholder-gray-400 outline-none hover:border-primary-300 focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-colors"
          />
          <div className="mt-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Lock size={11} className="text-gray-300" />
              <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Manager Comment</span>
            </div>
            <LockedTextarea value={values.tools_manager_comment} />
          </div>
        </div>

        <div>
          <SectionLabel
            title="Databases"
            helper="Enter all databases, comma-separated"
          />
          <input
            type="text"
            value={values.databases}
            onChange={(e) => onChange({ ...values, databases: e.target.value })}
            placeholder="e.g. PostgreSQL, MySQL, MongoDB, Redis"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-body text-gray-800 placeholder-gray-400 outline-none hover:border-primary-300 focus:border-primary-300 focus:ring-1 focus:ring-primary-100 transition-colors"
          />
          <div className="mt-3">
            <div className="flex items-center gap-1 mb-1.5">
              <Lock size={11} className="text-gray-300" />
              <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wide">Manager Comment</span>
            </div>
            <LockedTextarea value={values.databases_manager_comment} />
          </div>
        </div>
      </section>
    </div>
  );
}
