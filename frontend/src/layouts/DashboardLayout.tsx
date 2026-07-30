import { useState } from "react";
import type { ReactNode } from "react";
import { BriefcaseBusiness, Building2, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Outlet } from "react-router-dom";
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
    <div className="min-h-screen bg-slate-50">
      <MobileSidebar open={sidebarOpen} title={title} items={menu} onClose={() => setSidebarOpen(false)} />
      <div className="hidden fixed inset-y-0 left-0 z-30 lg:block">
        <Sidebar title={title} items={menu} />
      </div>
      <div className="lg:pl-72">
        <DashboardHeader title={title} extra={extra} onOpenSidebar={() => setSidebarOpen(true)} />
        <section className="border-b border-brand-100 bg-brand-50">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">{copy.icon}</div>
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-medium text-brand-700"><Sparkles size={15} />{copy.eyebrow}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{copy.title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{copy.description}</p>
              </div>
            </div>
            <div className="hidden h-24 w-44 shrink-0 items-center justify-center lg:flex">
              <div className="relative h-20 w-36">
                <div className="absolute bottom-0 left-3 right-3 h-12 rounded-lg bg-white shadow-sm" />
                <div className="absolute left-4 top-3 h-14 w-12 rotate-[-8deg] rounded-md border border-brand-100 bg-white p-2 shadow-sm">
                  <BriefcaseBusiness size={18} className="text-brand-600" />
                  <span className="mt-2 block h-1.5 rounded bg-brand-100" />
                  <span className="mt-1.5 block h-1.5 rounded bg-slate-100" />
                </div>
                <div className="absolute right-5 top-1 h-16 w-12 rotate-[8deg] rounded-md border border-slate-200 bg-white p-2 shadow-sm">
                  <Sparkles size={18} className="text-slate-500" />
                  <span className="mt-2 block h-1.5 rounded bg-brand-100" />
                  <span className="mt-1.5 block h-1.5 rounded bg-slate-100" />
                </div>
              </div>
            </div>
          </div>
        </section>
        <Outlet />
      </div>
    </div>
  );
}
