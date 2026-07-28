import { useState } from "react";
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { DashboardHeader } from "../components/layout/DashboardHeader";
import { MobileSidebar } from "../components/layout/MobileSidebar";
import { Sidebar } from "../components/layout/Sidebar";
import type { MenuItem } from "../types/navigation";

interface DashboardLayoutProps {
  title: string;
  menu: MenuItem[];
  extra?: ReactNode;
}

export function DashboardLayout({ title, menu, extra }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <MobileSidebar open={sidebarOpen} title={title} items={menu} onClose={() => setSidebarOpen(false)} />
      <div className="hidden fixed inset-y-0 left-0 z-30 lg:block">
        <Sidebar title={title} items={menu} />
      </div>
      <div className="lg:pl-72">
        <DashboardHeader title={title} extra={extra} onOpenSidebar={() => setSidebarOpen(true)} />
        <Outlet />
      </div>
    </div>
  );
}
