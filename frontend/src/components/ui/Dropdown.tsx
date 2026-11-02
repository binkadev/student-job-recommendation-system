import type { ReactNode } from "react";
import { useId } from "react";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";

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
  const menuId = useId();
  const { containerRef, onKeyDown } = useMenuKeyboard(open, onOpenChange);
  return (
    <div ref={containerRef} onKeyDown={onKeyDown} className="relative inline-block">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} className="rounded-xl" onClick={() => onOpenChange(!open)}>
        {trigger}
      </button>
      {open ? (
        <div id={menuId} role="menu" className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                item.onClick();
                onOpenChange(false);
                containerRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
              }}
              className={`block min-h-10 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-100 ${item.danger ? "text-red-600" : "text-slate-700"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
