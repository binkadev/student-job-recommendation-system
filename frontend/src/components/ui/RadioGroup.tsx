export interface RadioOption {
  label: string;
  value: string;
  description?: string;
}

interface RadioGroupProps {
  label: string;
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RadioGroup({ label, name, options, value, onChange, disabled }: RadioGroupProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{label}</legend>
      <div className="grid gap-2">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
              className="mt-1 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-200"
            />
            <span>
              <span className="font-medium text-slate-900">{option.label}</span>
              {option.description ? <span className="mt-1 block text-xs text-slate-500">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
