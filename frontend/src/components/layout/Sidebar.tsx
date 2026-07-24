import { ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { MenuItem } from "../../types/navigation";

interface SidebarProps {
  items: MenuItem[];
  title: string;
  onNavigate?: () => void;
}

export function Sidebar({ items, title, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-brand-700">{title}</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <div key={item.label} className="mb-2">
            {item.path ? (
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                {item.icon ? <item.icon size={18} /> : null}
                {item.label}
              </NavLink>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {item.label}
                <ChevronDown size={14} />
              </div>
            )}
            {item.children ? (
              <div className="ml-4 border-l border-slate-100 pl-2">
                {item.children.map((child) => (
                  <NavLink
                    key={child.path ?? child.label}
                    to={child.path ?? "#"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                        isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                      }`
                    }
                  >
                    {child.icon ? <child.icon size={16} /> : null}
                    {child.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
