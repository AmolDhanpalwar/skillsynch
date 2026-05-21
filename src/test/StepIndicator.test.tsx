import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StepIndicator from '../components/form/StepIndicator';
import { FORM_STEPS } from '../types/form';

describe('StepIndicator', () => {
  it('renders all 5 step numbers / check icons', () => {
    render(<StepIndicator currentStep={1} />);
    // Steps 2-5 show their numbers, step 1 is active (shows "1")
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders step labels on sm+ screens (text present in DOM)', () => {
    render(<StepIndicator currentStep={1} />);
    FORM_STEPS.forEach(step => {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    });
  });

  it('does not render step numbers for completed steps (shows check icon instead)', () => {
    render(<StepIndicator currentStep={3} />);
    // Steps 1 and 2 are done — their numbers should not appear as text
    // Step 3 is active — its number "3" is shown
    // Steps 4 and 5 are upcoming — their numbers appear
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders check icons for completed steps', () => {
    const { container } = render(<StepIndicator currentStep={3} />);
    // lucide Check renders an svg — there should be 2 for steps 1 and 2
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows all steps as upcoming when currentStep is 1', () => {
    render(<StepIndicator currentStep={1} />);
    // No check icons for done steps — none are done on step 1
    expect(screen.queryByText('1')).toBeInTheDocument(); // active
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders 4 connector bars between the 5 steps', () => {
    const { container } = render(<StepIndicator currentStep={1} />);
    // Each connector is a div with bg-gray-200
    const connectors = container.querySelectorAll('.bg-gray-200');
    expect(connectors.length).toBe(4);
  });

  it('active step progress bar fills connector on its right to 0%', () => {
    const { container } = render(<StepIndicator currentStep={2} />);
    // The bar AFTER a done step (step 1) should have width 100%
    // The bar after the active step should have width 0%
    const bars = container.querySelectorAll('.h-full');
    const widths = Array.from(bars).map(b => (b as HTMLElement).style.width);
    expect(widths).toContain('100%'); // step 1 done → bar fills
    expect(widths).toContain('0%');   // step 2 active → bar not filled
  });

  it('renders correct step label for active step', () => {
    render(<StepIndicator currentStep={4} />);
    expect(screen.getByText('Certifications')).toBeInTheDocument();
  });

  it('does not crash on currentStep = 5 (last step)', () => {
    expect(() => render(<StepIndicator currentStep={5} />)).not.toThrow();
  });

  it('does not crash on currentStep = 0 (before start)', () => {
    expect(() => render(<StepIndicator currentStep={0} />)).not.toThrow();
  });
});
