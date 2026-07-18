import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { ErrorState } from "../../components/feedback/ErrorState";
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

interface JobResponse {
  companyId: number;
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

export function PublicInfoPage({ title, description, variant = "default" }: PublicInfoPageProps) {
  if (variant === "about") {
    return <AboutPage title={title} description={description} />;
  }

  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <Card>
        <p className="text-sm leading-6 text-slate-700">
          Nội dung trang thông tin công khai này đang được viết tĩnh trên frontend. Backend hiện chưa có API public riêng cho nội dung pháp lý hoặc thông tin vận hành.
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
      <PageHeader title={title} description={description} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Việc làm đang tuyển" value={stats.jobs} />
        <StatCard label="Công ty tuyển dụng" value={stats.companies} />
        <StatCard label="Người dùng" value={stats.users} />
      </div>

      {statsQuery.error ? (
        <div className="mt-5">
          <ErrorState message="Không lấy được thống kê từ API. Các chỉ số đang hiển thị mặc định là 0." />
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Mục đích hệ thống</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            <p>
              Student Job Recommendation System hỗ trợ sinh viên IT tìm kiếm việc làm, thực tập và các vị trí phù hợp với hồ sơ cá nhân.
            </p>
            <p>
              Nền tảng giúp ứng viên quản lý CV, theo dõi lịch sử ứng tuyển, lưu việc làm quan tâm và kết nối với nhà tuyển dụng đang có nhu cầu tuyển nhân sự công nghệ.
            </p>
            <p>
              Phần gợi ý việc làm theo CV và hồ sơ sẽ được phát triển theo thuật toán riêng ở bước sau. Hiện tại trang giới thiệu chỉ dùng API sẵn có để hiển thị các chỉ số hệ thống cơ bản.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-950">Dữ liệu đang sử dụng</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            <p>Số việc làm lấy từ API jobs với trạng thái active.</p>
            <p>Số công ty được tạm tính từ các `companyId` xuất hiện trong danh sách việc làm active.</p>
            <p>Số người dùng đang để 0 vì backend chưa có public API thống kê người dùng.</p>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-3xl font-semibold text-slate-950">{new Intl.NumberFormat("vi-VN").format(value)}</p>
      <p className="mt-2 text-sm text-slate-600">{label}</p>
    </Card>
  );
}

async function getAboutStats(): Promise<AboutStats> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page: 1, size: 100, status: "ACTIVE" },
  });
  const page = response.data.data;

  return {
    jobs: page.totalItems ?? 0,
    companies: new Set(page.items.map((job) => job.companyId)).size,
    users: 0,
  };
}
