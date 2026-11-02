import { forwardRef, useId, type SelectHTMLAttributes } from "react";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, options, error, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        id={inputId}
        className={`mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-100 ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        ref={ref}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
});
