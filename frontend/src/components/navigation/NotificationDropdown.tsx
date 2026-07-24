import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";

export function NotificationDropdown() {
  const { currentRole } = useAuth();

  return (
    <Link
      to={getNotificationPath(currentRole)}
      className="relative rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
      aria-label="Xem thông báo"
    >
      <Bell size={18} />
      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
    </Link>
  );
}

function getNotificationPath(role: string | null) {
  if (role === "candidate") return "/candidate/notifications";
  if (role === "recruiter") return "/recruiter/settings/notifications";
  if (role === "admin") return "/admin/audit-logs";
  return "/login";
}
