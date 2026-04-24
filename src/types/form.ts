import { z } from 'zod';
import type { FormStatus } from './index';

const expField = z.custom<number | string>(
  (val) => {
    if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) return false;
    return !isNaN(Number(val));
  },
  { error: (issue) => ({ message: issue.input === '' || issue.input == null || (typeof issue.input === 'number' && isNaN(issue.input as number)) ? 'This field is required' : 'Enter a valid number' }) }
).transform((val) => Number(val))
  .pipe(
    z.number()
      .refine((v) => v >= 0, { message: 'Must be 0 or more' })
      .refine((v) => v <= 50, { message: 'Must be 50 or less' })
  );

export const step1Schema = z.object({
  full_name: z.string().min(1, 'Employee name is required').default(''),
  email: z.string().email('Enter a valid email').default(''),
  employee_number: z.string().min(1, 'Employee number is required').default(''),
  designation: z.string().min(1, 'Designation is required').default(''),
  grade: z.string().min(1, 'Grade is required').default(''),
  current_project: z.string().min(1, 'Current project is required').default(''),
  total_exp: expField,
  relevant_exp: expField,
  haptiq_exp: expField,
  manager_name: z.string().default(''),
  manager_email: z.string().default(''),
});

export type Step1Values = z.infer<typeof step1Schema>;
export type Step1Input = z.input<typeof step1Schema>;

export const SKILL_RATING_OPTIONS = [
  { value: 0, label: '0 — No Knowledge' },
  { value: 1, label: '1 — Beginner' },
  { value: 2, label: '2 — Intermediate' },
  { value: 3, label: '3 — Advanced' },
  { value: 4, label: '4 — Expert' },
] as const;

export type SkillRating = 0 | 1 | 2 | 3 | 4;

export interface SkillRow {
  id: string;
  name: string;
  employee_rating: SkillRating | null;
  manager_rating: SkillRating | null;
  manager_comment: string;
  is_seed: boolean;
}

export interface Step2Values {
  languages: SkillRow[];
  frameworks: SkillRow[];
  tools: string;
  tools_manager_comment: string;
  databases: string;
  databases_manager_comment: string;
}

export const SEED_LANGUAGES: string[] = ['JavaScript', 'Python', 'Java'];
export const SEED_FRAMEWORKS: string[] = ['React', 'Node.js', 'Spring Boot'];

export function makeSkillRow(name: string, is_seed = false): SkillRow {
  return {
    id: crypto.randomUUID(),
    name,
    employee_rating: null,
    manager_rating: null,
    manager_comment: '',
    is_seed,
  };
}

export interface Step3Values {
  certifications: string[];
  certifications_manager_comment: string;
}

export function makeDefaultStep3(): Step3Values {
  return { certifications: [''], certifications_manager_comment: '' };
}

export interface Step4Values {
  upskilling_plan: string;
  manager_expectation_plan: string;
}

export function makeDefaultStep4(): Step4Values {
  return { upskilling_plan: '', manager_expectation_plan: '' };
}

export const FORM_STEPS: { number: number; label: string }[] = [
  { number: 1, label: 'Profile' },
  { number: 2, label: 'Skills' },
  { number: 3, label: 'Certifications' },
  { number: 4, label: 'Plans & Submit' },
];

export const STATUS_CONFIG: Record<
  FormStatus,
  { label: string; classes: string }
> = {
  draft: {
    label: 'Draft',
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  pending_review: {
    label: 'Pending Review',
    classes: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  returned: {
    label: 'Returned',
    classes: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  approved: {
    label: 'Approved',
    classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

export const DRAFT_KEY = (userId: string) => `skillsync_form_draft_${userId}`;
