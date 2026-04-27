import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { step1Schema } from '../types/form';
import type { Step1Input, Step1Values } from '../types/form';
import FormField from '../components/form/FormField';

// ─── Bare-input test harness (no FormField wrapper) ──────────────────────────

type TestFormProps = {
  onSubmit?: (v: Step1Values) => void;
  resetWithNumbers?: boolean;
  resetWithStrings?: boolean;
};

function TestForm({ onSubmit = vi.fn(), resetWithNumbers, resetWithStrings }: TestFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<Step1Input, unknown, Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      full_name: 'Test User',
      email: 'test@example.com',
      employee_number: 'E001',
      designation: 'Engineer',
      grade: 'L3',
      current_project: 'Project X',
      total_exp: '',
      relevant_exp: '',
      haptiq_exp: '',
      manager_name: '',
      manager_email: '',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (resetWithNumbers) {
      const draft = { total_exp: 5, relevant_exp: 5, haptiq_exp: 7 } as Record<string, unknown>;
      const sanitized: Partial<Step1Input> = {
        ...(draft as Partial<Step1Input>),
        total_exp: draft.total_exp != null ? String(draft.total_exp) : '',
        relevant_exp: draft.relevant_exp != null ? String(draft.relevant_exp) : '',
        haptiq_exp: draft.haptiq_exp != null ? String(draft.haptiq_exp) : '',
      };
      reset(
        {
          full_name: 'Test User', email: 'test@example.com', employee_number: 'E001',
          designation: 'Engineer', grade: 'L3', current_project: 'Project X',
          manager_name: '', manager_email: '',
          ...sanitized,
        },
        { keepErrors: false },
      );
    }
    if (resetWithStrings) {
      reset(
        {
          full_name: 'Test User', email: 'test@example.com', employee_number: 'E001',
          designation: 'Engineer', grade: 'L3', current_project: 'Project X',
          total_exp: '5', relevant_exp: '3', haptiq_exp: '1.5',
          manager_name: '', manager_email: '',
        },
        { keepErrors: false },
      );
    }
  }, [reset, resetWithNumbers, resetWithStrings]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input aria-label="total_exp" {...register('total_exp')} />
      {errors.total_exp && <span data-testid="err-total">{errors.total_exp.message}</span>}
      <input aria-label="relevant_exp" {...register('relevant_exp')} />
      {errors.relevant_exp && <span data-testid="err-relevant">{errors.relevant_exp.message}</span>}
      <input aria-label="haptiq_exp" {...register('haptiq_exp')} />
      {errors.haptiq_exp && <span data-testid="err-haptiq">{errors.haptiq_exp.message}</span>}
      <button type="button" data-testid="next" onClick={() => trigger()}>Next</button>
      <button type="submit">Submit</button>
    </form>
  );
}

// ─── FormField + register() integration harness ──────────────────────────────
// Verifies forwardRef wires the ref from register() to the DOM <input>.

