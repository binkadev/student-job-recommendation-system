import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { FormEvent } from "react";

export function SearchBar({ placeholder = "Tìm kiếm..." }: { placeholder?: string }) {
  const navigate = useNavigate();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const keyword = String(new FormData(event.currentTarget).get("keyword") ?? "").trim();
    navigate(keyword ? `/jobs?${new URLSearchParams({ keyword })}` : "/jobs");
  }
  return (
    <form role="search" aria-label="Tìm kiếm việc làm" onSubmit={submit} className="relative flex w-full max-w-xl items-center gap-2">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        type="search"
        name="keyword"
        aria-label="Từ khóa tìm việc"
        className="h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        placeholder={placeholder}
      />
      <button type="submit" className="h-11 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Tìm việc</button>
    </form>
  );
}
