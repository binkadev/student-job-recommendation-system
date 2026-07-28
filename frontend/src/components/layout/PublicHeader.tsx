import { BriefcaseBusiness } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { SearchBar } from "../common/SearchBar";

const publicLinks = [
  { label: "Trang chủ", path: "/" },
  { label: "Việc làm", path: "/jobs" },
  { label: "Công ty", path: "/companies" },
  { label: "Cẩm nang nghề nghiệp", path: "/career-resources" },
  { label: "Giới thiệu", path: "/about" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-slate-950">
            <BriefcaseBusiness className="text-brand-600" />
            JobRecommend
          </Link>
          <nav className="hidden flex-wrap items-center gap-4 text-sm text-slate-600 lg:flex">
            {publicLinks.map((item) => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => (isActive ? "text-brand-600" : "")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              Đăng nhập
            </Link>
            <Link to="/register" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white">
              Đăng ký
            </Link>
            <Link to="/register/recruiter" className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm sm:inline-flex">
              Nhà tuyển dụng
            </Link>
          </div>
        </div>
        <SearchBar placeholder="Tìm việc làm, công ty, kỹ năng..." />
      </div>
    </header>
  );
}
