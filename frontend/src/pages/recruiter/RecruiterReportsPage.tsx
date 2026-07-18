import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

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

interface ReportData {
  jobs: JobResponse[];
  applications: ApplicationResponse[];
}

interface JobPerformanceRow {
  id: number;
  title: string;
  applications: number;
  pending: number;
  reviewed: number;
  accepted: number;
  rejected: number;
  withdrawn: number;
  conversion: number;
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

const colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function RecruiterReportsPage() {
  const { showToast } = useToast();
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const reportQuery = useAsyncData(() => getRecruiterReportData(), []);

  const jobs = reportQuery.data?.jobs ?? [];
  const applications = reportQuery.data?.applications ?? [];
  const jobOptions = useMemo(() => jobs.map((job) => ({ label: job.title, value: String(job.id) })), [jobs]);
  const filteredApplications = useMemo(() => {
    return applications.filter((application) => {
      const month = application.appliedAt.slice(0, 7);
      const matchFrom = !fromMonth || month >= fromMonth;
      const matchTo = !toMonth || month <= toMonth;
      const matchJob = !jobFilter || String(application.jobId) === jobFilter;
      const matchStatus = !statusFilter || application.status === statusFilter;
      return matchFrom && matchTo && matchJob && matchStatus;
    });
  }, [applications, fromMonth, jobFilter, statusFilter, toMonth]);

  const totals = useMemo(() => summarize(filteredApplications), [filteredApplications]);
  const trendData = useMemo(() => groupByMonth(filteredApplications), [filteredApplications]);
  const statusData = useMemo(() => groupByStatus(filteredApplications), [filteredApplications]);
  const jobPerformance = useMemo(() => buildJobPerformance(jobs, filteredApplications), [filteredApplications, jobs]);

  function exportCsv() {
    const rows = [
      ["applicationId", "studentName", "studentEmail", "jobId", "jobTitle", "status", "cvFileName", "appliedAt", "reviewedAt"],
      ...filteredApplications.map((item) => [item.id, item.studentName ?? "", item.studentEmail ?? "", item.jobId, item.jobTitle, item.status, item.cvFileName ?? "", item.appliedAt, item.reviewedAt ?? ""]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-ung-tuyen-${fromMonth || "all"}-${toMonth || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: "success", title: "Đã export CSV", message: "File CSV được tạo từ dữ liệu application thật." });
  }

  if (reportQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (reportQuery.error) {
    return (
      <PageContainer>
        <PageHeader title="Báo cáo tuyển dụng" description="Không thể tải báo cáo từ backend." />
        <EmptyState message={reportQuery.error} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Báo cáo tuyển dụng" description="Báo cáo tính từ jobs và applications thật của backend." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Input label="Từ tháng" type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} />
          <Input label="Đến tháng" type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} />
          <Select label="Tin tuyển dụng" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...jobOptions]} />
          <Select label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Button className="self-end" onClick={exportCsv}>Export CSV</Button>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Tổng ứng viên" value={totals.total} />
        <StatCard label="Chờ xử lý" value={totals.pending} />
        <StatCard label="Đã xem" value={totals.reviewed} />
        <StatCard label="Đã nhận" value={totals.accepted} />
        <StatCard label="Từ chối/rút" value={totals.rejected + totals.withdrawn} />
        <StatCard label="Tỷ lệ nhận" value={`${totals.conversion}%`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Ứng tuyển theo tháng">
          {trendData.length ? (
            <ResponsiveContainer>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="applications" fill="#2563eb" name="Ứng viên" />
                <Bar dataKey="accepted" fill="#10b981" name="Đã nhận" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="Chưa có dữ liệu ứng tuyển theo bộ lọc." />}
        </ChartCard>

        <ChartCard title="Phân bổ trạng thái">
          {statusData.length ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="label" outerRadius={95} label>
                  {statusData.map((item, index) => <Cell key={item.label} fill={colors[index % colors.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState message="Chưa có dữ liệu trạng thái ứng tuyển." />}
        </ChartCard>

        <ChartCard title="Pipeline backend">
          {statusData.length ? (
            <ResponsiveContainer>
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" name="Hồ sơ" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="Chưa có dữ liệu pipeline." />}
        </ChartCard>

        <ChartCard title="Hiệu quả theo tin tuyển dụng">
          {jobPerformance.length ? (
            <ResponsiveContainer>
              <BarChart data={jobPerformance.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="applications" fill="#2563eb" name="Ứng viên" />
                <Bar dataKey="accepted" fill="#10b981" name="Đã nhận" />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="Chưa có dữ liệu theo tin tuyển dụng." />}
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <JobPerformanceTable rows={jobPerformance} />
        <UnsupportedReportCard />
      </div>
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></Card>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><SectionHeader title={title} /><div className="h-72">{children}</div></Card>;
}

function JobPerformanceTable({ rows }: { rows: JobPerformanceRow[] }) {
  return (
    <Card>
      <SectionHeader title="Tin tuyển dụng" description="Hiệu quả theo số lượng application thật." />
      {rows.length ? (
        <Table
          rows={rows}
          getRowKey={(row) => String(row.id)}
          columns={[
            { key: "title", header: "Tin tuyển dụng", render: (row) => <span className="font-medium text-slate-900">{row.title}</span> },
            { key: "applications", header: "Ứng viên", render: (row) => row.applications },
            { key: "accepted", header: "Đã nhận", render: (row) => row.accepted },
            { key: "rejected", header: "Từ chối/rút", render: (row) => row.rejected + row.withdrawn },
            { key: "rate", header: "Tỷ lệ", render: (row) => <StatusBadge label={`${row.conversion}%`} tone={row.conversion >= 20 ? "success" : "warning"} /> },
          ]}
        />
      ) : <EmptyState message="Chưa có dữ liệu tin tuyển dụng." />}
    </Card>
  );
}

function UnsupportedReportCard() {
  return (
    <Card>
      <SectionHeader title="Chỉ số chưa có API" description="Các chỉ số dưới đây không còn dùng dữ liệu giả." />
      <div className="flex flex-wrap gap-2">
        {["Nguồn ứng viên", "Phỏng vấn", "Offer accepted", "Time-to-hire", "Recruiter phụ trách", "Phòng ban"].map((item) => <StatusBadge key={item} label={item} />)}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">Khi backend bổ sung endpoint hoặc trường dữ liệu tương ứng, trang báo cáo có thể hiển thị các chỉ số này bằng dữ liệu thật.</p>
    </Card>
  );
}

async function getRecruiterReportData(): Promise<ReportData> {
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

function summarize(applications: ApplicationResponse[]) {
  const pending = countByStatus(applications, "PENDING");
  const reviewed = countByStatus(applications, "REVIEWED");
  const accepted = countByStatus(applications, "ACCEPTED");
  const rejected = countByStatus(applications, "REJECTED");
  const withdrawn = countByStatus(applications, "WITHDRAWN");
  return {
    total: applications.length,
    pending,
    reviewed,
    accepted,
    rejected,
    withdrawn,
    conversion: applications.length ? Math.round((accepted / applications.length) * 100) : 0,
  };
}

function groupByMonth(applications: ApplicationResponse[]) {
  const grouped = applications.reduce<Record<string, ApplicationResponse[]>>((acc, application) => {
    const month = application.appliedAt.slice(0, 7);
    acc[month] = [...(acc[month] ?? []), application];
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([month, rows]) => ({
      label: month,
      applications: rows.length,
      accepted: countByStatus(rows, "ACCEPTED"),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function groupByStatus(applications: ApplicationResponse[]) {
  return (Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[])
    .map((status) => ({
      label: APPLICATION_STATUS_LABELS[status],
      value: countByStatus(applications, status),
    }))
    .filter((item) => item.value > 0);
}

function buildJobPerformance(jobs: JobResponse[], applications: ApplicationResponse[]): JobPerformanceRow[] {
  return jobs
    .map((job) => {
      const rows = applications.filter((application) => application.jobId === job.id);
      const accepted = countByStatus(rows, "ACCEPTED");
      return {
        id: job.id,
        title: job.title,
        applications: rows.length,
        pending: countByStatus(rows, "PENDING"),
        reviewed: countByStatus(rows, "REVIEWED"),
        accepted,
        rejected: countByStatus(rows, "REJECTED"),
        withdrawn: countByStatus(rows, "WITHDRAWN"),
        conversion: rows.length ? Math.round((accepted / rows.length) * 100) : 0,
      };
    })
    .filter((row) => row.applications > 0)
    .sort((left, right) => right.applications - left.applications);
}

function countByStatus(applications: ApplicationResponse[], status: ApplicationStatus) {
  return applications.filter((application) => application.status === status).length;
}
