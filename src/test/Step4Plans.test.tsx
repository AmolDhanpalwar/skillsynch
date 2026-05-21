import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Step4Plans from '../pages/form/Step4Plans';
import type { Step4Values } from '../types/form';

const defaults: Step4Values = {
  upskilling_plan: '',
  manager_expectation_plan: '',
};

describe('Step4Plans — rendering', () => {
  it('renders without crashing', () => {
    expect(() => render(<Step4Plans values={defaults} onChange={vi.fn()} />)).not.toThrow();
  });

  it('renders the upskilling plan textarea', () => {
    render(<Step4Plans values={defaults} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/describe skills you plan/i)).toBeInTheDocument();
  });

  it('renders the manager expectation plan textarea', () => {
    render(<Step4Plans values={defaults} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/manager's feedback and expectations/i)).toBeInTheDocument();
  });

  it('renders info box about form locking on submit', () => {
    render(<Step4Plans values={defaults} onChange={vi.fn()} />);
    expect(screen.getByText(/once you submit/i)).toBeInTheDocument();
  });

  it('shows pre-filled upskilling_plan value', () => {
    render(
      <Step4Plans
        values={{ ...defaults, upskilling_plan: 'Learn Kubernetes' }}
        onChange={vi.fn()}
      />
    );
    const ta = screen.getByPlaceholderText(/describe skills you plan/i) as HTMLTextAreaElement;
    expect(ta.value).toBe('Learn Kubernetes');
  });

  it('shows pre-filled manager_expectation_plan value', () => {
    render(
      <Step4Plans
        values={{ ...defaults, manager_expectation_plan: 'Become team lead' }}
        onChange={vi.fn()}
      />
    );
    const ta = screen.getByPlaceholderText(/manager's feedback/i) as HTMLTextAreaElement;
    expect(ta.value).toBe('Become team lead');
  });
});

describe('Step4Plans — interactivity (unlocked)', () => {
  it('calls onChange with updated upskilling_plan on input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Step4Plans values={defaults} onChange={onChange} />);
    await user.type(screen.getByPlaceholderText(/describe skills you plan/i), 'A');
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.upskilling_plan).toContain('A');
  });

  it('upskilling textarea is NOT disabled when locked=false', () => {
    render(<Step4Plans values={defaults} onChange={vi.fn()} locked={false} />);
    const ta = screen.getByPlaceholderText(/describe skills you plan/i) as HTMLTextAreaElement;
    expect(ta.disabled).toBe(false);
  });
});

describe('Step4Plans — locked state', () => {
  it('upskilling textarea is disabled when locked=true', () => {
    render(<Step4Plans values={defaults} onChange={vi.fn()} locked={true} />);
    const ta = screen.getByPlaceholderText(/describe skills you plan/i) as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
  });

  it('does not call onChange when locked=true and user tries to type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Step4Plans values={defaults} onChange={onChange} locked={true} />);
    const ta = screen.getByPlaceholderText(/describe skills you plan/i);
    await user.type(ta, 'test input');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('manager expectation textarea is always disabled (read-only for employees)', () => {
    render(<Step4Plans values={defaults} onChange={vi.fn()} locked={false} />);
    const ta = screen.getByPlaceholderText(/manager's feedback/i) as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
  });

  it('applies locked styling class when locked=true', () => {
    const { container } = render(
      <Step4Plans values={defaults} onChange={vi.fn()} locked={true} />
    );
    const ta = container.querySelector('textarea:not([placeholder*="Manager"])') as HTMLTextAreaElement;
    expect(ta?.className).toContain('cursor-not-allowed');
  });
});

describe('Step4Plans — onChange shape', () => {
  it('preserves manager_expectation_plan when upskilling_plan changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Step4Plans
        values={{ upskilling_plan: '', manager_expectation_plan: 'Existing manager note' }}
        onChange={onChange}
      />
    );
    await user.type(screen.getByPlaceholderText(/describe skills you plan/i), 'X');
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.manager_expectation_plan).toBe('Existing manager note');
  });
});
