import type { UserRole } from "../../types/auth";

export const roleDashboardPath: Record<UserRole, string> = {
  candidate: "/candidate/dashboard",
  recruiter: "/recruiter/dashboard",
  admin: "/admin/dashboard",
};
