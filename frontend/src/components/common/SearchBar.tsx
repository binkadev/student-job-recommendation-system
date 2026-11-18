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
      <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
      <input
        type="search"
        name="keyword"
        aria-label="Từ khóa tìm việc"
        className="h-11 w-full min-w-0 rounded-xl border border-slate-300/90 bg-white pl-10 pr-3.5 text-sm text-[#0C111C] shadow-sm placeholder:text-slate-500 outline-none focus:border-[#237D70] focus:ring-4 focus:ring-[#237D70]/20"
        placeholder={placeholder}
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-xl bg-[#1A6359] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#134B43]"
      >
        Tìm việc
      </button>
    </form>
  );
}
