import { FileText, Mail, RefreshCcw, Search, UserCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

interface RecruiterCandidatesPageProps {
  mode?: "list" | "detail" | "evaluation" | "pipeline" | "recommended" | "saved" | "search";
}

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
  createdAt: string;
  updatedAt: string;
}

interface ApplicationResponse {
  id: number;
  status: ApplicationStatus;
  coverLetter: string | null;
  studentId: number;
  studentName: string | null;
  studentEmail: string | null;
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

type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

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

export function RecruiterCandidatesPage({ mode = "list" }: RecruiterCandidatesPageProps) {
  const { candidateId } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const applicationsQuery = useAsyncData(() => getCompanyApplications(), [reloadKey]);

  if (mode === "recommended" || mode === "saved" || mode === "search") {
    return <UnsupportedCandidateMode mode={mode} />;
  }

  if ((mode === "detail" || mode === "evaluation") && candidateId) {
    return (
      <ApplicationDetailPage
        applicationId={Number(candidateId)}
        applications={applicationsQuery.data ?? []}
        loading={applicationsQuery.loading}
        error={applicationsQuery.error}
        onReload={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return (
    <ApplicationsListPage
      mode={mode}
      applications={applicationsQuery.data ?? []}
      loading={applicationsQuery.loading}
      error={applicationsQuery.error}
      onReload={() => setReloadKey((current) => current + 1)}
      showToast={showToast}
    />
  );
}

function ApplicationsListPage({
  mode,
  applications,
  loading,
  error,
  onReload,
  showToast,
}: {
  mode: RecruiterCandidatesPageProps["mode"];
  applications: ApplicationResponse[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  showToast: ReturnType<typeof useToast>["showToast"];
}) {
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationResponse | null>(null);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [updating, setUpdating] = useState(false);

  const jobOptions = useMemo(() => Array.from(new Set(applications.map((application) => application.jobTitle))).sort(), [applications]);
  const filteredApplications = useMemo(() => {
    let result = applications;
    if (query) {
      const keyword = query.toLowerCase();
      result = result.filter((application) => `${application.studentName ?? ""} ${application.studentEmail ?? ""} ${application.jobTitle} ${application.cvFileName ?? ""}`.toLowerCase().includes(keyword));
    }
    if (jobFilter) result = result.filter((application) => application.jobTitle === jobFilter);
    if (statusFilter) result = result.filter((application) => application.status === statusFilter);
    if (appliedFrom) result = result.filter((application) => application.appliedAt.slice(0, 10) >= appliedFrom);
    if (appliedTo) result = result.filter((application) => application.appliedAt.slice(0, 10) <= appliedTo);
    return result;
  }, [applications, appliedFrom, appliedTo, jobFilter, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / 8));
  const pagedApplications = filteredApplications.slice((page - 1) * 8, page * 8);

  async function changeStatus(application: ApplicationResponse, status: ApplicationStatus) {
    setUpdating(true);
    try {
      await updateApplicationStatus(application.id, status);
      showToast({ type: "success", title: "Đã cập nhật trạng thái ứng tuyển", message: APPLICATION_STATUS_LABELS[status] });
      setSelectedApplication(null);
      onReload();
    } catch (updateError) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(updateError) });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "pipeline" ? "Pipeline ứng tuyển" : "Ứng viên ứng tuyển"}
        description="Dữ liệu lấy từ application API của các tin tuyển dụng thuộc công ty hiện tại."
      />
      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_160px_160px_auto]">
          <Input label="Tìm kiếm" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên, email, CV..." />
          <Select label="Tin tuyển dụng" value={jobFilter} onChange={(event) => { setJobFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((job) => ({ label: job, value: job }))]} />
          <Select label="Trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Input label="Từ ngày" type="date" value={appliedFrom} onChange={(event) => { setAppliedFrom(event.target.value); setPage(1); }} />
          <Input label="Đến ngày" type="date" value={appliedTo} onChange={(event) => { setAppliedTo(event.target.value); setPage(1); }} />
          <div className="flex items-end gap-2">
            <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={onReload}>Tải lại</Button>
          </div>
        </div>
      </Card>

      {mode === "pipeline" ? <PipelineSummary applications={filteredApplications} /> : null}

      <Card className="mt-5">
        <SectionHeader title="Danh sách ứng viên" description={`${filteredApplications.length} hồ sơ ứng tuyển`} />
        {loading ? <LoadingState /> : null}
        {!loading && error ? <EmptyState message={error} /> : null}
        {!loading && !error && pagedApplications.length === 0 ? <EmptyState message="Không có hồ sơ ứng tuyển phù hợp." /> : null}
        {!loading && pagedApplications.length > 0 ? (
          <div className="space-y-4">
            <Table
              rows={pagedApplications}
              getRowKey={(application) => String(application.id)}
              columns={[
                { key: "candidate", header: "Ứng viên", render: (application) => <CandidateCell application={application} /> },
                { key: "job", header: "Tin ứng tuyển", render: (application) => <div><p className="font-medium text-slate-900">{application.jobTitle}</p><p className="text-xs text-slate-500">{formatDateTime(application.appliedAt)}</p></div> },
                { key: "cv", header: "CV", render: (application) => application.cvFileName ? <StatusBadge label={application.cvFileName} /> : "Chưa có CV" },
                { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} /> },
                { key: "actions", header: "Thao tác", render: (application) => <ApplicationActions application={application} onOpenStatus={(target) => { setSelectedApplication(target); setNextStatus(target.status === "PENDING" ? "REVIEWED" : target.status); }} /> },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </Card>

      <StatusModal
        application={selectedApplication}
        nextStatus={nextStatus}
        setNextStatus={setNextStatus}
        loading={updating}
        onClose={() => setSelectedApplication(null)}
        onConfirm={() => selectedApplication ? void changeStatus(selectedApplication, nextStatus) : undefined}
      />
    </PageContainer>
  );
}

function ApplicationDetailPage({
  applicationId,
  applications,
  loading,
  error,
  onReload,
}: {
  applicationId: number;
  applications: ApplicationResponse[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  const { showToast } = useToast();
  const application = applications.find((item) => item.id === applicationId);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [updating, setUpdating] = useState(false);

  async function changeStatus() {
    if (!application) return;
    setUpdating(true);
    try {
      await updateApplicationStatus(application.id, nextStatus);
      showToast({ type: "success", title: "Đã cập nhật trạng thái ứng tuyển", message: APPLICATION_STATUS_LABELS[nextStatus] });
      onReload();
    } catch (updateError) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(updateError) });
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (error || !application) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết ứng viên" description="Không thể tải dữ liệu ứng tuyển từ backend." />
        <EmptyState message={error ?? "Không tìm thấy hồ sơ ứng tuyển."} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={application.studentName || "Ứng viên"} description={`${application.jobTitle} • ${formatDateTime(application.appliedAt)}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        <Button variant="secondary" icon={<Mail size={16} />} onClick={() => unsupportedToast(showToast, "Gửi email/nhắn tin")}>Liên hệ</Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin ứng tuyển" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <InfoRow label="Ứng viên" value={application.studentName} />
              <InfoRow label="Email" value={application.studentEmail} />
              <InfoRow label="Tin tuyển dụng" value={application.jobTitle} />
              <InfoRow label="Công ty" value={application.companyName} />
              <InfoRow label="Ngày ứng tuyển" value={formatDateTime(application.appliedAt)} />
              <InfoRow label="Ngày xem xét" value={formatDateTime(application.reviewedAt)} />
            </div>
          </Card>
          <Card>
            <SectionHeader title="Thư giới thiệu" />
            {application.coverLetter ? <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{application.coverLetter}</p> : <EmptyState message="Ứng viên chưa nhập thư giới thiệu." />}
          </Card>
          <Card>
            <SectionHeader title="CV ứng tuyển" />
            {application.cvFileName ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <FileText className="text-brand-600" size={20} />
                  <div>
                    <p className="font-medium text-slate-900">{application.cvFileName}</p>
                    <p className="text-xs text-slate-500">CV file ID: {application.cvFileId}</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => unsupportedToast(showToast, "Tải/xem file CV")}>Xem CV</Button>
              </div>
            ) : <EmptyState message="Hồ sơ ứng tuyển chưa có CV." />}
          </Card>
          <UnsupportedCard title="Đánh giá & hoạt động" items={["Match score", "Tag", "Ghi chú nội bộ", "Lịch phỏng vấn", "Lịch sử hoạt động"]} />
        </div>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái ứng tuyển" />
            <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} />
            <div className="mt-4 grid gap-3">
              <Select label="Chuyển trạng thái" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
              <Button loading={updating} onClick={() => void changeStatus()}>Cập nhật trạng thái</Button>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function PipelineSummary({ applications }: { applications: ApplicationResponse[] }) {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-5">
      {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((status) => (
        <Card key={status}>
          <p className="text-sm text-slate-500">{APPLICATION_STATUS_LABELS[status]}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{applications.filter((application) => application.status === status).length}</p>
        </Card>
      ))}
    </div>
  );
}

function CandidateCell({ application }: { application: ApplicationResponse }) {
  const name = application.studentName || application.studentEmail || "Ứng viên";
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} />
      <div>
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{application.studentEmail || "Chưa có email"}</p>
      </div>
    </div>
  );
}

function ApplicationActions({ application, onOpenStatus }: { application: ApplicationResponse; onOpenStatus: (application: ApplicationResponse) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/recruiter/candidates/${application.id}`}><Button variant="secondary" size="sm" icon={<Search size={14} />}>Chi tiết</Button></Link>
      <Button variant="secondary" size="sm" icon={<UserCheck size={14} />} onClick={() => onOpenStatus(application)}>Trạng thái</Button>
    </div>
  );
}

function StatusModal({
  application,
  nextStatus,
  setNextStatus,
  loading,
  onClose,
  onConfirm,
}: {
  application: ApplicationResponse | null;
  nextStatus: ApplicationStatus;
  setNextStatus: (status: ApplicationStatus) => void;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={Boolean(application)} title="Cập nhật trạng thái ứng tuyển" onClose={onClose}>
      {application ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Ứng viên <strong>{application.studentName || application.studentEmail}</strong> ứng tuyển vị trí <strong>{application.jobTitle}</strong>.
          </p>
          <Select label="Trạng thái mới" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Hủy</Button>
            <Button loading={loading} onClick={onConfirm}>Cập nhật</Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function UnsupportedCandidateMode({ mode }: { mode: "recommended" | "saved" | "search" }) {
  const title = {
    recommended: "Ứng viên gợi ý",
    saved: "Ứng viên đã lưu",
    search: "Tìm kiếm ứng viên",
  }[mode];

  return (
    <PageContainer>
      <PageHeader title={title} description="Backend hiện chưa có API riêng cho chức năng này." />
      <Card>
        <EmptyState message="Chức năng này chưa có endpoint backend nên không hiển thị dữ liệu mock." />
        <div className="mt-4">
          <Link to="/recruiter/candidates"><Button>Quay lại ứng viên ứng tuyển</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}

function UnsupportedCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <SectionHeader title={title} description="Backend hiện chưa có API cho các dữ liệu này." />
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <StatusBadge key={item} label={item} />)}
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <strong className="text-right font-medium text-slate-900">{value || "Chưa cập nhật"}</strong>
    </div>
  );
}

async function getCompanyApplications() {
  const jobsResponse = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page: 1, size: 100 },
  });
  const jobs = jobsResponse.data.data.items;
  const applicationResponses = await Promise.all(
    jobs.map((job) => httpClient.get<ApiResponse<ApplicationResponse[]>>(`/companies/me/jobs/${job.id}/applications`)),
  );
  return applicationResponses
    .flatMap((response) => response.data.data)
    .sort((left, right) => new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime());
}

async function updateApplicationStatus(applicationId: number, status: ApplicationStatus) {
  const response = await httpClient.patch<ApiResponse<ApplicationResponse>>(`/applications/${applicationId}/status`, { status });
  return response.data.data;
}

function applicationStatusTone(status: ApplicationStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger" as const;
  if (status === "REVIEWED") return "warning" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function unsupportedToast(showToast: ReturnType<typeof useToast>["showToast"], feature: string) {
  showToast({
    type: "info",
    title: "Chức năng chưa có API backend",
    message: `${feature} hiện chưa có endpoint để xử lý dữ liệu thật.`,
  });
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
