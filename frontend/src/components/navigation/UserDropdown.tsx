import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";

export function UserDropdown() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/login");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="h-7 w-7 rounded-full bg-brand-100 text-center text-xs font-semibold leading-7 text-brand-700">
          {currentUser?.name.charAt(0) ?? "G"}
        </span>
        <span className="hidden sm:inline">{currentUser?.name ?? "Guest"}</span>
        <ChevronDown size={16} />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-lg" role="menu">
          <div className="border-b border-slate-100 px-4 pb-2 pt-1">
            <p className="text-sm font-medium text-slate-900">{currentUser?.name ?? "Guest"}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{currentUser?.email ?? "guest@example.com"}</p>
          </div>
          <Link
            to={getProfilePath(currentUser?.role)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <UserRound size={16} />
            Hồ sơ
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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
