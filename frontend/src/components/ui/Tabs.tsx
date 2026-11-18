interface TabItem {
  label: string;
  value: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-[#E2E8EE]">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
            value === item.value
              ? "border-[#1A6359] font-semibold text-[#134B43]"
              : "border-transparent text-[#4B5C73] hover:text-[#0C111C]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
