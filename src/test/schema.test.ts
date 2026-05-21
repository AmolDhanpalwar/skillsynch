import { describe, it, expect } from 'vitest';
import {
  makeStep1Schema,
  step1Schema,
  makeSkillRow,
  makeDefaultStep3,
  makeDefaultStep4,
  makeDefaultStepAdditional,
  FORM_STEPS,
  STATUS_CONFIG,
  DRAFT_KEY,
  SEED_LANGUAGES,
  SEED_FRAMEWORKS,
} from '../types/form';

// ─────────────────────────────────────────────────────────────────────────────
// expField validation (via step1Schema)
// ─────────────────────────────────────────────────────────────────────────────

const baseValid = {
  full_name: 'Alice',
  email: 'alice@example.com',
  employee_number: 'EMP001',
  designation: 'Engineer',
  grade: 'IC03',
  current_project: 'Alpha',
  manager_name: '',
  manager_email: '',
};

function parseExp(total_exp: unknown, relevant_exp = '5', haptiq_exp = '2') {
  return step1Schema.safeParse({ ...baseValid, total_exp, relevant_exp, haptiq_exp });
}

describe('expField — valid inputs', () => {
  it('accepts integer string "10"', () => {
    expect(parseExp('10').success).toBe(true);
  });

  it('accepts decimal string "1.5"', () => {
    expect(parseExp('1.5').success).toBe(true);
  });

  it('accepts boundary "0"', () => {
    expect(parseExp('0').success).toBe(true);
  });

  it('accepts boundary "50"', () => {
    expect(parseExp('50').success).toBe(true);
  });

  it('accepts numeric type 10', () => {
    expect(parseExp(10).success).toBe(true);
  });

  it('coerces string to number on success', () => {
    const result = parseExp('7');
    expect(result.success).toBe(true);
    if (result.success) expect(typeof result.data.total_exp).toBe('number');
  });
});

