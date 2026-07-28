import type { ReactNode } from "react";
import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  helperText?: string;
  trend?: string;
}

export function StatCard({ label, value, icon, helperText, trend }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        {icon ? <span className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</span> : null}
      </div>
      {helperText || trend ? (
        <p className="mt-3 text-sm text-slate-500">
          {trend ? <span className="font-medium text-emerald-600">{trend}</span> : null} {helperText}
        </p>
      ) : null}
    </Card>
  );
}
