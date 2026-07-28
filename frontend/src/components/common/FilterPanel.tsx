import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/Button";

interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  onReset?: () => void;
  onApply?: () => void;
}

export function FilterPanel({ title = "Bộ lọc", children, onReset, onApply }: FilterPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <SlidersHorizontal size={18} className="text-slate-500" />
          {title}
        </div>
        <div className="flex gap-2">
          {onReset ? <Button type="button" size="sm" variant="secondary" onClick={onReset}>Đặt lại</Button> : null}
          {onApply ? <Button type="button" size="sm" onClick={onApply}>Áp dụng</Button> : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}
