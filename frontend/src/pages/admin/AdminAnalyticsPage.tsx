import { Activity, BriefcaseBusiness, Building2, Database, ShieldCheck, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAsyncData } from "../../hooks/useAsyncData";
import { httpClient } from "../../services/api/httpClient";

type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type UserRole = "STUDENT" | "COMPANY" | "ADMIN";
type AuditResult = "SUCCESS" | "FAILED" | "WARNING";

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
  title: string;
  status: BackendJobStatus;
  deadline: string | null;
  createdAt: string;
}

interface AnalyticsData {
  jobs: JobResponse[];
  totalJobs: number;
  activeJobs: number;
  totalUsers: number;
  totalCompanies: number;
}

interface PublicStatisticsResponse {
  totalJobs?: number | null;
  jobCount?: number | null;
  jobs?: number | null;
}

interface AuditLogRow {
  id: number;
  actorUserId: number;
  action: string;
  targetType: string;
  targetId: number;
  result: AuditResult;
  createdAt: string;
}

const statusLabels: Record<BackendJobStatus, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang tuyển",
  CLOSED: "Đã đóng",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn",
};

const auditResultLabels: Record<AuditResult, string> = {
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  WARNING: "Cảnh báo",
};

export function AdminAnalyticsPage({ mode = "analytics" }: { mode?: "analytics" | "audit" }) {
  if (mode === "audit") {
    return <AuditLogsPage />;
  }

  return <AnalyticsPage />;
}

function AnalyticsPage() {
  const analyticsQuery = useAsyncData(getAnalyticsData, []);
  const jobs = useMemo(() => analyticsQuery.data?.jobs ?? [], [analyticsQuery.data?.jobs]);
  const totalJobs = analyticsQuery.data?.totalJobs ?? 0;
  const totalUsers = analyticsQuery.data?.totalUsers ?? 0;
  const totalCompanies = analyticsQuery.data?.totalCompanies ?? 0;
  const activeJobs = analyticsQuery.data?.activeJobs ?? 0;
  const pendingJobs = jobs.filter((job) => job.status === "PENDING_APPROVAL").length;
  const effectiveStatusCounts = useMemo(() => buildEffectiveJobStatusCounts(jobs), [jobs]);
  const inactiveJobs = effectiveStatusCounts.CLOSED + effectiveStatusCounts.REJECTED + effectiveStatusCounts.EXPIRED;
  const statusChartData = useMemo(() => buildStatusChartData(effectiveStatusCounts, activeJobs), [activeJobs, effectiveStatusCounts]);
  const trendChartData = useMemo(() => buildTrendChartData(jobs), [jobs]);

  if (analyticsQuery.loading && !analyticsQuery.data) {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader title="Thống kê hệ thống" description="Theo dõi tình hình hoạt động của hệ thống." />
      {analyticsQuery.error ? <div className="mb-5"><ErrorState message={analyticsQuery.error} /></div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<BriefcaseBusiness size={20} />} label="Tổng việc làm" value={totalJobs} />
        <Metric icon={<ShieldCheck size={20} />} label="Việc đang tuyển" value={activeJobs} />
        <Metric icon={<Activity size={20} />} label="Tin chờ duyệt" value={pendingJobs} />
        <Metric icon={<Database size={20} />} label="Tin không active" value={inactiveJobs} />
        <Metric icon={<Building2 size={20} />} label="Doanh nghiệp" value={totalCompanies} />
        <Metric icon={<UserCog size={20} />} label="Người dùng" value={totalUsers} />
        <Metric icon={<Activity size={20} />} label="Đơn ứng tuyển" value={0} />
        <Metric icon={<Database size={20} />} label="CV" value={0} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
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
        <ChartCard title="Việc làm tạo mới theo thời gian">
          <ResponsiveContainer>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line dataKey="jobs" stroke="#10b981" name="Việc làm" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </PageContainer>
  );
}

