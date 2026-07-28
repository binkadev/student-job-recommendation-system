interface PaginationProps {
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ page = 1, totalPages = 1, onPageChange }: PaginationProps) {
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <button
        className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canGoPrevious}
        onClick={() => onPageChange?.(page - 1)}
      >
        Trước
      </button>
      <span className="rounded-md bg-brand-600 px-3 py-1.5 text-white">
        {page}/{totalPages}
      </span>
      <button
        className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canGoNext}
        onClick={() => onPageChange?.(page + 1)}
      >
        Sau
      </button>
    </div>
  );
}
