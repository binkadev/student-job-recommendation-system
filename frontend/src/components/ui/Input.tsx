import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        id={inputId}
        className={`mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-100 ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        ref={ref}
        {...props}
      />
      {error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
});
