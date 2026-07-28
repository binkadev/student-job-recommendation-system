export function RichTextPlaceholder({ label = "Nội dung mô tả" }: { label?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex gap-2 border-b border-slate-200 p-2 text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-2 py-1">B</span>
        <span className="rounded bg-slate-100 px-2 py-1">I</span>
        <span className="rounded bg-slate-100 px-2 py-1">Danh sách</span>
      </div>
      <div className="min-h-32 p-3 text-sm text-slate-500">{label} sẽ được nhập tại đây.</div>
    </div>
  );
}
