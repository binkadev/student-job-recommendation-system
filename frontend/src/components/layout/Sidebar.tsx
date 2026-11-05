import { BriefcaseBusiness, ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { MenuItem } from "../../types/navigation";

interface SidebarProps {
  items: MenuItem[];
  title: string;
  onNavigate?: () => void;
}

export function Sidebar({ items, title, onNavigate }: SidebarProps) {
  return (
    <aside aria-label={`Thanh bên ${title}`} className="neo-sidebar flex h-full w-72 flex-col border-r border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
              <BriefcaseBusiness size={18} />
            </span>
            <div>
              <div className="text-sm font-bold text-slate-950">{title}</div>
              <p className="text-xs text-slate-500">JobRecommend</p>
            </div>
          </div>
        </div>
      </div>
      <nav aria-label={`Điều hướng ${title}`} className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <div key={item.label} className="mb-1">
            {item.path ? (
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  }`
                }
              >
                {item.icon ? <item.icon size={18} /> : null}
                {item.label}
              </NavLink>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                        isActive ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
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
