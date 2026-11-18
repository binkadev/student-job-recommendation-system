import { BriefcaseBusiness } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="nova-footer bg-[#0C111C] text-[#B4C5DA]">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-10 text-sm sm:flex-row sm:px-6 lg:px-8">
        <div className="max-w-sm">
          <Link to="/" className="inline-flex items-center gap-2.5 font-bold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D5F36A]/35 bg-[#1B2533] text-[#D5F36A]">
              <BriefcaseBusiness size={17} aria-hidden="true" />
            </span>
            JobRecommend
          </Link>
          <p className="mt-3 leading-6 text-[#B4C5DA]">Kết nối sinh viên IT với cơ hội việc làm phù hợp.</p>
          <p className="mt-2 text-xs text-[#9BB0C9]">Gợi ý từ nội dung CV và kỹ năng · Tiếng Việt &amp; tiếng Anh</p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap items-start gap-x-6 gap-y-3 text-[#D6E2EE]">
          <Link to="/jobs" className="py-2 transition-colors hover:text-[#D5F36A]">Tìm việc làm</Link>
          <Link to="/companies" className="py-2 transition-colors hover:text-[#D5F36A]">Khám phá công ty</Link>
          <Link to="/career-resources" className="py-2 transition-colors hover:text-[#D5F36A]">Cẩm nang nghề nghiệp</Link>
          <Link to="/about" className="py-2 transition-colors hover:text-[#D5F36A]">Giới thiệu</Link>
        </nav>
      </div>
    </footer>
  );
}
