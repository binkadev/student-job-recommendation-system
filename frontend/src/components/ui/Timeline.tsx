interface TimelineItem {
  label: string;
  at: string;
  note: string;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={`${item.label}-${item.at}`} className="relative border-l border-slate-200 pl-4">
          <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-brand-600" />
          <p className="text-sm font-medium text-slate-900">{item.label}</p>
          <p className="text-xs text-slate-500">{item.at}</p>
          <p className="mt-1 text-sm text-slate-600">{item.note}</p>
        </li>
      ))}
    </ol>
  );
}
