import { SlidersHorizontal } from "lucide-react";

export function FilterBar() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <SlidersHorizontal size={18} className="text-slate-500" />
      <span className="text-sm font-medium text-slate-700">Bộ lọc</span>
      <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600">Địa điểm</button>
      <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600">Kỹ năng</button>
      <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600">Mức lương</button>
    </div>
  );
}
