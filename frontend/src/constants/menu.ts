import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Tags,
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
      { label: "Tìm kiếm đã lưu", path: "/candidate/jobs/saved-searches", icon: Search },
    ],
  },
  {
    label: "Hồ sơ và CV",
    children: [
      { label: "Hồ sơ cá nhân", path: "/candidate/profile", icon: UserRound },
      { label: "Quản lý CV", path: "/candidate/cvs", icon: FileText },
      { label: "Đánh giá CV", path: "/candidate/cvs/upload", icon: ShieldCheck },
    ],
  },
  {
    label: "Ứng tuyển",
    children: [
      { label: "Lịch sử ứng tuyển", path: "/candidate/applications", icon: FolderKanban },
      { label: "Lịch phỏng vấn", path: "/candidate/interviews", icon: CalendarDays },
      { label: "Lời mời ứng tuyển", path: "/candidate/invitations", icon: Inbox },
    ],
  },
  { label: "Tin nhắn", path: "/candidate/messages", icon: MessageSquare },
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
      { label: "Chiến dịch tuyển dụng", path: "/recruiter/campaigns", icon: BarChart3 },
    ],
  },
  {
    label: "Ứng viên",
    children: [
      { label: "Tất cả ứng viên", path: "/recruiter/candidates", icon: Users },
      { label: "Pipeline tuyen dung", path: "/recruiter/pipeline", icon: FolderKanban },
      { label: "Ứng viên được gợi ý", path: "/recruiter/recommended-candidates", icon: ShieldCheck },
      { label: "Hồ sơ đã lưu", path: "/recruiter/saved-candidates", icon: Inbox },
      { label: "Tìm kiếm ứng viên", path: "/recruiter/candidate-search", icon: Search },
    ],
  },
  { label: "Phỏng vấn", path: "/recruiter/interviews", icon: CalendarDays },
  { label: "Tin nhắn", path: "/recruiter/messages", icon: MessageSquare },
  { label: "Báo cáo", path: "/recruiter/reports", icon: BarChart3 },
  { label: "Hồ sơ công ty", path: "/recruiter/company", icon: Building2 },
  { label: "Thành viên", path: "/recruiter/members", icon: Users },
  { label: "Cài đặt", path: "/recruiter/settings", icon: Settings },
];

export const adminMenu: MenuItem[] = [
  { label: "Tổng quan", path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Người dùng", path: "/admin/users", icon: Users },
  { label: "Nhà tuyển dụng", path: "/admin/recruiters", icon: UserRound },
  { label: "Doanh nghiệp", path: "/admin/companies", icon: Building2 },
  { label: "Tin tuyển dụng", path: "/admin/jobs", icon: BriefcaseBusiness },
  { label: "Đơn ứng tuyển", path: "/admin/applications", icon: FolderKanban },
  { label: "Danh mục", path: "/admin/categories", icon: Tags },
  { label: "CV và thuật toán gợi ý", path: "/admin/cv-analysis", icon: FileText },
  { label: "Nội dung", path: "/admin/content", icon: Home },
  { label: "Báo cáo vi phạm", path: "/admin/reports", icon: ShieldCheck },
  { label: "Thống kê", path: "/admin/analytics", icon: BarChart3 },
  { label: "Nhật ký hệ thống", path: "/admin/audit-logs", icon: FileText },
  { label: "Cấu hình", path: "/admin/system-settings", icon: Settings },
];
