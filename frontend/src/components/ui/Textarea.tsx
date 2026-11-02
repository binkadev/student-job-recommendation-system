import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        id={inputId}
        className={`mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-slate-100 ${className}`}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        ref={ref}
        {...props}
      />
      {error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
});
