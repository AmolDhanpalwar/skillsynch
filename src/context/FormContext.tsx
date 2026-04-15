import { createContext, useContext, useState } from 'react';
import type { FormStatus } from '../types';

interface FormContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  formId: string | null;
  setFormId: (id: string | null) => void;
  formStatus: FormStatus;
  setFormStatus: (status: FormStatus) => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formId, setFormId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<FormStatus>('draft');

  return (
    <FormContext.Provider
      value={{ currentStep, setCurrentStep, formId, setFormId, formStatus, setFormStatus }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useFormContext must be used within FormProvider');
  return ctx;
}
