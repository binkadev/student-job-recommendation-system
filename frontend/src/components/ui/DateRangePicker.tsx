interface DateRangeValue {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  disabled?: boolean;
}

export function DateRangePicker({ label, value, onChange, disabled }: DateRangePickerProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="mt-1 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-500">
          Từ ngày
          <input
            type="date"
            value={value.from}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, from: event.target.value })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Đến ngày
          <input
            type="date"
            value={value.to}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
            className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
          />
        </label>
      </div>
    </fieldset>
  );
}
