import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY } from "../../services/api/httpClient";
import { useUnreadCount } from "../../features/account/useUnreadCount";

export function NotificationDropdown() {
  const { currentRole, currentUser } = useAuth();
  if (currentRole !== "candidate" && currentRole !== "recruiter") {
    return (
      <Link
        to={getNotificationPath(currentRole)}
        aria-label="Xem thông báo"
        className="rounded-xl border border-[#D5DCE6] bg-white p-2.5 text-[#1B2533] transition-colors hover:border-[#237D70]/45 hover:bg-[#F0FAF8]"
      >
        <Bell size={18} />
      </Link>
    );
  }
  return <NotificationLink key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`} role={currentRole} />;
}

function NotificationLink({ role }: { role: string }) {
  const { count, failed } = useUnreadCount();

  return (
    <Link
      to={getNotificationPath(role)}
      className="relative rounded-xl border border-[#D5DCE6] bg-white p-2.5 text-[#1B2533] transition-colors hover:border-[#237D70]/45 hover:bg-[#F0FAF8]"
      aria-label={`Xem thông báo${count === null ? ", chưa xác minh số chưa đọc" : `, ${count} chưa đọc`}${failed ? ", chưa đồng bộ" : ""}`}
    >
      <Bell size={18} />
      {count !== null && count > 0 ? (
        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-[#C83E2B] px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white shadow-sm">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function getNotificationPath(role: string | null) {
  if (role === "candidate") return "/candidate/notifications";
  if (role === "recruiter") return "/recruiter/settings/notifications";
  if (role === "admin") return "/admin/audit-logs";
  return "/login";
}
