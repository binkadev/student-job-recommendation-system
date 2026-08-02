import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { MenuItem } from "../types/navigation";

export const candidateMenu: MenuItem[] = [
  { label: "Tổng quan", path: "/candidate/dashboard", icon: LayoutDashboard },
  {
    label: "Việc làm",
    children: [
      { label: "Tìm việc", path: "/candidate/jobs", icon: Search },
      { label: "Việc làm gợi ý", path: "/candidate/jobs/recommended", icon: BriefcaseBusiness },
      { label: "Việc làm đã lưu", path: "/candidate/jobs/saved", icon: Inbox },
    ],
  },
  {
    label: "Hồ sơ và CV",
    children: [
      { label: "Hồ sơ cá nhân", path: "/candidate/profile", icon: UserRound },
      { label: "Quản lý CV", path: "/candidate/cvs", icon: FileText },
      { label: "Tải CV", path: "/candidate/cvs/upload", icon: ShieldCheck },
    ],
  },
  {
    label: "Ứng tuyển",
    children: [
      { label: "Lịch sử ứng tuyển", path: "/candidate/applications", icon: FolderKanban },
    ],
  },
  { label: "Thông báo", path: "/candidate/notifications", icon: Bell },
  { label: "Cài đặt", path: "/candidate/settings", icon: Settings },
];

export const recruiterMenu: MenuItem[] = [
  { label: "Tổng quan", path: "/recruiter/dashboard", icon: LayoutDashboard },
  {
    label: "Tuyển dụng",
    children: [
      { label: "Danh sách tin tuyển dụng", path: "/recruiter/jobs", icon: BriefcaseBusiness },
      { label: "Tạo tin tuyển dụng", path: "/recruiter/jobs/create", icon: FileText },
    ],
  },
  {
    label: "Ứng viên",
    children: [
      { label: "Tất cả ứng viên", path: "/recruiter/candidates", icon: Users },
      { label: "Hồ sơ đã lưu", path: "/recruiter/saved-candidates", icon: Inbox },
    ],
  },
  { label: "Báo cáo", path: "/recruiter/reports", icon: BarChart3 },
  { label: "Hồ sơ công ty", path: "/recruiter/company", icon: Building2 },
  { label: "Cài đặt", path: "/recruiter/settings", icon: Settings },
];

export const adminMenu: MenuItem[] = [
  { label: "Tổng quan", path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Người dùng", path: "/admin/users", icon: Users },
  { label: "Doanh nghiệp", path: "/admin/companies", icon: Building2 },
  { label: "Tin tuyển dụng", path: "/admin/jobs", icon: BriefcaseBusiness },
  { label: "Đơn ứng tuyển", path: "/admin/applications", icon: FolderKanban },
  { label: "Thống kê", path: "/admin/analytics", icon: BarChart3 },
];