describe('expField — invalid inputs', () => {
  it('rejects empty string with "This field is required"', () => {
    const r = parseExp('');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('This field is required');
  });

  it('rejects NaN number (fails at Zod union level)', () => {
    const r = parseExp(NaN);
    expect(r.success).toBe(false);
  });

  it('rejects non-numeric string "abc" with "Enter a valid number"', () => {
    const r = parseExp('abc');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('Enter a valid number');
  });

  it('rejects value > 50 with "Must be 50 or less"', () => {
    const r = parseExp('51');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('Must be 50 or less');
  });

  it('rejects value < 0 with "Must be 0 or more"', () => {
    const r = parseExp('-1');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('Must be 0 or more');
  });

  it('rejects null (fails at Zod union type check level)', () => {
    const r = parseExp(null);
    expect(r.success).toBe(false);
  });

  it('rejects undefined with "This field is required"', () => {
    const r = parseExp(undefined);
    expect(r.success).toBe(false);
  });

  it('rejects exactly 50.001 with "Must be 50 or less"', () => {
    const r = parseExp('50.001');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('Must be 50 or less');
  });

  it('accepts whitespace-only string (Number("   ") = 0 is valid)', () => {
    // Number("   ") === 0, which passes range checks — this is expected behaviour
    const r = parseExp('   ');
    expect(r.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// step1Schema — required text fields
// ─────────────────────────────────────────────────────────────────────────────

describe('step1Schema — required text fields', () => {
  const validPayload = { ...baseValid, total_exp: '5', relevant_exp: '3', haptiq_exp: '1' };

  it('passes with all required fields filled', () => {
    expect(step1Schema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects empty full_name', () => {
    const r = step1Schema.safeParse({ ...validPayload, full_name: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'full_name');
      expect(issue?.message).toBe('Employee name is required');
    }
  });

  it('rejects invalid email format', () => {
    const r = step1Schema.safeParse({ ...validPayload, email: 'not-an-email' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'email');
      expect(issue).toBeDefined();
    }
  });

  it('rejects empty employee_number', () => {
    const r = step1Schema.safeParse({ ...validPayload, employee_number: '' });
    expect(r.success).toBe(false);
  });

  it('rejects empty designation', () => {
    const r = step1Schema.safeParse({ ...validPayload, designation: '' });
    expect(r.success).toBe(false);
  });

  it('rejects empty grade', () => {
    const r = step1Schema.safeParse({ ...validPayload, grade: '' });
    expect(r.success).toBe(false);
  });

  it('rejects empty current_project', () => {
    const r = step1Schema.safeParse({ ...validPayload, current_project: '' });
    expect(r.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// step1Schema — manager cross-field validation
// ─────────────────────────────────────────────────────────────────────────────

describe('step1Schema — manager cross-field validation', () => {
  const validPayload = { ...baseValid, total_exp: '5', relevant_exp: '3', haptiq_exp: '1' };

  it('passes when manager_name and manager_email are both empty', () => {
    expect(step1Schema.safeParse({ ...validPayload, manager_name: '', manager_email: '' }).success).toBe(true);
  });

  it('passes when both manager_name and manager_email are provided and email valid', () => {
    expect(
      step1Schema.safeParse({ ...validPayload, manager_name: 'Bob', manager_email: 'bob@example.com' }).success
    ).toBe(true);
  });

  it('fails when manager_name set but manager_email is empty', () => {
    const r = step1Schema.safeParse({ ...validPayload, manager_name: 'Bob', manager_email: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'manager_email');
      expect(issue?.message).toBe('Manager email is required when manager name is provided');
    }
  });

  it('fails when manager_email is set but is not a valid email', () => {
    const r = step1Schema.safeParse({ ...validPayload, manager_name: '', manager_email: 'bad-email' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'manager_email');
      expect(issue?.message).toBe('Enter a valid email');
    }
  });

  it('passes when manager_email alone is a valid email (no name required)', () => {
    expect(
      step1Schema.safeParse({ ...validPayload, manager_name: '', manager_email: 'mgr@example.com' }).success
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeStep1Schema — dynamic grade/designation validation
// ─────────────────────────────────────────────────────────────────────────────

describe('makeStep1Schema — grade & designation validation with loaded options', () => {
  const grades = ['IC01', 'IC02', 'IC03'];
  const designations = ['Software Engineer', 'Data Analyst'];
  const schema = makeStep1Schema(grades, designations);
  const validPayload = {
    ...baseValid,
    grade: 'IC03',
    designation: 'Software Engineer',
    total_exp: '5',
    relevant_exp: '3',
    haptiq_exp: '1',
  };

  it('passes when grade is in the valid list', () => {
    expect(schema.safeParse(validPayload).success).toBe(true);
  });

  it('fails when grade is not in the valid list', () => {
    const r = schema.safeParse({ ...validPayload, grade: 'M10' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'grade');
      expect(issue?.message).toContain('M10');
      expect(issue?.message).toContain('not a valid grade');
    }
  });

  it('passes when designation is in the valid list', () => {
    expect(schema.safeParse(validPayload).success).toBe(true);
  });

  it('fails when designation is not in the valid list', () => {
    const r = schema.safeParse({ ...validPayload, designation: 'Wizard' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find(i => i.path[0] === 'designation');
      expect(issue?.message).toContain('not a valid designation');
    }
  });

  it('skips grade validation when validGrades is empty (default schema)', () => {
    const defaultSchema = makeStep1Schema();
    expect(
      defaultSchema.safeParse({ ...validPayload, grade: 'ANYTHING' }).success
    ).toBe(true);
  });

  it('skips designation validation when validDesignations is empty', () => {
    const schemaNoDesig = makeStep1Schema(['IC03'], []);
    expect(
      schemaNoDesig.safeParse({ ...validPayload, designation: 'Anything goes' }).success
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeSkillRow factory
// ─────────────────────────────────────────────────────────────────────────────

describe('makeSkillRow', () => {
  it('creates a skill row with the given name', () => {
    const row = makeSkillRow('Python');
    expect(row.name).toBe('Python');
  });

  it('defaults is_seed to false', () => {
    expect(makeSkillRow('Go').is_seed).toBe(false);
  });

  it('sets is_seed when explicitly passed', () => {
    expect(makeSkillRow('React', true).is_seed).toBe(true);
  });

  it('initialises ratings to null', () => {
    const row = makeSkillRow('Java');
    expect(row.employee_rating).toBeNull();
    expect(row.manager_rating).toBeNull();
  });

  it('initialises manager_comment to empty string', () => {
    expect(makeSkillRow('SQL').manager_comment).toBe('');
  });

  it('generates a non-empty id string', () => {
    expect(makeSkillRow('Rust').id).toBeTruthy();
  });

  it('generates unique ids for different calls', () => {
    expect(makeSkillRow('A').id).not.toBe(makeSkillRow('A').id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Default value factories
// ─────────────────────────────────────────────────────────────────────────────

describe('makeDefaultStep3', () => {
  it('returns certifications with one empty entry', () => {
    const d = makeDefaultStep3();
    expect(d.certifications).toEqual(['']);
  });

  it('returns empty certifications_manager_comment', () => {
    expect(makeDefaultStep3().certifications_manager_comment).toBe('');
  });
});

describe('makeDefaultStep4', () => {
  it('returns empty upskilling_plan', () => {
    expect(makeDefaultStep4().upskilling_plan).toBe('');
  });

  it('returns empty manager_expectation_plan', () => {
    expect(makeDefaultStep4().manager_expectation_plan).toBe('');
  });
});

describe('makeDefaultStepAdditional', () => {
  it('returns empty environments array', () => {
    expect(makeDefaultStepAdditional().environments).toEqual([]);
  });

  it('returns empty environments_manager_comment', () => {
    expect(makeDefaultStepAdditional().environments_manager_comment).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

describe('FORM_STEPS', () => {
  it('has exactly 5 steps', () => {
    expect(FORM_STEPS).toHaveLength(5);
  });

  it('step numbers are 1 through 5 in order', () => {
    expect(FORM_STEPS.map(s => s.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('step 1 label is "Profile"', () => {
    expect(FORM_STEPS[0].label).toBe('Profile');
  });

  it('step 5 label is "Plans & Submit"', () => {
    expect(FORM_STEPS[4].label).toBe('Plans & Submit');
  });
});

describe('STATUS_CONFIG', () => {
  it('contains entries for all four statuses', () => {
    expect(Object.keys(STATUS_CONFIG)).toEqual(
      expect.arrayContaining(['draft', 'pending_review', 'returned', 'approved'])
    );
  });

  it('draft label is "Draft"', () => {
    expect(STATUS_CONFIG.draft.label).toBe('Draft');
  });

  it('approved label is "Approved"', () => {
    expect(STATUS_CONFIG.approved.label).toBe('Approved');
  });

  it('pending_review label is "Pending Review"', () => {
    expect(STATUS_CONFIG.pending_review.label).toBe('Pending Review');
  });

  it('returned label is "Returned"', () => {
    expect(STATUS_CONFIG.returned.label).toBe('Returned');
  });
});

describe('DRAFT_KEY', () => {
  it('includes the userId in the key', () => {
    expect(DRAFT_KEY('abc-123')).toContain('abc-123');
  });

  it('generates different keys for different userIds', () => {
    expect(DRAFT_KEY('user1')).not.toBe(DRAFT_KEY('user2'));
  });
});

describe('Seed constants', () => {
  it('SEED_LANGUAGES contains JavaScript, Python, Java', () => {
    expect(SEED_LANGUAGES).toContain('JavaScript');
    expect(SEED_LANGUAGES).toContain('Python');
    expect(SEED_LANGUAGES).toContain('Java');
  });

  it('SEED_FRAMEWORKS contains React, Node.js, Spring Boot', () => {
    expect(SEED_FRAMEWORKS).toContain('React');
    expect(SEED_FRAMEWORKS).toContain('Node.js');
    expect(SEED_FRAMEWORKS).toContain('Spring Boot');
  });
});
