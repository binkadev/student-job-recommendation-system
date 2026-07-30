import { BarChart3, BriefcaseBusiness, Building2, CheckCircle2, FileSearch, FileText, ShieldCheck, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Card } from "../../components/ui/Card";
import { useAsyncData } from "../../hooks/useAsyncData";
import { httpClient } from "../../services/api/httpClient";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface PublicInfoPageProps {
  title: string;
  description: string;
  variant?: "default" | "about";
}

interface AboutStats {
  jobs: number;
  companies: number;
  users: number;
}

const aboutSections = [
  {
    title: "Mục đích hệ thống",
    icon: <Sparkles size={20} />,
    content:
      "Student Job Recommendation System hỗ trợ sinh viên IT tìm việc làm, thực tập và cơ hội phù hợp với kỹ năng, CV và định hướng nghề nghiệp. Hệ thống giúp việc tìm kiếm việc làm có cấu trúc hơn, giảm tình trạng ứng tuyển ngẫu nhiên và giúp sinh viên tập trung vào các vị trí phù hợp.",
  },
  {
    title: "Dành cho ứng viên",
    icon: <Users size={20} />,
    content:
      "Ứng viên có thể xem việc làm đang tuyển, lưu việc làm quan tâm, ứng tuyển bằng CV, theo dõi trạng thái hồ sơ và sử dụng chức năng phân tích CV để hiểu điểm mạnh, kỹ năng phù hợp và các kỹ năng còn thiếu so với tin tuyển dụng.",
  },
  {
    title: "Dành cho nhà tuyển dụng",
    icon: <Building2 size={20} />,
    content:
      "Nhà tuyển dụng có thể quản lý hồ sơ công ty, tạo tin tuyển dụng, theo dõi danh sách ứng viên, xem CV, cập nhật trạng thái ứng tuyển và đánh giá hiệu quả tuyển dụng theo dữ liệu trong hệ thống.",
  },
  {
    title: "Dành cho quản trị viên",
    icon: <ShieldCheck size={20} />,
    content:
      "Quản trị viên theo dõi người dùng, công ty, tin tuyển dụng, đơn ứng tuyển và trạng thái vận hành chung. Vai trò admin giúp kiểm soát dữ liệu, duyệt tin và đảm bảo nội dung công khai phù hợp trước khi hiển thị cho ứng viên.",
  },
  {
    title: "Gợi ý việc làm theo CV",
    icon: <FileSearch size={20} />,
    content:
      "Luồng gợi ý sử dụng dữ liệu CV và tin tuyển dụng để phân tích kỹ năng, tính điểm phù hợp và giải thích vì sao một công việc được đề xuất. Cách tiếp cận này giúp sinh viên hiểu rõ hơn mối liên hệ giữa năng lực hiện tại và yêu cầu tuyển dụng thực tế.",
  },
  {
    title: "Giá trị của nền tảng",
    icon: <BarChart3 size={20} />,
    content:
      "Website kết nối ba nhóm người dùng chính trong cùng một quy trình: sinh viên tìm cơ hội, doanh nghiệp tìm ứng viên và admin kiểm soát dữ liệu. Mục tiêu là tạo một nền tảng tuyển dụng IT rõ ràng, dễ dùng và có thể mở rộng cho các chức năng AI trong các giai đoạn tiếp theo.",
  },
];

const flowSteps = [
  "Ứng viên tạo hồ sơ và tải CV",
  "Doanh nghiệp đăng tin tuyển dụng",
  "Hệ thống kết nối dữ liệu và hỗ trợ gợi ý",
  "Admin kiểm soát nội dung công khai",
];

export function PublicInfoPage({ title, description, variant = "default" }: PublicInfoPageProps) {
  if (variant === "about") {
    return <AboutPage title={title} description={description} />;
  }

  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <Card>
        <p className="text-sm leading-6 text-slate-700">
          Trang thông tin này cung cấp nội dung hỗ trợ người dùng trong quá trình tìm việc, tuyển dụng và sử dụng hệ thống.
        </p>
      </Card>
    </PageContainer>
  );
}

