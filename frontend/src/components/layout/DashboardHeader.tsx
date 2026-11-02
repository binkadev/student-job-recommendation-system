import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { NotificationDropdown } from "../navigation/NotificationDropdown";
import { UserDropdown } from "../navigation/UserDropdown";

interface DashboardHeaderProps {
  title: string;
  onOpenSidebar: () => void;
  extra?: ReactNode;
}

export function DashboardHeader({ title, onOpenSidebar, extra }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Mở menu điều hướng" className="rounded-xl border border-slate-200 p-2.5 transition-colors hover:bg-slate-50 lg:hidden" onClick={onOpenSidebar}>
            <Menu size={18} />
          </button>
          <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {extra}
          <NotificationDropdown />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}
