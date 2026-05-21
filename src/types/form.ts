import { z } from 'zod';
import type { FormStatus } from './index';

const expField = z
  .union([z.string(), z.number()])
  .transform((val, ctx) => {
    if (val === '' || val === null || val === undefined || (typeof val === 'number' && isNaN(val as number))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'This field is required' });
      return z.NEVER;
    }
    const n = Number(val);
    if (isNaN(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid number' });
      return z.NEVER;
    }
    if (n < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be 0 or more' });
      return z.NEVER;
    }
    if (n > 50) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be 50 or less' });
      return z.NEVER;
    }
    return n;
  });

export function makeStep1Schema(validGrades: string[] = [], validDesignations: string[] = []) {
  return z.object({
    full_name: z.string().min(1, 'Employee name is required'),
    email: z.string().email('Enter a valid email'),
    employee_number: z.string().min(1, 'Employee number is required'),
    designation: z.string().min(1, 'Select a valid designation from the list'),
    grade: z.string().min(1, 'Select a valid grade from the list'),
    current_project: z.string().min(1, 'Current project is required'),
    total_exp: expField,
    relevant_exp: expField,
    haptiq_exp: expField,
    manager_name: z.string(),
    manager_email: z.string(),
  }).superRefine((data, ctx) => {
    // Validate grade against known valid options (when options are loaded)
    if (validGrades.length > 0 && data.grade && !validGrades.includes(data.grade)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${data.grade}" is not a valid grade — please select from the list`,
        path: ['grade'],
      });
    }
    // Validate designation against known valid options (when options are loaded)
    if (validDesignations.length > 0 && data.designation && !validDesignations.includes(data.designation)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${data.designation}" is not a valid designation — please select from the list`,
        path: ['designation'],
      });
    }
    if (data.manager_name.trim() && !data.manager_email.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Manager email is required when manager name is provided',
        path: ['manager_email'],
      });
    }
    if (data.manager_email.trim() && !z.string().email().safeParse(data.manager_email.trim()).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid email',
        path: ['manager_email'],
      });
    }
  });
}

// Default schema (no option validation) — used as initial resolver before options load
export const step1Schema = makeStep1Schema();

export type Step1Values = z.infer<typeof step1Schema>;
export type Step1Input = z.input<typeof step1Schema>;

export type SkillRatingOption = { sort_order: number; label: string };

export type SkillRating = number;

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

export interface StepAdditionalValues {
  environments: SkillRow[];
  environments_manager_comment: string;
}

export function makeDefaultStepAdditional(): StepAdditionalValues {
  return { environments: [], environments_manager_comment: '' };
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
  { number: 3, label: 'Additional Skills' },
  { number: 4, label: 'Certifications' },
  { number: 5, label: 'Plans & Submit' },
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
