import { ArrowRight, BookOpen, Compass, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionHeader } from "../../../components/common/SectionHeader";
import type { CareerArticle } from "./homeTypes";

const fallbackArticles = [
  {
    title: "Viết CV IT chuẩn quy chuẩn",
    description: "Trình bày kỹ năng, dự án và vai trò của bạn với cấu trúc rõ ràng, tối ưu cho phân tích từ khóa AI.",
    path: "/career-resources/cv-it-sinh-vien",
    tag: "Kỹ năng CV",
    icon: BookOpen,
  },
  {
    title: "Chuẩn bị phỏng vấn Frontend",
    description: "Ôn tập kiến thức nền tảng JavaScript, React, CSS Architecture và kỹ năng giải thích giải pháp kỹ thuật.",
    path: "/career-resources/phong-van-frontend",
    tag: "Phỏng vấn",
    icon: Code2,
  },
  {
    title: "Lộ trình Backend Java & Spring",
    description: "Từ Core Java, OOP vững vàng đến REST API, Hibernate/JPA, tối ưu hóa CSDL PostgreSQL và Testcontainers.",
    path: "/career-resources/lo-trinh-java",
    tag: "Lộ trình",
    icon: Compass,
  },
];

export function NovaCareerResources({ articles }: { articles: CareerArticle[] }) {
  const items = articles.length
    ? articles.map((a, i) => ({
        title: a.title,
        description: a.summary,
        path: a.path,
        tag: "Bài viết",
        icon: fallbackArticles[i % fallbackArticles.length].icon,
      }))
    : fallbackArticles;

  return (
    <section className="mt-12">
      <SectionHeader
        title="Cẩm nang nghề nghiệp"
        action={
          <Link
            to="/career-resources"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#237d70] hover:text-[#134b43] transition-colors"
          >
            Tất cả tài liệu <ArrowRight size={14} />
          </Link>
        }
      />

      <div className="grid gap-5 md:grid-cols-3 mt-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="group flex flex-col justify-between rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition hover:border-[#237d70]/40 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#237d70]/10 px-2.5 py-1 text-[11px] font-bold text-[#134b43]">
                    <Icon size={13} className="text-[#237d70]" />
                    {item.tag}
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-[#9bb0c9] group-hover:translate-x-1 group-hover:text-[#0c111c] transition-transform"
                  />
                </div>

                <h3 className="mt-4 text-base font-bold text-[#0c111c] group-hover:text-[#237d70] transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#52637a]">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center gap-1.5 text-xs font-bold text-[#237d70]">
                <span>Đọc hướng dẫn chi tiết</span>
                <ArrowRight size={13} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
