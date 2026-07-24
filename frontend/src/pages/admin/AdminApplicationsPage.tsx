import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
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
import { httpClient } from "../../services/api/httpClient";

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

interface ApplicationResponse {
  id: number;
  status: ApplicationStatus;
  coverLetter: string | null;
  studentId: number;
  studentName: string;
  studentEmail: string;
  jobId: number;
  jobTitle: string;
  companyId: number;
  companyName: string;
  cvFileId: number | null;
  cvFileName: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const pageSize = 10;

const statusLabels: Record<ApplicationStatus, string> = {
  PENDING: "Chờ xử lý",
  REVIEWED: "Đã xem",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

export function AdminApplicationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { applicationId } = useParams();
  const id = Number(applicationId);

  if (mode === "detail" && Number.isFinite(id)) {
    return <AdminApplicationDetailPage applicationId={id} />;
  }

  return <AdminApplicationsListPage />;
}

function AdminApplicationsListPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    keyword: "",
    status: "",
    studentId: "",
    jobId: "",
    companyId: "",
    sort: "appliedAt,desc",
  });
  const applicationsQuery = useAsyncData(() => getAdminApplications(filters, page), [filters, page]);
  const result = applicationsQuery.data;

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Quản lý đơn ứng tuyển"
        description="Danh sách lấy từ GET /api/admin/applications theo các trường applications, students, jobs và companies trong DB."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input label="Tìm kiếm" value={filters.keyword} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="Tên ứng viên, email, công việc, công ty, CV" />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...statusOptions]} />
          <Select
            label="Sắp xếp"
            value={filters.sort}
            onChange={(event) => updateFilter("sort", event.target.value)}
            options={[
              { label: "Mới nhất", value: "appliedAt,desc" },
              { label: "Cũ nhất", value: "appliedAt,asc" },
              { label: "Cập nhật mới nhất", value: "updatedAt,desc" },
            ]}
          />
          <Input label="Student ID" value={filters.studentId} onChange={(event) => updateFilter("studentId", onlyDigits(event.target.value))} placeholder="0" />
          <Input label="Job ID" value={filters.jobId} onChange={(event) => updateFilter("jobId", onlyDigits(event.target.value))} placeholder="0" />
          <Input label="Company ID" value={filters.companyId} onChange={(event) => updateFilter("companyId", onlyDigits(event.target.value))} placeholder="0" />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng đơn ứng tuyển: {result?.totalItems ?? 0}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Bộ lọc dùng đúng query hiện có: keyword, status, studentId, jobId, companyId, page, size, sort.</p>
      </Card>

      {applicationsQuery.loading ? <LoadingState /> : null}
      {!applicationsQuery.loading && applicationsQuery.error ? <EmptyState message={applicationsQuery.error} /> : null}
      {!applicationsQuery.loading && !applicationsQuery.error && (result?.items.length ?? 0) === 0 ? <EmptyState message="Không có đơn ứng tuyển phù hợp." /> : null}

      {!applicationsQuery.loading && result?.items.length ? (
        <div className="space-y-4">
          <Table
            rows={result.items}
            getRowKey={(application) => String(application.id)}
            columns={[
              { key: "candidate", header: "Ứng viên", render: (application) => <CandidateSummary application={application} /> },
              { key: "job", header: "Tin tuyển dụng", render: (application) => <JobSummary application={application} /> },
              { key: "company", header: "Công ty", render: (application) => application.companyName },
              { key: "cv", header: "CV", render: (application) => application.cvFileName ?? "Không có" },
              { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={statusLabels[application.status]} tone={getStatusTone(application.status)} /> },
              { key: "time", header: "Thời gian", render: (application) => <TimeSummary application={application} /> },
              { key: "actions", header: "Thao tác", render: (application) => <Link to={`/admin/applications/${application.id}`}><Button variant="secondary" size="sm">Chi tiết</Button></Link> },
            ]}
          />
          <Pagination page={result.page} totalPages={Math.max(result.totalPages, 1)} onPageChange={setPage} />
        </div>
      ) : null}
    </PageContainer>
  );
}

