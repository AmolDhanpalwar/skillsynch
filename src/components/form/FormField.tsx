import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, required, hint, className, id, ...inputProps },
  ref,
) {
  const fieldId = id ?? (inputProps.name ? `field-${inputProps.name}` : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={fieldId}
        className="text-xs font-semibold font-heading text-gray-600 uppercase tracking-wide flex items-center gap-1"
      >
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <input
        ref={ref}
        id={fieldId}
        {...inputProps}
        className={`
          w-full px-3.5 py-2.5 rounded-xl border text-sm font-body text-gray-800
          placeholder-gray-400 outline-none transition-all duration-200
          ${inputProps.readOnly || inputProps.disabled
            ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-default'
            : error
            ? 'bg-white border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
            : 'bg-white border-gray-200 hover:border-gray-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-400/15'
          }
          ${className ?? ''}
        `}
      />
      {hint && !error && (
        <p className="text-xs text-gray-400 font-body">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-500 font-body flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
          {error}
        </p>
      )}
    </div>
  );
});

export default FormField;
