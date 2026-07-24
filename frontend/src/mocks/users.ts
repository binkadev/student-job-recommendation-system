import type { UserAccount } from "../types/domain";

export const users: UserAccount[] = [
  { id: "user-1", name: "Nguyễn Văn An", email: "candidate@example.com", role: "candidate", status: "active", createdAt: "2026-01-12", lastLoginAt: "2026-07-10T08:30:00" },
  { id: "user-2", name: "Trần Thị Bình", email: "recruiter@example.com", role: "recruiter", status: "active", createdAt: "2026-02-20", lastLoginAt: "2026-07-10T09:15:00" },
  { id: "user-3", name: "Quản trị viên", email: "admin@example.com", role: "admin", status: "active", createdAt: "2026-01-01", lastLoginAt: "2026-07-10T10:00:00" },
  { id: "user-4", name: "Lê Minh Khang", email: "khang.le@example.com", role: "candidate", status: "active", createdAt: "2026-03-04", lastLoginAt: "2026-07-09T18:20:00" },
  { id: "user-5", name: "Phạm Thu Hà", email: "ha.pham@example.com", role: "candidate", status: "pending", createdAt: "2026-06-18", lastLoginAt: "2026-07-08T11:05:00" },
  { id: "user-6", name: "Đỗ Quốc Huy", email: "huy.do@example.com", role: "recruiter", status: "active", createdAt: "2026-04-09", lastLoginAt: "2026-07-10T07:40:00" },
];
