import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
  description?: string;
  error?: string;
  required?: boolean;
}

export function FormField({ label, children, description, error, required }: FormFieldProps) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700">
        <span>{label}</span>
        {required ? <span className="text-red-500">*</span> : null}
      </div>
      {children}
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
