import { LoaderCircle } from "lucide-react";

export function LoadingState({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-5 py-4 text-sm text-brand-800">
      <LoaderCircle aria-hidden="true" className="shrink-0 animate-spin" size={19} />
      <span>{message}</span>
    </div>
  );
}