function AboutPage({ title, description }: Pick<PublicInfoPageProps, "title" | "description">) {
  const statsQuery = useAsyncData(getAboutStats, []);
  const stats = statsQuery.data ?? { jobs: 0, companies: 0, users: 0 };

  return (
    <PageContainer>
      <section className="grid gap-6 rounded-lg border border-brand-100 bg-brand-50 p-6 shadow-sm lg:grid-cols-[1fr_360px] lg:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
            <Sparkles size={16} />
            JobRecommend
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatCard icon={<BriefcaseBusiness size={19} />} label="Việc làm đang tuyển" value={stats.jobs} />
            <StatCard icon={<Building2 size={19} />} label="Công ty tuyển dụng" value={stats.companies} />
            <StatCard icon={<Users size={19} />} label="Người dùng" value={stats.users} />
          </div>
        </div>
        <SystemIllustration />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        {aboutSections.map((section) => (
          <Card key={section.title} className="transition duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{section.icon}</div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{section.content}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <Card className="mt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Luồng hoạt động chính</h2>
            <p className="mt-1 text-sm text-slate-600">Các nhóm người dùng được kết nối trong cùng một quy trình tuyển dụng.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {flowSteps.map((step, index) => (
            <div key={step} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm font-semibold text-brand-700 shadow-sm">{index + 1}</span>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-800">{step}</p>
            </div>
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-brand-700">{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{new Intl.NumberFormat("vi-VN").format(value)}</p>
    </div>
  );
}

function SystemIllustration() {
  return (
    <div className="relative mx-auto h-64 w-80 max-w-full">
      <div className="absolute bottom-4 left-6 right-6 h-28 rounded-lg bg-white shadow-sm" />
      <div className="absolute bottom-10 left-10 right-10 rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, index) => <span key={index} className="h-3 rounded bg-brand-100" />)}
        </div>
      </div>
      <FloatingPanel className="left-4 top-8 rotate-[-8deg]" icon={<Users size={22} />} title="Student" />
      <FloatingPanel className="left-28 top-2 rotate-[3deg]" icon={<FileText size={22} />} title="CV" />
      <FloatingPanel className="right-4 top-10 rotate-[8deg]" icon={<BriefcaseBusiness size={22} />} title="Job" />
      <div className="absolute bottom-0 left-10 right-10 h-3 rounded-full bg-slate-200" />
    </div>
  );
}

function FloatingPanel({ className, icon, title }: { className: string; icon: ReactNode; title: string }) {
  return (
    <div className={`absolute h-28 w-24 rounded-md border border-slate-200 bg-white p-3 shadow-md transition duration-200 hover:-translate-y-1 ${className}`}>
      <div className="text-brand-600">{icon}</div>
      <p className="mt-3 text-xs font-semibold text-slate-900">{title}</p>
      <span className="mt-3 block h-2 rounded bg-brand-100" />
      <span className="mt-2 block h-2 rounded bg-slate-100" />
    </div>
  );
}

async function getAboutStats(): Promise<AboutStats> {
  const [jobsResponse, companiesResponse, usersResponse] = await Promise.allSettled([
    httpClient.get<ApiResponse<PageResponse<unknown>>>("/public/jobs", {
      params: { page: 1, size: 1 },
    }),
    httpClient.get<ApiResponse<PageResponse<unknown>>>("/public/companies", {
      params: { page: 1, size: 1 },
    }),
    httpClient.get<ApiResponse<PageResponse<unknown>>>("/admin/users", {
      params: { page: 1, size: 1, role: "STUDENT" },
    }),
  ]);

  return {
    jobs: jobsResponse.status === "fulfilled" ? jobsResponse.value.data.data.totalItems ?? 0 : 0,
    companies: companiesResponse.status === "fulfilled" ? companiesResponse.value.data.data.totalItems ?? 0 : 0,
    users: usersResponse.status === "fulfilled" ? usersResponse.value.data.data.totalItems ?? 0 : 0,
  };
}
