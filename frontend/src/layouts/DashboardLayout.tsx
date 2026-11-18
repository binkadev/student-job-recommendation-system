import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { RouteContent } from "../app/router/RouteContent";
import { useNovaLayoutMotion } from "../components/animations/useNovaLayoutMotion";
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
    icon: <UserRound size={20} aria-hidden="true" />,
    iconBg: "bg-[#0C111C] text-[#D5F36A]",
  },
  recruiter: {
    eyebrow: "Không gian nhà tuyển dụng",
    title: "Quản lý tin tuyển dụng và hồ sơ ứng viên",
    description: "Theo dõi bài đăng, ứng viên, báo cáo tuyển dụng và hồ sơ công ty bằng dữ liệu hiện có.",
    icon: <Building2 size={20} aria-hidden="true" />,
    iconBg: "bg-[#0C111C] text-[#42B6A3]",
  },
  admin: {
    eyebrow: "Không gian quản trị",
    title: "Giám sát người dùng, công ty và tin tuyển dụng",
    description: "Kiểm soát dữ liệu hệ thống, duyệt nội dung và theo dõi các chỉ số vận hành quan trọng.",
    icon: <ShieldCheck size={20} aria-hidden="true" />,
    iconBg: "bg-[#0C111C] text-[#FF7956]",
  },
};

export function DashboardLayout({ title, menu, extra, variant = "candidate" }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const copy = roleCopy[variant];

  useNovaLayoutMotion(contentRef, pathname);

  return (
    <div className="nova-app neo-app nova-shell min-h-screen bg-[#F7F8F6] text-[#0C111C]">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <MobileSidebar
        neoAppearance
        variant={variant}
        open={sidebarOpen}
        title={title}
        items={menu}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="hidden fixed inset-y-0 left-0 z-30 lg:block">
        <Sidebar title={title} items={menu} variant={variant} />
      </div>
      <div className="min-w-0 lg:pl-72">
        <DashboardHeader titleAsHeading={variant === "admin"} title={title} extra={extra} onOpenSidebar={() => setSidebarOpen(true)} />
        <section aria-label="Không gian làm việc" className="neo-workspace border-b border-[#E2E8EE] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-3.5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${copy.iconBg}`}>
                {copy.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#134B43]">{copy.eyebrow}</p>
                <p className="mt-1 text-sm font-medium leading-6 text-[#0C111C]">{copy.title}</p>
              </div>
            </div>
          </div>
        </section>
        <div ref={contentRef}>
          <RouteContent />
        </div>
      </div>
    </div>
  );
}
