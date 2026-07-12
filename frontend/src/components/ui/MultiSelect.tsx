import { X } from "lucide-react";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({ label, options, value, onChange, placeholder = "Chọn giá trị", disabled }: MultiSelectProps) {
  const selectedOptions = options.filter((option) => value.includes(option.value));

  function toggleValue(nextValue: string) {
    onChange(value.includes(nextValue) ? value.filter((item) => item !== nextValue) : [...value, nextValue]);
  }

  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="mt-1 rounded-md border border-slate-200 bg-white p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <div className="mb-2 flex min-h-7 flex-wrap gap-2">
          {selectedOptions.length ? selectedOptions.map((option) => (
            <span key={option.value} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
              {option.label}
              <button type="button" disabled={disabled} onClick={() => toggleValue(option.value)} aria-label={`Bỏ chọn ${option.label}`}>
                <X size={12} />
              </button>
            </span>
          )) : <span className="py-1 text-sm font-normal text-slate-400">{placeholder}</span>}
        </div>
        <select
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm font-normal text-slate-700 outline-none"
          value=""
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value) toggleValue(event.target.value);
          }}
        >
          <option value="">Thêm lựa chọn</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
