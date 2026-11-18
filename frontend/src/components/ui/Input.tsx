import { forwardRef, useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, id, className = "", ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="text-sm">
      <label htmlFor={inputId} className="block font-medium text-[#1B2533]">{label}</label>
      <input
        {...props}
        id={inputId}
        className={`mt-2 h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-[#0C111C] shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-[#D5DCE6] focus:border-[#237D70] focus:ring-[#237D70]/15"} ${className}`}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={[props["aria-describedby"], errorId].filter(Boolean).join(" ") || undefined}
        ref={ref}
      />
      {error ? <span id={errorId} role="alert" className="mt-1.5 block text-xs font-medium text-red-700">{error}</span> : null}
    </div>
  );
});
