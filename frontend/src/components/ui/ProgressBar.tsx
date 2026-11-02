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
      <div role="progressbar" aria-label={label ?? "Tiến độ"} aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
