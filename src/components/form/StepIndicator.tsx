import { Check } from 'lucide-react';
import { FORM_STEPS } from '../../types/form';

interface StepIndicatorProps {
  currentStep: number;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full">
      {FORM_STEPS.map((step, index) => {
        const done = step.number < currentStep;
        const active = step.number === currentStep;
        const upcoming = step.number > currentStep;

        return (
          <div key={step.number} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-heading
                  transition-all duration-300 border-2
                  ${done
                    ? 'bg-accent-500 border-accent-500 text-white'
                    : active
                    ? 'bg-primary-500 border-primary-500 text-white shadow-md shadow-primary-200'
                    : 'bg-white border-gray-200 text-gray-400'
                  }
                `}
              >
                {done ? <Check size={14} strokeWidth={3} /> : step.number}
              </div>
              <span
                className={`
                  mt-1.5 text-[10px] font-semibold font-heading tracking-wide whitespace-nowrap hidden sm:block
                  ${active ? 'text-primary-600' : done ? 'text-accent-600' : 'text-gray-400'}
                `}
              >
                {step.label}
              </span>
            </div>

            {index < FORM_STEPS.length - 1 && (
              <div className="flex-1 mx-2 mb-4 sm:mb-0 h-0.5 rounded-full overflow-hidden bg-gray-200">
                <div
                  className="h-full bg-accent-400 transition-all duration-500"
                  style={{ width: done ? '100%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
