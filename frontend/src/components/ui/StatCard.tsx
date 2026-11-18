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
          <p className="text-sm font-medium text-[#4B5C73]">{label}</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#0C111C] tabular-nums">{value}</p>
        </div>
        {icon ? (
          <span className="rounded-xl border border-[#237D70]/20 bg-[#F0FAF8] p-2.5 text-[#134B43]">
            {icon}
          </span>
        ) : null}
      </div>
      {helperText || trend ? (
        <p className="mt-3 text-sm text-[#4B5C73]">
          {trend ? <span className="font-semibold text-[#134B43]">{trend}</span> : null} {helperText}
        </p>
      ) : null}
    </Card>
  );
}
