interface StatusBadgeProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

const tones = {
  neutral: "border border-slate-200 bg-slate-100 text-slate-700",
  success: "border border-emerald-200/80 bg-emerald-50 text-emerald-800",
  warning: "border border-amber-200/80 bg-amber-50 text-amber-900",
  danger: "border border-red-200/80 bg-red-50 text-red-800",
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}
