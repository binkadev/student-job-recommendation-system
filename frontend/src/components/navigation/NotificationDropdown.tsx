import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY } from "../../services/api/httpClient";
import { useUnreadCount } from "../../features/account/useUnreadCount";

export function NotificationDropdown() {
  const { currentRole, currentUser } = useAuth();
  if (currentRole !== "candidate" && currentRole !== "recruiter") return <Link to={getNotificationPath(currentRole)} aria-label="Xem thông báo" className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"><Bell size={18} /></Link>;
  return <NotificationLink key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`} role={currentRole} />;
}

function NotificationLink({ role }: { role: string }) {
  const { count, failed } = useUnreadCount();

  return (
    <Link
      to={getNotificationPath(role)}
      className="relative rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
      aria-label={`Xem thông báo${count === null ? ", chưa xác minh số chưa đọc" : `, ${count} chưa đọc`}${failed ? ", chưa đồng bộ" : ""}`}
    >
      <Bell size={18} />
      {count !== null && count > 0 ? <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs text-white">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}

function getNotificationPath(role: string | null) {
  if (role === "candidate") return "/candidate/notifications";
  if (role === "recruiter") return "/recruiter/settings/notifications";
  if (role === "admin") return "/admin/audit-logs";
  return "/login";
}
