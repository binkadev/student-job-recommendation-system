import { BriefcaseBusiness, ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { MenuItem } from "../../types/navigation";

interface SidebarProps {
  items: MenuItem[];
  title: string;
  variant?: "candidate" | "recruiter" | "admin";
  onNavigate?: () => void;
  mobileDrawer?: boolean;
}

const variantBadges: Record<"candidate" | "recruiter" | "admin", string> = {
  candidate: "bg-[#D5F36A] text-[#0C111C]",
  recruiter: "bg-[#237D70] text-white border border-[#42B6A3]/40",
  admin: "bg-[#FF7956] text-[#0C111C]",
};

export function Sidebar({ items, title, variant = "candidate", onNavigate, mobileDrawer = false }: SidebarProps) {
  return (
    <aside aria-label={`Thanh bên ${title}`} className="neo-sidebar nova-sidebar flex h-full w-72 flex-col border-r border-white/10 bg-[#0C111C] text-[#F7F8F6]">
      <div className={mobileDrawer ? "border-b border-white/10 py-4 pl-4 pr-[68px]" : "border-b border-white/10 px-5 py-5"}>
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#1B2533] to-[#141D2B] p-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-sm ${variantBadges[variant]}`}>
              <BriefcaseBusiness size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{title}</div>
              <p className="text-xs text-[#B4C5DA]">JobRecommend</p>
            </div>
          </div>
        </div>
      </div>
      <nav aria-label={`Điều hướng ${title}`} className="flex-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <div key={item.label} className="mb-1.5">
            {item.path ? (
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "border border-[#D5F36A]/35 bg-[#1B2533] font-semibold text-white shadow-[inset_3px_0_0_#D5F36A]"
                      : "text-[#B4C5DA] hover:bg-[#1B2533] hover:text-white"
                  }`
                }
              >
                {item.icon ? <item.icon size={18} /> : null}
                {item.label}
              </NavLink>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#9BB0C9]">
                {item.label}
                <ChevronDown size={14} aria-hidden="true" />
              </div>
            )}
            {item.children ? (
              <div className="ml-4 border-l border-white/12 pl-2">
                {item.children.map((child) => (
                  <NavLink
                    key={child.path ?? child.label}
                    to={child.path ?? "#"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `mt-1 flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "border border-[#D5F36A]/35 bg-[#1B2533] font-semibold text-white shadow-[inset_3px_0_0_#D5F36A]"
                          : "text-[#B4C5DA] hover:bg-[#1B2533] hover:text-white"
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
