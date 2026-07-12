export function EmptyState({ message = "Chưa có dữ liệu." }: { message?: string }) {
  return <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">{message}</div>;
}