function AuditLogsPage() {
  const [filters, setFilters] = useState({
    actorUserId: "",
    action: "",
    targetType: "",
    result: "",
    dateFrom: "",
    dateTo: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PageContainer>
      <PageHeader title="Nhật ký hoạt động" description="Theo dõi các hoạt động quản trị trong hệ thống." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Mã người thao tác" value={filters.actorUserId} onChange={(event) => updateFilter("actorUserId", event.target.value)} placeholder="0" disabled />
          <Input label="Hành động" value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} placeholder="Hành động" disabled />
          <Input label="Loại đối tượng" value={filters.targetType} onChange={(event) => updateFilter("targetType", event.target.value)} placeholder="Loại đối tượng" disabled />
          <Select label="Kết quả" value={filters.result} onChange={(event) => updateFilter("result", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(auditResultLabels).map(([value, label]) => ({ value, label }))]} disabled />
          <Input label="Từ ngày" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} disabled />
          <Input label="Đến ngày" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} disabled />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng nhật ký: 0</p>
      </Card>

      <Table
        rows={[] as AuditLogRow[]}
        getRowKey={(log) => String(log.id)}
        columns={[
          { key: "time", header: "Thời gian", render: (log) => formatDateTime(log.createdAt) },
          { key: "actor", header: "Người thao tác", render: (log) => `Người dùng #${log.actorUserId}` },
          { key: "action", header: "Hành động", render: (log) => log.action },
          { key: "target", header: "Đối tượng", render: (log) => `${log.targetType} #${log.targetId}` },
          { key: "result", header: "Kết quả", render: (log) => <StatusBadge label={auditResultLabels[log.result]} tone={getAuditTone(log.result)} /> },
        ]}
      />
      <div className="mt-4">
        <EmptyState message="Chưa có nhật ký hoạt động." />
      </div>
    </PageContainer>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card><SectionHeader title={title} /><div className="h-72">{children}</div></Card>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{new Intl.NumberFormat("vi-VN").format(value)}</p>
    </Card>
  );
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  const [jobsByStatus, publicStatistics, students, recruiters, admins, companies] = await Promise.all([
    getJobsByStatus(),
    getPublicStatistics(),
    getAdminUserCount("STUDENT"),
    getAdminUserCount("COMPANY"),
    getAdminUserCount("ADMIN"),
    getAdminCompanyCount(),
  ]);
  const jobs = Object.values(jobsByStatus)
    .flatMap((result) => result.items)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return {
    jobs,
    totalJobs: jobs.length,
    activeJobs: getTotalPublicJobs(publicStatistics, jobs.filter((job) => job.status === "ACTIVE").length),
    totalUsers: students + recruiters + admins,
    totalCompanies: companies,
  };
}

async function getJobsByStatus() {
  const statuses = Object.keys(statusLabels) as BackendJobStatus[];
  const responses = await Promise.all(statuses.map(async (status) => {
    const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
      params: { page: 1, size: 100, status },
    });
    return [status, response.data.data] as const;
  }));

  return Object.fromEntries(responses) as Record<BackendJobStatus, PageResponse<JobResponse>>;
}

async function getPublicStatistics(): Promise<PublicStatisticsResponse | null> {
  try {
    const response = await httpClient.get<ApiResponse<PublicStatisticsResponse>>("/public/statistics");
    return response.data.data;
  } catch {
    return null;
  }
}

function getTotalPublicJobs(stats: PublicStatisticsResponse | null, fallback: number) {
  return Number(stats?.totalJobs ?? stats?.jobCount ?? stats?.jobs ?? fallback);
}

async function getAdminUserCount(role: UserRole) {
  const response = await httpClient.get<ApiResponse<PageResponse<unknown>>>("/admin/users", {
    params: { page: 1, size: 1, role },
  });
  return response.data.data.totalItems;
}

async function getAdminCompanyCount() {
  const response = await httpClient.get<ApiResponse<PageResponse<unknown>>>("/admin/companies", {
    params: { page: 1, size: 1 },
  });
  return response.data.data.totalItems;
}

function buildStatusChartData(counts: Record<BackendJobStatus, number>, publicActiveJobs: number) {
  return (Object.keys(statusLabels) as BackendJobStatus[]).map((status) => ({
    label: statusLabels[status],
    value: status === "ACTIVE" ? publicActiveJobs : counts[status],
  }));
}

function buildEffectiveJobStatusCounts(jobs: JobResponse[]) {
  return jobs.reduce((counts, job) => {
    counts[getEffectiveJobStatus(job)] += 1;
    return counts;
  }, emptyJobStatusCounts());
}

function emptyJobStatusCounts(): Record<BackendJobStatus, number> {
  return {
    DRAFT: 0,
    PENDING_APPROVAL: 0,
    ACTIVE: 0,
    CLOSED: 0,
    REJECTED: 0,
    EXPIRED: 0,
  };
}

function getEffectiveJobStatus(job: Pick<JobResponse, "status" | "deadline">): BackendJobStatus {
  if (job.status === "ACTIVE" && isExpiredDeadline(job.deadline)) return "EXPIRED";
  return job.status;
}

function isExpiredDeadline(value?: string | null) {
  if (!value) return false;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime();
}

function buildTrendChartData(jobs: JobResponse[]) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return Array.from({ length: 6 }, (_, index) => {
    const end = addDays(today, -(5 - index) * 5);
    const start = addDays(end, -4);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return {
      label: `${formatShortDate(start)}-${formatShortDate(end)}`,
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

function getAuditTone(result: AuditResult) {
  if (result === "SUCCESS") return "success" as const;
  if (result === "WARNING") return "warning" as const;
  if (result === "FAILED") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(value);
}
