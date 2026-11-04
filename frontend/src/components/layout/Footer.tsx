import { BriefcaseBusiness } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-10 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        <div className="max-w-sm">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-slate-900"><BriefcaseBusiness size={20} className="text-brand-600" />JobRecommend</Link>
          <p className="mt-3 leading-6">Kết nối sinh viên IT với cơ hội việc làm phù hợp.</p>
          <p className="mt-2 text-xs">Gợi ý từ nội dung CV và kỹ năng · Tiếng Việt & tiếng Anh</p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap items-start gap-x-6 gap-y-3 text-slate-600">
          <Link to="/jobs" className="py-2 hover:text-brand-700">Tìm việc làm</Link>
          <Link to="/companies" className="py-2 hover:text-brand-700">Khám phá công ty</Link>
          <Link to="/about" className="py-2 hover:text-brand-700">Giới thiệu</Link>
        </nav>
      </div>
    </footer>
  );
}
