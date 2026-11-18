import { BriefcaseBusiness, Menu, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useRef, useState } from "react";
import { SearchBar } from "../common/SearchBar";

const publicLinks = [
  { label: "Trang chủ", path: "/" },
  { label: "Việc làm", path: "/jobs" },
  { label: "Công ty", path: "/companies" },
  { label: "Cẩm nang nghề nghiệp", path: "/career-resources" },
  { label: "Giới thiệu", path: "/about" },
];

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButtonRef.current?.focus();
        }
      }}
      className="neo-public-header sticky top-0 z-30 border-b border-white/10 bg-[#0C111C]/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 font-bold tracking-tight text-white transition-colors">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D5F36A]/35 bg-[#1B2533] text-[#D5F36A] shadow-sm transition-transform duration-200 group-hover:scale-105">
              <BriefcaseBusiness size={17} aria-hidden="true" />
            </span>
            <span>JobRecommend</span>
          </Link>
          <nav aria-label="Điều hướng chính" className="hidden flex-wrap items-center gap-1.5 text-sm lg:flex">
            {publicLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 font-medium transition-colors ${
                    isActive
                      ? "bg-[#1B2533] font-semibold text-[#D5F36A]"
                      : "text-[#B4C5DA] hover:bg-[#1B2533]/80 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              className="rounded-xl border border-white/15 bg-[#1B2533] p-2.5 text-[#F7F8F6] transition-colors hover:border-[#D5F36A]/50 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-nav"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link
              to="/login"
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-[#F7F8F6] transition-colors hover:bg-[#1B2533]"
            >
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-[#D5F36A] px-4 py-2 text-sm font-bold text-[#0C111C] shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#def682]"
            >
              Đăng ký
            </Link>
            <Link
              to="/register/recruiter"
              className="hidden rounded-xl border border-white/15 bg-[#1B2533]/90 px-3.5 py-2 text-sm font-medium text-[#F7F8F6] transition-colors hover:border-[#237D70] hover:bg-[#243244] sm:inline-flex"
            >
              Nhà tuyển dụng
            </Link>
          </div>
        </div>
        {menuOpen ? (
          <nav
            id="public-mobile-nav"
            aria-label="Điều hướng điện thoại"
            className="grid gap-1 rounded-2xl border border-white/10 bg-[#1B2533] p-2 lg:hidden"
          >
            {publicLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#0C111C] font-semibold text-[#D5F36A]"
                      : "text-[#D6E2EE] hover:bg-[#243244] hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
        <SearchBar placeholder="Tìm việc làm, công ty, kỹ năng..." />
      </div>
    </header>
  );
}
