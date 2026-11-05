import { Inbox } from "lucide-react";

export function EmptyState({ message = "Chưa có dữ liệu." }: { message?: string }) {
  return (
    <div role="status" className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-8 text-center">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm"><Inbox size={20} /></span>
      <p className="max-w-md text-sm leading-6 text-slate-600">{message}</p>
    </div>
  );
}