function AdminApplicationDetailPage({ applicationId }: { applicationId: number }) {
  const applicationQuery = useAsyncData(() => getAdminApplication(applicationId), [applicationId]);

  if (applicationQuery.loading) return <PageContainer><LoadingState /></PageContainer>;
  if (applicationQuery.error || !applicationQuery.data) return <PageContainer><EmptyState message={applicationQuery.error ?? "Không tìm thấy đơn ứng tuyển."} /></PageContainer>;

  const application = applicationQuery.data;

  return (
    <PageContainer>
      <PageHeader title={`Đơn ứng tuyển #${application.id}`} description={`Chi tiết lấy từ GET /api/admin/applications/${application.id}.`} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeader title="Thông tin ứng tuyển" />
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <Info label="Ứng viên" value={`${application.studentName} (${application.studentEmail})`} />
            <Info label="Student ID" value={String(application.studentId)} />
            <Info label="Tin tuyển dụng" value={application.jobTitle} />
            <Info label="Job ID" value={String(application.jobId)} />
            <Info label="Công ty" value={application.companyName} />
            <Info label="Company ID" value={String(application.companyId)} />
            <Info label="CV" value={application.cvFileName ?? "Không có"} />
            <Info label="CV file ID" value={application.cvFileId ? String(application.cvFileId) : "Không có"} />
            <Info label="Ngày ứng tuyển" value={formatDateTime(application.appliedAt)} />
            <Info label="Ngày duyệt" value={formatDateTime(application.reviewedAt)} />
            <Info label="Ngày tạo" value={formatDateTime(application.createdAt)} />
            <Info label="Cập nhật" value={formatDateTime(application.updatedAt)} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Trạng thái" />
          <StatusBadge label={statusLabels[application.status]} tone={getStatusTone(application.status)} />
          <div className="mt-5">
            <Link to="/admin/applications"><Button variant="secondary" className="w-full">Quay lại danh sách</Button></Link>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader title="Thư giới thiệu" />
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{application.coverLetter || "Ứng viên chưa nhập thư giới thiệu."}</p>
        </Card>
      </div>
    </PageContainer>
  );
}

function CandidateSummary({ application }: { application: ApplicationResponse }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{application.studentName}</p>
      <p className="mt-1 text-xs text-slate-500">{application.studentEmail}</p>
      <p className="mt-1 text-xs text-slate-500">ID: {application.studentId}</p>
    </div>
  );
}

function JobSummary({ application }: { application: ApplicationResponse }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{application.jobTitle}</p>
      <p className="mt-1 text-xs text-slate-500">Job ID: {application.jobId}</p>
    </div>
  );
}

function TimeSummary({ application }: { application: ApplicationResponse }) {
  return (
    <div className="min-w-[150px] text-xs text-slate-500">
      <p>Ứng tuyển: {formatDateTime(application.appliedAt)}</p>
      <p>Cập nhật: {formatDateTime(application.updatedAt)}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

async function getAdminApplications(filters: Record<string, string>, page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<ApplicationResponse>>>("/admin/applications", {
    params: {
      page,
      size: pageSize,
      keyword: emptyToUndefined(filters.keyword),
      status: emptyToUndefined(filters.status),
      studentId: emptyToUndefined(filters.studentId),
      jobId: emptyToUndefined(filters.jobId),
      companyId: emptyToUndefined(filters.companyId),
      sort: emptyToUndefined(filters.sort),
    },
  });
  return response.data.data;
}

async function getAdminApplication(applicationId: number) {
  const response = await httpClient.get<ApiResponse<ApplicationResponse>>(`/admin/applications/${applicationId}`);
  return response.data.data;
}

function getStatusTone(status: ApplicationStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "PENDING" || status === "REVIEWED") return "warning" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger" as const;
  return "neutral" as const;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
