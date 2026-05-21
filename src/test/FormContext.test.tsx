import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormProvider, useFormContext } from '../context/FormContext';
import type { FormStatus } from '../types';

// ─── Test consumer component ─────────────────────────────────────────────────

function Consumer() {
  const { currentStep, setCurrentStep, formId, setFormId, formStatus, setFormStatus } = useFormContext();
  return (
    <div>
      <span data-testid="step">{currentStep}</span>
      <span data-testid="formId">{formId ?? 'null'}</span>
      <span data-testid="status">{formStatus}</span>
      <button onClick={() => setCurrentStep(3)}>Go Step 3</button>
      <button onClick={() => setFormId('abc-123')}>Set Form ID</button>
      <button onClick={() => setFormStatus('pending_review')}>Set Pending</button>
      <button onClick={() => setFormStatus('approved')}>Set Approved</button>
    </div>
  );
}

function renderConsumer() {
  render(
    <FormProvider>
      <Consumer />
    </FormProvider>
  );
}

describe('FormContext — initial state', () => {
  it('currentStep defaults to 1', () => {
    renderConsumer();
    expect(screen.getByTestId('step').textContent).toBe('1');
  });

  it('formId defaults to null', () => {
    renderConsumer();
    expect(screen.getByTestId('formId').textContent).toBe('null');
  });

  it('formStatus defaults to "draft"', () => {
    renderConsumer();
    expect(screen.getByTestId('status').textContent).toBe('draft');
  });
});

describe('FormContext — state updates', () => {
  it('setCurrentStep updates the displayed step', async () => {
    const user = userEvent.setup();
    renderConsumer();
    await user.click(screen.getByText('Go Step 3'));
    expect(screen.getByTestId('step').textContent).toBe('3');
  });

  it('setFormId updates the displayed form id', async () => {
    const user = userEvent.setup();
    renderConsumer();
    await user.click(screen.getByText('Set Form ID'));
    expect(screen.getByTestId('formId').textContent).toBe('abc-123');
  });

  it('setFormStatus updates to pending_review', async () => {
    const user = userEvent.setup();
    renderConsumer();
    await user.click(screen.getByText('Set Pending'));
    expect(screen.getByTestId('status').textContent).toBe('pending_review');
  });

  it('setFormStatus updates to approved', async () => {
    const user = userEvent.setup();
    renderConsumer();
    await user.click(screen.getByText('Set Approved'));
    expect(screen.getByTestId('status').textContent).toBe('approved');
  });

  it('multiple state updates are independent', async () => {
    const user = userEvent.setup();
    renderConsumer();
    await user.click(screen.getByText('Go Step 3'));
    await user.click(screen.getByText('Set Form ID'));
    await user.click(screen.getByText('Set Pending'));
    expect(screen.getByTestId('step').textContent).toBe('3');
    expect(screen.getByTestId('formId').textContent).toBe('abc-123');
    expect(screen.getByTestId('status').textContent).toBe('pending_review');
  });
});

describe('FormContext — useFormContext error guard', () => {
  it('throws when used outside FormProvider', () => {
    const consoleError = console.error;
    console.error = () => {};
    expect(() => render(<Consumer />)).toThrow('useFormContext must be used within FormProvider');
    console.error = consoleError;
  });
});

describe('FormContext — all FormStatus values cycle correctly', () => {
  const statuses: FormStatus[] = ['draft', 'pending_review', 'returned', 'approved'];

  statuses.forEach(status => {
    it(`can set formStatus to "${status}"`, async () => {
      function StatusSetter({ s }: { s: FormStatus }) {
        const { setFormStatus, formStatus } = useFormContext();
        return (
          <div>
            <span data-testid="s">{formStatus}</span>
            <button onClick={() => setFormStatus(s)}>Set</button>
          </div>
        );
      }
      const { unmount } = render(
        <FormProvider><StatusSetter s={status} /></FormProvider>
      );
      const user = userEvent.setup();
      await user.click(screen.getByText('Set'));
      expect(screen.getByTestId('s').textContent).toBe(status);
      unmount();
    });
  });
});
