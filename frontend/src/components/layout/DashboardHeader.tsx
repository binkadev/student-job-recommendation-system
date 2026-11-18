import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { NotificationDropdown } from "../navigation/NotificationDropdown";
import { UserDropdown } from "../navigation/UserDropdown";

interface DashboardHeaderProps {
  title: string;
  onOpenSidebar: () => void;
  extra?: ReactNode;
  titleAsHeading?: boolean;
}

export function DashboardHeader({ title, onOpenSidebar, extra, titleAsHeading = true }: DashboardHeaderProps) {
  const Title = titleAsHeading ? "h1" : "p";
  return (
    <header className="neo-topbar nova-topbar sticky top-0 z-20 border-b border-[#E2E8EE] bg-white/95 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Mở menu điều hướng"
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-[#D5DCE6] bg-white text-[#0C111C] transition-colors hover:border-[#237D70]/45 hover:bg-[#F0FAF8] lg:hidden"
            onClick={onOpenSidebar}
          >
            <Menu size={18} />
          </button>
          <Title className="truncate text-base font-bold tracking-tight text-[#0C111C] sm:text-lg">{title}</Title>
        </div>
        <div className="flex items-center gap-2.5">
          {extra}
          <NotificationDropdown />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}
