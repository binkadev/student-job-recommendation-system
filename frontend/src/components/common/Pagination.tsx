interface PaginationProps {
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({ page = 1, totalPages = 1, onPageChange }: PaginationProps) {
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-end gap-2 text-sm">
      <button
        type="button"
        className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canGoPrevious}
        onClick={() => onPageChange?.(page - 1)}
      >
        Trước
      </button>
      <span aria-live="polite" aria-atomic="true" className="rounded-xl bg-brand-50 px-3 py-2 font-medium text-brand-700">
        Trang {page}/{Math.max(1, totalPages)}
      </span>
      <button
        type="button"
        className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canGoNext}
        onClick={() => onPageChange?.(page + 1)}
      >
        Sau
      </button>
    </nav>
  );
}
