import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { step1Schema } from '../types/form';
import type { Step1Input, Step1Values } from '../types/form';

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
      // Simulates stale localStorage draft with numbers (pre-fix data)
      const draft = { total_exp: 5, relevant_exp: 5, haptiq_exp: 7 } as Record<string, unknown>;
      const sanitized: Partial<Step1Input> = {
        ...(draft as Partial<Step1Input>),
        total_exp: draft.total_exp != null ? String(draft.total_exp) : '',
        relevant_exp: draft.relevant_exp != null ? String(draft.relevant_exp) : '',
        haptiq_exp: draft.haptiq_exp != null ? String(draft.haptiq_exp) : '',
      };
      reset({
        full_name: 'Test User', email: 'test@example.com', employee_number: 'E001',
        designation: 'Engineer', grade: 'L3', current_project: 'Project X',
        manager_name: '', manager_email: '',
        ...sanitized,
      }, { keepErrors: false });
    }
    if (resetWithStrings) {
      reset({
        full_name: 'Test User', email: 'test@example.com', employee_number: 'E001',
        designation: 'Engineer', grade: 'L3', current_project: 'Project X',
        total_exp: '5', relevant_exp: '3', haptiq_exp: '1.5',
        manager_name: '', manager_email: '',
      }, { keepErrors: false });
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

describe('Experience fields validation', () => {
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
    // Reproduces the bug: stale localStorage had numbers, now sanitized to strings before reset()
    render(<TestForm resetWithNumbers />);
    // Should show no errors immediately on load
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