function FormFieldTestHarness() {
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<Step1Input, unknown, Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      full_name: '',
      email: '',
      employee_number: '',
      designation: '',
      grade: '',
      current_project: '',
      total_exp: '',
      relevant_exp: '',
      haptiq_exp: '',
      manager_name: '',
      manager_email: '',
    },
    mode: 'onBlur',
  });

  const [capturedTotal, setCapturedTotal] = useState<string | undefined>(undefined);

  return (
    <form>
      <FormField label="Full Name" required error={errors.full_name?.message} {...register('full_name')} />
      <FormField label="Email" required error={errors.email?.message} {...register('email')} />
      <FormField label="Employee Number" required error={errors.employee_number?.message} {...register('employee_number')} />
      <FormField label="Designation" required error={errors.designation?.message} {...register('designation')} />
      <FormField label="Grade" required error={errors.grade?.message} {...register('grade')} />
      <FormField label="Current Project" required error={errors.current_project?.message} {...register('current_project')} />
      <FormField label="Total Exp" required error={errors.total_exp?.message} {...register('total_exp')} />
      <FormField label="Relevant Exp" required error={errors.relevant_exp?.message} {...register('relevant_exp')} />
      <FormField label="Haptiq Exp" required error={errors.haptiq_exp?.message} {...register('haptiq_exp')} />
      {errors.full_name && <span data-testid="ff-err-full_name">{errors.full_name.message}</span>}
      {errors.total_exp && <span data-testid="ff-err-total">{errors.total_exp.message}</span>}
      {errors.relevant_exp && <span data-testid="ff-err-relevant">{errors.relevant_exp.message}</span>}
      {errors.haptiq_exp && <span data-testid="ff-err-haptiq">{errors.haptiq_exp.message}</span>}
      <button
        type="button"
        data-testid="capture"
        onClick={() => { setCapturedTotal(String(getValues('total_exp') ?? 'UNSET')); }}
      >
        Capture
      </button>
      <button
        type="button"
        data-testid="ff-next"
        onClick={() => trigger()}
      >
        Next
      </button>
      <div data-testid="captured-total">{capturedTotal ?? 'UNSET'}</div>
    </form>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Experience fields validation (bare inputs)', () => {
  it('shows no error when valid number is typed into each field', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText('total_exp'), '5');
    await user.type(screen.getByLabelText('relevant_exp'), '3');
    await user.type(screen.getByLabelText('haptiq_exp'), '1.5');
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('shows required error when field is left empty after blur', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.click(screen.getByLabelText('total_exp'));
    await user.tab();
    expect(screen.getByTestId('err-total')).toHaveTextContent('This field is required');
  });

  it('clears error after typing a valid number into previously-touched empty field', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.click(screen.getByLabelText('total_exp'));
    await user.tab();
    expect(screen.getByTestId('err-total')).toBeInTheDocument();
    await user.click(screen.getByLabelText('total_exp'));
    await user.type(screen.getByLabelText('total_exp'), '5');
    await user.tab();
    expect(screen.queryByTestId('err-total')).toBeNull();
  });

  it('typing in one field does not show errors on other untouched empty fields', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText('total_exp'), '5');
    await user.tab();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('after trigger(), fixing each field removes its error without affecting others', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await act(async () => { screen.getByTestId('next').click(); });
    expect(screen.getByTestId('err-total')).toBeInTheDocument();

    await user.type(screen.getByLabelText('total_exp'), '5');
    await user.tab();
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.getByTestId('err-relevant')).toBeInTheDocument();
    expect(screen.getByTestId('err-haptiq')).toBeInTheDocument();

    await user.type(screen.getByLabelText('relevant_exp'), '3');
    await user.tab();
    expect(screen.queryByTestId('err-relevant')).toBeNull();

    await user.type(screen.getByLabelText('haptiq_exp'), '1.5');
    await user.tab();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('trigger() passes when all exp fields have valid numbers', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText('total_exp'), '5');
    await user.type(screen.getByLabelText('relevant_exp'), '3');
    await user.type(screen.getByLabelText('haptiq_exp'), '1.5');
    await act(async () => { screen.getByTestId('next').click(); });
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('trigger() shows required errors when exp fields are empty', async () => {
    render(<TestForm />);
    await act(async () => { screen.getByTestId('next').click(); });
    expect(screen.getByTestId('err-total')).toHaveTextContent('This field is required');
    expect(screen.getByTestId('err-relevant')).toHaveTextContent('This field is required');
    expect(screen.getByTestId('err-haptiq')).toHaveTextContent('This field is required');
  });

  it('shows "Enter a valid number" for non-numeric input', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText('total_exp'), 'abc');
    await user.tab();
    expect(screen.getByTestId('err-total')).toHaveTextContent('Enter a valid number');
  });

  it('shows error for numbers > 50', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText('total_exp'), '99');
    await user.tab();
    expect(screen.getByTestId('err-total')).toHaveTextContent('Must be 50 or less');
  });

  it('accepts 0 as a valid value', async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.type(screen.getByLabelText('total_exp'), '0');
    await user.tab();
    expect(screen.queryByTestId('err-total')).toBeNull();
  });

  it('does not show errors on initial render', () => {
    render(<TestForm />);
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('no errors on load when reset() is called with sanitized-from-number string values', async () => {
    render(<TestForm resetWithNumbers />);
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('no errors after trigger() when reset() was called with sanitized number values', async () => {
    render(<TestForm resetWithNumbers />);
    await act(async () => { screen.getByTestId('next').click(); });
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('no errors on load or after trigger() when reset() was called with string values', async () => {
    render(<TestForm resetWithStrings />);
    expect(screen.queryByTestId('err-total')).toBeNull();
    await act(async () => { screen.getByTestId('next').click(); });
    expect(screen.queryByTestId('err-total')).toBeNull();
    expect(screen.queryByTestId('err-relevant')).toBeNull();
    expect(screen.queryByTestId('err-haptiq')).toBeNull();
  });

  it('user can type new value after reset() with number values', async () => {
    const user = userEvent.setup();
    render(<TestForm resetWithNumbers />);
    const input = screen.getByLabelText('total_exp');
    await user.clear(input);
    await user.type(input, '10');
    await user.tab();
    expect(screen.queryByTestId('err-total')).toBeNull();
  });
});

describe('FormField forwardRef + RHF register() integration', () => {
  it('FormField forwards ref so RHF can read typed values via getValues()', async () => {
    const user = userEvent.setup();
    render(<FormFieldTestHarness />);

    await user.type(screen.getByLabelText(/total exp/i), '8');
    // capture getValues() after typing
    await act(async () => { screen.getByTestId('capture').click(); });
    // The captured value must be a string (RHF reads from DOM input), not undefined
    expect(screen.getByTestId('captured-total').textContent).not.toBe('UNSET');
  });

  it('trigger() shows required error on empty FormField-wrapped full_name', async () => {
    render(<FormFieldTestHarness />);
    await act(async () => { screen.getByTestId('ff-next').click(); });
    expect(screen.getByTestId('ff-err-full_name')).toBeInTheDocument();
  });

  it('trigger() shows required error on empty FormField-wrapped exp fields', async () => {
    render(<FormFieldTestHarness />);
    await act(async () => { screen.getByTestId('ff-next').click(); });
    expect(screen.getByTestId('ff-err-total')).toHaveTextContent('This field is required');
    expect(screen.getByTestId('ff-err-relevant')).toHaveTextContent('This field is required');
    expect(screen.getByTestId('ff-err-haptiq')).toHaveTextContent('This field is required');
  });

  it('trigger() passes for FormField-wrapped exp fields when values are typed', async () => {
    const user = userEvent.setup();
    render(<FormFieldTestHarness />);

    await user.type(screen.getByLabelText(/full name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/employee number/i), 'E001');
    await user.type(screen.getByLabelText(/designation/i), 'Engineer');
    await user.type(screen.getByLabelText(/grade/i), 'L3');
    await user.type(screen.getByLabelText(/current project/i), 'Alpha');
    await user.type(screen.getByLabelText(/total exp/i), '5');
    await user.type(screen.getByLabelText(/relevant exp/i), '3');
    await user.type(screen.getByLabelText(/haptiq exp/i), '1.5');

    await act(async () => { screen.getByTestId('ff-next').click(); });

    expect(screen.queryByTestId('ff-err-total')).toBeNull();
    expect(screen.queryByTestId('ff-err-relevant')).toBeNull();
    expect(screen.queryByTestId('ff-err-haptiq')).toBeNull();
  });
});
