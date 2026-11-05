import { useState } from "react";
import type { ReactNode } from "react";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { RouteContent } from "../app/router/RouteContent";
import { DashboardHeader } from "../components/layout/DashboardHeader";
import { MobileSidebar } from "../components/layout/MobileSidebar";
import { Sidebar } from "../components/layout/Sidebar";
import type { MenuItem } from "../types/navigation";

interface DashboardLayoutProps {
  title: string;
  menu: MenuItem[];
  extra?: ReactNode;
  variant?: "candidate" | "recruiter" | "admin";
}

const roleCopy = {
  candidate: {
    eyebrow: "Không gian ứng viên",
    title: "Theo dõi hồ sơ, CV và cơ hội việc làm phù hợp",
    description: "Quản lý quá trình tìm việc, lưu việc làm, ứng tuyển và cập nhật hồ sơ cá nhân trong cùng một nơi.",
    icon: <UserRound size={22} />,
  },
  recruiter: {
    eyebrow: "Không gian nhà tuyển dụng",
    title: "Quản lý tin tuyển dụng và hồ sơ ứng viên",
    description: "Theo dõi bài đăng, ứng viên, báo cáo tuyển dụng và hồ sơ công ty bằng dữ liệu hiện có.",
    icon: <Building2 size={22} />,
  },
  admin: {
    eyebrow: "Không gian quản trị",
    title: "Giám sát người dùng, công ty và tin tuyển dụng",
    description: "Kiểm soát dữ liệu hệ thống, duyệt nội dung và theo dõi các chỉ số vận hành quan trọng.",
    icon: <ShieldCheck size={22} />,
  },
};

export function DashboardLayout({ title, menu, extra, variant = "candidate" }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const copy = roleCopy[variant];

  return (
    <div className={`${variant === "admin" ? "bg-[#f7f9fc]" : "neo-app"} min-h-screen`}>
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <MobileSidebar neoAppearance={variant !== "admin"} open={sidebarOpen} title={title} items={menu} onClose={() => setSidebarOpen(false)} />
      <div className="hidden fixed inset-y-0 left-0 z-30 lg:block">
        <Sidebar title={title} items={menu} />
      </div>
      <div className="min-w-0 lg:pl-72">
        <DashboardHeader titleAsHeading={variant === "admin"} title={title} extra={extra} onOpenSidebar={() => setSidebarOpen(true)} />
        <section aria-label="Không gian làm việc" className="neo-workspace border-b border-slate-200/80 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{copy.icon}</div>
              <div>
                <p className="text-xs font-semibold text-brand-700">{copy.eyebrow}</p>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-700">{copy.title}</p>
              </div>
            </div>
          </div>
        </section>
        <RouteContent />
      </div>
    </div>
  );
}
