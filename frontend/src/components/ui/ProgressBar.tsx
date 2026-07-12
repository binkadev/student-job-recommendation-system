interface ProgressBarProps {
  value: number;
  label?: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
