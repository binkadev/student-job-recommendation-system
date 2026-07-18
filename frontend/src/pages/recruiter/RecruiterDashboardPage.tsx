import { BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock, FileWarning, Handshake, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { useAsyncData } from "../../hooks/useAsyncData";
import { httpClient } from "../../services/api/httpClient";

type RangeFilter = "7" | "30" | "90";
type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

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
  location: string | null;
  status: JobStatus;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ApplicationResponse {
  id: number;
  status: ApplicationStatus;
  studentName: string | null;
  studentEmail: string | null;
  jobId: number;
  jobTitle: string;
  companyName: string;
  cvFileName: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardData {
  jobs: JobResponse[];
  applications: ApplicationResponse[];
}

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Chờ xử lý",
  REVIEWED: "Đã xem",
  ACCEPTED: "Đã nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Ứng viên rút đơn",
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang tuyển",
  CLOSED: "Đã đóng",
  REJECTED: "Bị từ chối",
  EXPIRED: "Hết hạn",
};

export function RecruiterDashboardPage() {
  const [range, setRange] = useState<RangeFilter>("30");
  const dashboardQuery = useAsyncData(() => getRecruiterDashboardData(), []);

  if (dashboardQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <PageContainer>
        <EmptyState message={dashboardQuery.error ?? "Không thể tải dashboard nhà tuyển dụng."} />
      </PageContainer>
    );
  }

  const { jobs, applications } = dashboardQuery.data;
  const activeJobs = jobs.filter((job) => job.status === "ACTIVE");
  const pendingApplications = applications.filter((application) => application.status === "PENDING");
  const reviewedApplications = applications.filter((application) => application.status === "REVIEWED");
  const acceptedApplications = applications.filter((application) => application.status === "ACCEPTED");
  const expiringJobs = jobs.filter((job) => job.status === "ACTIVE" && daysUntil(job.deadline) <= 14 && daysUntil(job.deadline) >= 0).slice(0, 4);
  const issueJobs = jobs.filter((job) => ["REJECTED", "CLOSED", "EXPIRED"].includes(job.status));
  const recentApplications = applications.slice(0, 5);
  const statusChartData = buildStatusChartData(applications);
  const jobChartData = buildJobChartData(jobs, applications).slice(0, 6);
  const trendData = buildApplicationTrend(applications, Number(range));

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Tổng quan nhà tuyển dụng</h1>
          <p className="mt-1 text-sm text-slate-600">Theo dõi tin tuyển dụng và hồ sơ ứng tuyển từ dữ liệu backend hiện có.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            label="Khoảng thời gian"
            value={range}
            onChange={(event) => setRange(event.target.value as RangeFilter)}
            options={[
              { label: "7 ngày", value: "7" },
              { label: "30 ngày", value: "30" },
              { label: "90 ngày", value: "90" },
            ]}
          />
          <Link className="self-end" to="/recruiter/candidates"><Button>Việc cần xử lý hôm nay</Button></Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatLink icon={<BriefcaseBusiness size={20} />} label="Tin đang tuyển" value={String(activeJobs.length)} to="/recruiter/jobs" />
        <StatLink icon={<Users size={20} />} label="Ứng viên mới" value={String(pendingApplications.length)} to="/recruiter/candidates" />
        <StatLink icon={<BarChart3 size={20} />} label="Đã xem xét" value={String(reviewedApplications.length)} to="/recruiter/candidates" />
        <StatLink icon={<CalendarDays size={20} />} label="Phỏng vấn" value="0" to="/recruiter/interviews" />
        <StatLink icon={<Handshake size={20} />} label="Đã nhận" value={String(acceptedApplications.length)} to="/recruiter/candidates" />
        <StatLink icon={<CheckCircle2 size={20} />} label="Tổng ứng tuyển" value={String(applications.length)} to="/recruiter/candidates" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Ứng viên theo thời gian" description="Tính từ ngày ứng tuyển trong ApplicationResponse." />
          {trendData.length ? (
            <ChartBox>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="applications" fill="#2563eb" name="Ứng viên" />
              </BarChart>
            </ChartBox>
          ) : <EmptyState message="Chưa có dữ liệu ứng tuyển trong khoảng thời gian đã chọn." />}
        </Card>

        <Card>
          <SectionHeader title="Trạng thái ứng tuyển" />
          {statusChartData.length ? (
            <ChartBox>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="label" outerRadius={95} label>
                  {statusChartData.map((_, index) => <Cell key={index} fill={["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#64748b"][index]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ChartBox>
          ) : <EmptyState message="Chưa có hồ sơ ứng tuyển." />}
        </Card>

        <Card>
          <SectionHeader title="Pipeline backend" description="Pipeline hiện dựa trên trạng thái application backend." />
          {statusChartData.length ? (
            <ChartBox>
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" name="Hồ sơ" />
              </BarChart>
            </ChartBox>
          ) : <EmptyState message="Chưa có dữ liệu pipeline." />}
        </Card>

        <Card>
          <SectionHeader title="Ứng tuyển theo tin" description="Backend chưa có lượt xem nên biểu đồ chỉ dùng số ứng tuyển thật." />
          {jobChartData.length ? (
            <ChartBox>
              <BarChart data={jobChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="applications" fill="#f59e0b" name="Ứng viên" />
              </BarChart>
            </ChartBox>
          ) : <EmptyState message="Chưa có tin tuyển dụng hoặc ứng viên." />}
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <SectionHeader title="Việc cần xử lý" />
          <div className="space-y-3">
            <TodoItem icon={<Users size={18} />} label={`${pendingApplications.length} ứng viên chờ xử lý`} to="/recruiter/candidates" />
            <TodoItem icon={<CalendarDays size={18} />} label="Lịch phỏng vấn chưa có API backend" to="/recruiter/interviews" />
            <TodoItem icon={<Clock size={18} />} label={`${expiringJobs.length} tin sắp hết hạn`} to="/recruiter/jobs" />
            <TodoItem icon={<FileWarning size={18} />} label={`${issueJobs.length} tin đã đóng/hết hạn/bị từ chối`} to="/recruiter/jobs" />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Ứng viên mới nhất" />
          <div className="space-y-3">
            {recentApplications.length ? recentApplications.map((application) => (
              <div key={application.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium text-slate-900">{application.studentName || application.studentEmail || "Ứng viên"}</p>
                  <p className="text-sm text-slate-500">{application.jobTitle} • {formatDateTime(application.appliedAt)}</p>
                  <div className="mt-2"><StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} /></div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link to={`/recruiter/candidates/${application.id}`}><Button variant="secondary" size="sm">Xem</Button></Link>
                </div>
              </div>
            )) : <EmptyState message="Chưa có ứng viên ứng tuyển." />}
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Phỏng vấn sắp tới" />
          <EmptyState message="Backend hiện chưa có API lịch phỏng vấn cho nhà tuyển dụng." />
        </Card>

        <Card>
          <SectionHeader title="Tin sắp hết hạn" />
          <div className="space-y-3">
            {expiringJobs.length ? expiringJobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-sm text-slate-500">Hạn tuyển {formatDate(job.deadline)} • {countApplicationsForJob(applications, job.id)} ứng viên</p>
                </div>
                <Link to={`/recruiter/jobs/${job.id}`}><Button variant="secondary" size="sm">Mở tin</Button></Link>
              </div>
            )) : <EmptyState message="Không có tin đang tuyển sắp hết hạn." />}
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}

function ChartBox({ children }: { children: ReactNode }) {
  return (
    <div className="h-72">
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

function StatLink({ icon, label, value, to }: { icon: ReactNode; label: string; value: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="h-full transition hover:border-brand-200 hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</div>
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function TodoItem({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm text-slate-700 hover:border-brand-200 hover:bg-brand-50">
      <span className="text-brand-700">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

async function getRecruiterDashboardData(): Promise<DashboardData> {
  const jobsResponse = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page: 1, size: 100 },
  });
  const jobs = jobsResponse.data.data.items;
  const applicationResponses = await Promise.all(
    jobs.map((job) => httpClient.get<ApiResponse<ApplicationResponse[]>>(`/companies/me/jobs/${job.id}/applications`)),
  );
  const applications = applicationResponses
    .flatMap((response) => response.data.data)
    .sort((left, right) => new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime());

  return { jobs, applications };
}

function buildStatusChartData(applications: ApplicationResponse[]) {
  return (Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[])
    .map((status) => ({
      label: APPLICATION_STATUS_LABELS[status],
      value: applications.filter((application) => application.status === status).length,
    }))
    .filter((item) => item.value > 0);
}

function buildJobChartData(jobs: JobResponse[], applications: ApplicationResponse[]) {
  return jobs
    .map((job) => ({
      title: job.title,
      applications: countApplicationsForJob(applications, job.id),
    }))
    .filter((item) => item.applications > 0)
    .sort((left, right) => right.applications - left.applications);
}

function buildApplicationTrend(applications: ApplicationResponse[], days: number) {
  const today = new Date();
  const rows = Array.from({ length: Math.min(days, 14) }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (Math.min(days, 14) - 1 - index));
    const key = toDateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date),
      applications: applications.filter((application) => application.appliedAt.slice(0, 10) === key).length,
    };
  });
  return rows.filter((row) => row.applications > 0);
}

function countApplicationsForJob(applications: ApplicationResponse[], jobId: number) {
  return applications.filter((application) => application.jobId === jobId).length;
}

function applicationStatusTone(status: ApplicationStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger" as const;
  if (status === "REVIEWED") return "warning" as const;
  return "neutral" as const;
}

function daysUntil(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
