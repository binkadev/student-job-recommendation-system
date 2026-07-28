import type { ReactNode } from "react";

interface DropdownItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Dropdown({ trigger, items, open, onOpenChange }: DropdownProps) {
  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => onOpenChange(!open)}>
        {trigger}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                onOpenChange(false);
              }}
              className={`block w-full px-4 py-2 text-left text-sm hover:bg-slate-50 ${item.danger ? "text-red-600" : "text-slate-700"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
