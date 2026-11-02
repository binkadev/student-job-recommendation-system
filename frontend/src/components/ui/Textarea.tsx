import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="text-sm">
      <label htmlFor={inputId} className="block font-medium text-slate-700">{label}</label>
      <textarea
        {...props}
        id={inputId}
        className={`mt-2 min-h-28 w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-brand-500 focus:ring-brand-100"} ${className}`}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={[props["aria-describedby"], errorId].filter(Boolean).join(" ") || undefined}
        ref={ref}
      />
      {error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs text-red-700">{error}</span> : null}
    </div>
  );
});
