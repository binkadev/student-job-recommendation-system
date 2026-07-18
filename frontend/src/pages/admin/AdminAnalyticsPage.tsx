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
  createdAt: string;
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
  const analyticsQuery = useAsyncData(getAnalyticsJobs, []);
  const jobs = analyticsQuery.data?.items ?? [];
  const totalJobs = analyticsQuery.data?.totalItems ?? 0;
  const activeJobs = jobs.filter((job) => job.status === "ACTIVE").length;
  const pendingJobs = jobs.filter((job) => job.status === "PENDING_APPROVAL").length;
  const inactiveJobs = jobs.filter((job) => job.status === "CLOSED" || job.status === "REJECTED" || job.status === "EXPIRED").length;
  const companiesCount = new Set(jobs.map((job) => job.companyId)).size;
  const statusChartData = useMemo(() => buildStatusChartData(jobs), [jobs]);
  const trendChartData = useMemo(() => buildTrendChartData(jobs), [jobs]);

  if (analyticsQuery.loading && !analyticsQuery.data) {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader title="Thống kê hệ thống" description="Thống kê admin dựa trên API jobs hiện có. Các chỉ số chưa có API hiển thị 0." />
      {analyticsQuery.error ? <div className="mb-5"><ErrorState message={analyticsQuery.error} /></div> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<BriefcaseBusiness size={20} />} label="Tổng việc làm" value={totalJobs} />
        <Metric icon={<ShieldCheck size={20} />} label="Việc đang tuyển" value={activeJobs} />
        <Metric icon={<Activity size={20} />} label="Tin chờ duyệt" value={pendingJobs} />
        <Metric icon={<Database size={20} />} label="Tin không active" value={inactiveJobs} />
        <Metric icon={<Building2 size={20} />} label="Công ty từ jobs" value={companiesCount} />
        <Metric icon={<UserCog size={20} />} label="Người dùng" value={0} />
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
      <PageHeader title="Audit logs" description="Backend chưa có DB/API audit logs nên trang chỉ giữ khung lọc và bảng rỗng." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Actor user ID" value={filters.actorUserId} onChange={(event) => updateFilter("actorUserId", event.target.value)} placeholder="actor_user_id" disabled />
          <Input label="Action" value={filters.action} onChange={(event) => updateFilter("action", event.target.value)} placeholder="action" disabled />
          <Input label="Target type" value={filters.targetType} onChange={(event) => updateFilter("targetType", event.target.value)} placeholder="target_type" disabled />
          <Select label="Result" value={filters.result} onChange={(event) => updateFilter("result", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(auditResultLabels).map(([value, label]) => ({ value, label }))]} disabled />
          <Input label="Từ ngày" type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} disabled />
          <Input label="Đến ngày" type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} disabled />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng audit log: 0</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Backend hiện chưa có bảng audit_logs và chưa có endpoint quản lý nhật ký admin.</p>
      </Card>

      <Table
        rows={[] as AuditLogRow[]}
        getRowKey={(log) => String(log.id)}
        columns={[
          { key: "time", header: "Thời gian", render: (log) => formatDateTime(log.createdAt) },
          { key: "actor", header: "Actor", render: (log) => `User #${log.actorUserId}` },
          { key: "action", header: "Action", render: (log) => log.action },
          { key: "target", header: "Target", render: (log) => `${log.targetType} #${log.targetId}` },
          { key: "result", header: "Result", render: (log) => <StatusBadge label={auditResultLabels[log.result]} tone={getAuditTone(log.result)} /> },
        ]}
      />
      <div className="mt-4">
        <EmptyState message="Chưa có API audit logs nên bảng đang hiển thị 0 dòng, không dùng dữ liệu mock." />
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

async function getAnalyticsJobs(): Promise<PageResponse<JobResponse>> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page: 1, size: 100 },
  });
  return response.data.data;
}

function buildStatusChartData(jobs: JobResponse[]) {
  return (Object.keys(statusLabels) as BackendJobStatus[]).map((status) => ({
    label: statusLabels[status],
    value: jobs.filter((job) => job.status === status).length,
  }));
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
