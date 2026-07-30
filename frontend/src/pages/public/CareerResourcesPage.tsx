import { BookOpenText, BriefcaseBusiness, FileText, GraduationCap, Layers3, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";

interface CareerArticle {
  slug: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  icon: ReactNode;
  sections: Array<{
    heading: string;
    content: string[];
  }>;
}

const articles: CareerArticle[] = [
  {
    slug: "cv-it-sinh-vien",
    title: "Cách viết CV IT nổi bật cho sinh viên mới ra trường",
    category: "CV",
    readTime: "6 phút",
    icon: <FileText size={22} />,
    summary: "Tập trung vào kỹ năng, dự án cá nhân, môn học liên quan và cách trình bày CV rõ ràng để nhà tuyển dụng dễ đánh giá.",
    sections: [
      {
        heading: "Thông tin nên đặt ở đầu CV",
        content: [
          "CV nên có họ tên, email, số điện thoại, vị trí mong muốn, GitHub hoặc portfolio nếu có.",
          "Phần giới thiệu ngắn chỉ nên nêu định hướng, kỹ năng chính và mục tiêu thực tập hoặc công việc đầu tiên.",
        ],
      },
      {
        heading: "Dự án quan trọng hơn mô tả chung",
        content: [
          "Với sinh viên IT, dự án cá nhân hoặc đồ án môn học là bằng chứng tốt nhất cho năng lực thực tế.",
          "Mỗi dự án nên ghi công nghệ sử dụng, vai trò của bạn, chức năng chính và kết quả đạt được.",
        ],
      },
      {
        heading: "Kỹ năng cần trình bày có chọn lọc",
        content: [
          "Chỉ liệt kê kỹ năng bạn có thể giải thích khi phỏng vấn.",
          "Nên nhóm kỹ năng theo ngôn ngữ lập trình, framework, database, công cụ và kỹ năng mềm.",
        ],
      },
    ],
  },
  {
    slug: "phong-van-frontend",
    title: "Chuẩn bị phỏng vấn Frontend Developer trong 7 ngày",
    category: "Phỏng vấn",
    readTime: "8 phút",
    icon: <BriefcaseBusiness size={22} />,
    summary: "Ôn lại HTML, CSS, JavaScript, React, cách gọi API và chuẩn bị demo dự án để trả lời tự tin hơn.",
    sections: [
      {
        heading: "Ngày 1-2: Nền tảng web",
        content: [
          "Ôn semantic HTML, responsive layout, flexbox, grid, form và các trạng thái cơ bản của UI.",
          "Chuẩn bị ví dụ về cách bạn xử lý giao diện bị vỡ trên mobile hoặc dữ liệu dài.",
        ],
      },
      {
        heading: "Ngày 3-5: JavaScript và React",
        content: [
          "Nắm lại state, props, hooks, component lifecycle, xử lý form, gọi API và quản lý lỗi.",
          "Tập giải thích một màn hình bạn đã làm: dữ liệu đi từ API vào UI như thế nào, loading/error/empty state xử lý ra sao.",
        ],
      },
      {
        heading: "Ngày 6-7: Dự án và câu hỏi tình huống",
        content: [
          "Chọn một dự án để demo ngắn trong 3-5 phút, nhấn mạnh phần bạn tự làm.",
          "Chuẩn bị câu trả lời về teamwork, xử lý bug, học công nghệ mới và cách tiếp nhận phản hồi.",
        ],
      },
    ],
  },
  {
    slug: "lo-trinh-java",
    title: "Lộ trình học Backend Java Spring Boot",
    category: "Định hướng",
    readTime: "10 phút",
    icon: <GraduationCap size={22} />,
    summary: "Một lộ trình thực tế để sinh viên IT đi từ Java core đến REST API, database, bảo mật và triển khai ứng dụng.",
    sections: [
      {
        heading: "Java core và OOP",
        content: [
          "Cần nắm class, interface, collection, exception, stream, generic và cách tổ chức package.",
          "Nên thực hành bằng các bài nhỏ như quản lý sinh viên, quản lý sản phẩm hoặc xử lý file.",
        ],
      },
      {
        heading: "Spring Boot và REST API",
        content: [
          "Học controller, service, repository, DTO, validation và chuẩn response thống nhất.",
          "Tập xây API CRUD có phân quyền đơn giản để hiểu luồng request từ FE đến DB.",
        ],
      },
      {
        heading: "Database và bảo mật",
        content: [
          "Thực hành PostgreSQL, quan hệ bảng, index, migration và transaction.",
          "Với ứng dụng tuyển dụng, cần hiểu JWT, role, quyền truy cập dữ liệu theo ứng viên, nhà tuyển dụng và admin.",
        ],
      },
    ],
  },
];

export function CareerResourcesPage() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug);

  if (slug && !article) {
    return (
      <PageContainer>
        <EmptyState message="Không tìm thấy bài viết phù hợp." />
      </PageContainer>
    );
  }

  if (article) {
    return (
      <PageContainer>
        <ArticleHero article={article} />
        <Card className="mt-5">
          <div className="mb-5 flex flex-wrap gap-2">
            <StatusBadge label={article.category} />
            <StatusBadge label={article.readTime} tone="neutral" />
          </div>
          <p className="text-sm leading-6 text-slate-700">{article.summary}</p>
          <div className="mt-6 space-y-6">
            {article.sections.map((section, index) => (
              <section key={section.heading} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-50 text-sm font-semibold text-brand-700">{index + 1}</span>
                  <h2 className="text-base font-semibold text-slate-950">{section.heading}</h2>
                </div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                  {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <section className="grid gap-6 rounded-lg border border-brand-100 bg-brand-50 p-6 shadow-sm lg:grid-cols-[1fr_340px] lg:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
            <BookOpenText size={16} />
            Cẩm nang nghề nghiệp IT
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Chuẩn bị CV, phỏng vấn và lộ trình nghề nghiệp rõ ràng hơn</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Các bài viết ngắn giúp sinh viên IT biết cách trình bày năng lực, chuẩn bị phỏng vấn và chọn hướng phát triển phù hợp.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["CV", "Phỏng vấn", "Định hướng"].map((item) => <StatusBadge key={item} label={item} />)}
          </div>
        </div>
        <GuideIllustration />
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {articles.map((item) => (
          <Link key={item.slug} to={`/career-resources/${item.slug}`} className="group">
            <Card className="h-full transition duration-200 group-hover:-translate-y-1 group-hover:border-brand-200 group-hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{item.icon}</div>
                <StatusBadge label={item.readTime} tone="neutral" />
              </div>
              <p className="mt-4 text-sm font-medium text-brand-700">{item.category}</p>
              <h2 className="mt-2 font-semibold leading-6 text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}

function ArticleHero({ article }: { article: CareerArticle }) {
  return (
    <section className="grid gap-5 rounded-lg border border-brand-100 bg-white p-6 shadow-sm lg:grid-cols-[1fr_260px]">
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          <StatusBadge label={article.category} />
          <StatusBadge label={article.readTime} tone="neutral" />
        </div>
        <h1 className="text-2xl font-semibold leading-tight text-slate-950">{article.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{article.summary}</p>
      </div>
      <GuideIllustration compact />
    </section>
  );
}

function GuideIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative mx-auto ${compact ? "h-36 w-56" : "h-48 w-72"}`}>
      <div className="absolute bottom-0 left-6 right-6 h-16 rounded-lg bg-white shadow-sm" />
      <div className="absolute bottom-5 left-10 right-10 rounded-lg border border-brand-100 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, index) => <span key={index} className="h-2 rounded bg-brand-100" />)}
        </div>
      </div>
      <FloatingSheet className="left-8 top-2 rotate-[-8deg]" icon={<FileText size={22} />} label="CV" />
      <FloatingSheet className="left-24 top-0 rotate-[4deg]" icon={<ListChecks size={22} />} label="Plan" />
      <FloatingSheet className="left-40 top-5 rotate-[10deg]" icon={<Layers3 size={22} />} label="Skill" />
    </div>
  );
}

function FloatingSheet({ className, icon, label }: { className: string; icon: ReactNode; label: string }) {
  return (
    <div className={`absolute h-24 w-20 rounded-md border border-slate-200 bg-white p-3 shadow-md transition duration-200 hover:-translate-y-1 ${className}`}>
      <div className="text-brand-600">{icon}</div>
      <p className="mt-2 text-xs font-semibold text-slate-900">{label}</p>
      <span className="mt-2 block h-2 rounded bg-brand-100" />
      <span className="mt-2 block h-2 rounded bg-slate-100" />
    </div>
  );
}
