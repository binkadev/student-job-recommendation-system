import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BriefcaseBusiness, Building2, FileText, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { useAsyncData } from "../../hooks/useAsyncData";
import { httpClient } from "../../services/api/httpClient";

type TimeRange = "7d" | "30d" | "90d" | "12m";
type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

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
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  status: BackendJobStatus;
  publishedAt: string | null;
  createdAt: string;
}

interface AdminDashboardData {
  jobs: JobResponse[];
  totalJobs: number;
}

const rangeLabels: Record<TimeRange, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  "90d": "90 ngày",
  "12m": "12 tháng",
};

const statusLabels: Record<BackendJobStatus, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang tuyển",
  CLOSED: "Đã đóng",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn",
};

export function AdminDashboardPage() {
  const dashboardQuery = useAsyncData(getAdminDashboardData, []);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  if (dashboardQuery.loading) {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  const data = dashboardQuery.data ?? { jobs: [], totalJobs: 0 };
  const jobs = data.jobs;
  const pendingJobs = jobs.filter((job) => job.status === "PENDING_APPROVAL");
  const companiesCount = new Set(jobs.map((job) => job.companyId)).size;
  const activeJobs = jobs.filter((job) => job.status === "ACTIVE").length;
  const inactiveJobs = jobs.filter((job) => job.status === "CLOSED" || job.status === "EXPIRED" || job.status === "REJECTED").length;

  const stats = [
    { label: "Tổng ứng viên", value: 0, icon: <Users />, note: "Chưa có API admin users" },
    { label: "Tổng recruiter", value: 0, icon: <Users />, note: "Chưa có API admin users" },
    { label: "Tổng doanh nghiệp", value: companiesCount, icon: <Building2 />, note: "Tạm tính từ companyId trong jobs" },
    { label: "Tổng việc làm", value: data.totalJobs, icon: <BriefcaseBusiness />, note: "GET /api/jobs" },
    { label: "Tổng đơn ứng tuyển", value: 0, icon: <FileText />, note: "Chưa có API admin applications list" },
    { label: "CV đã upload", value: 0, icon: <FileText />, note: "Chưa có API admin CV list" },
    { label: "Tin chờ duyệt", value: pendingJobs.length, icon: <AlertTriangle />, note: "Status PENDING_APPROVAL" },
    { label: "Công ty chờ xác thực", value: 0, icon: <Building2 />, note: "Chưa có API admin companies list" },
    { label: "Báo cáo chưa xử lý", value: 0, icon: <AlertTriangle />, note: "Chưa có API reports" },
  ];

  const statusChartData = buildStatusChartData(jobs);
  const overviewChartData = buildOverviewChartData({ totalJobs: data.totalJobs, activeJobs, pendingJobs: pendingJobs.length, inactiveJobs, companiesCount });
  const trendChartData = buildTrendChartData(jobs, timeRange);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Tổng quan quản trị" description="Theo dõi dữ liệu admin dựa trên các API backend hiện có. Các chỉ số chưa có API sẽ hiển thị 0." />
        <Select
          label="Filter thời gian"
          value={timeRange}
          onChange={(event) => setTimeRange(event.target.value as TimeRange)}
          options={Object.entries(rangeLabels).map(([value, label]) => ({ value, label }))}
        />
      </div>

      {dashboardQuery.error ? (
        <div className="mb-5">
          <ErrorState message={dashboardQuery.error} />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-brand-50 p-2 text-brand-700">{stat.icon}</div>
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-2xl font-semibold text-slate-950">{formatNumber(stat.value)}</p>
                <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Việc làm theo trạng thái">
          <ResponsiveContainer>
            <BarChart data={statusChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" name="Số tin" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Tổng quan dữ liệu hiện có">
          <ResponsiveContainer>
            <BarChart data={overviewChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" name="Số lượng" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={`Việc làm tạo mới trong ${rangeLabels[timeRange]}`}>
          <ResponsiveContainer>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line dataKey="jobs" stroke="#2563eb" name="Việc làm" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Dữ liệu chưa có API admin">
          <ResponsiveContainer>
            <BarChart data={[
              { label: "Users", value: 0 },
              { label: "Applications", value: 0 },
              { label: "CV", value: 0 },
              { label: "Reports", value: 0 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#f59e0b" name="Số lượng" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="mt-5">
        <Card>
          <SectionHeader title="Danh sách cần xử lý" description="Hiện lấy từ các tin tuyển dụng có trạng thái chờ duyệt trong API jobs." />
          {pendingJobs.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {pendingJobs.map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{job.title}</p>
                      <StatusBadge label="Tin chờ duyệt" tone="warning" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{job.companyName} - {formatDate(job.publishedAt || job.createdAt)}</p>
                  </div>
                  <Link to={`/admin/jobs/${job.id}/review`}><Button variant="secondary" size="sm">Xử lý</Button></Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Không có tin tuyển dụng chờ duyệt từ API jobs." />
          )}
        </Card>
      </section>
    </PageContainer>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card><SectionHeader title={title} /><div className="h-72">{children}</div></Card>;
}

async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page: 1, size: 100 },
  });
  return {
    jobs: response.data.data.items,
    totalJobs: response.data.data.totalItems,
  };
}

function buildStatusChartData(jobs: JobResponse[]) {
  return (Object.keys(statusLabels) as BackendJobStatus[]).map((status) => ({
    label: statusLabels[status],
    value: jobs.filter((job) => job.status === status).length,
  }));
}

function buildOverviewChartData(values: { totalJobs: number; activeJobs: number; pendingJobs: number; inactiveJobs: number; companiesCount: number }) {
  return [
    { label: "Tổng việc", value: values.totalJobs },
    { label: "Active", value: values.activeJobs },
    { label: "Chờ duyệt", value: values.pendingJobs },
    { label: "Không active", value: values.inactiveJobs },
    { label: "Công ty", value: values.companiesCount },
  ];
}

function buildTrendChartData(jobs: JobResponse[], timeRange: TimeRange) {
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
  const bucketCount = timeRange === "7d" ? 7 : timeRange === "30d" ? 6 : timeRange === "90d" ? 6 : 12;
  const bucketSize = Math.ceil(days / bucketCount);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  return Array.from({ length: bucketCount }, (_, index) => {
    const endOffset = (bucketCount - index - 1) * bucketSize;
    const startOffset = endOffset + bucketSize - 1;
    const start = addDays(today, -startOffset);
    const end = addDays(today, -endOffset);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return {
      label: timeRange === "7d" ? formatShortDate(end) : `${formatShortDate(start)}-${formatShortDate(end)}`,
      jobs: jobs.filter((job) => {
        const createdAt = new Date(job.createdAt).getTime();
        return createdAt >= start.getTime() && createdAt <= end.getTime();
      }).length,
    };
  });
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(value);
}
