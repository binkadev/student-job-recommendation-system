import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";

export function UserDropdown() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const { containerRef, onKeyDown } = useMenuKeyboard(open, setOpen);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/login");
  }

  return (
    <div ref={containerRef} onKeyDown={onKeyDown} className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl border border-[#D5DCE6] bg-white px-3 py-1.5 text-sm font-medium text-[#0C111C] transition-colors hover:border-[#237D70]/45 hover:bg-[#F0FAF8]"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu tài khoản"
        aria-controls={open ? menuId : undefined}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C111C] text-xs font-bold text-[#D5F36A]">
          {currentUser?.name.charAt(0) ?? "G"}
        </span>
        <span className="hidden sm:inline">{currentUser?.name ?? "Guest"}</span>
        <ChevronDown size={16} className="text-slate-500" />
      </button>

      {open ? (
        <div id={menuId} className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-2xl border border-[#E2E8EE] bg-white py-2 shadow-lift" role="menu">
          <div className="border-b border-slate-100 px-4 pb-2.5 pt-1">
            <p className="text-sm font-semibold text-[#0C111C]">{currentUser?.name ?? "Guest"}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{currentUser?.email ?? "guest@example.com"}</p>
          </div>
          <Link
            to={getProfilePath(currentUser?.role)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#1B2533] transition-colors hover:bg-[#F0FAF8] hover:text-[#134B43]"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <UserRound size={16} />
            Hồ sơ
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
            onClick={handleLogout}
            role="menuitem"
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getProfilePath(role?: string) {
  if (role === "candidate") return "/candidate/profile";
  if (role === "recruiter") return "/recruiter/company";
  if (role === "admin") return "/admin/users/admin-1";
  return "/login";
}
