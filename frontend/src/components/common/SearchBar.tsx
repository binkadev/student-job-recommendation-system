import { Search } from "lucide-react";

export function SearchBar({ placeholder = "Tìm kiếm..." }: { placeholder?: string }) {
  return (
    <label className="relative block w-full max-w-xl">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        placeholder={placeholder}
      />
    </label>
  );
}
