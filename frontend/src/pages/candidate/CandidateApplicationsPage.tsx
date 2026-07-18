import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
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

type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

const pageSize = 5;

const statusOptions: Array<{ label: string; value: "" | ApplicationStatus }> = [
  { label: "Tất cả", value: "" },
  { label: "Đang chờ", value: "PENDING" },
  { label: "Đã xem", value: "REVIEWED" },
  { label: "Đã chấp nhận", value: "ACCEPTED" },
  { label: "Bị từ chối", value: "REJECTED" },
  { label: "Đã rút", value: "WITHDRAWN" },
];

export function CandidateApplicationsPage({ mode = "list" }: { mode?: "list" | "detail" | "status" }) {
  const { applicationId } = useParams();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [withdrawTarget, setWithdrawTarget] = useState<ApplicationResponse | null>(null);

  const applicationsQuery = useAsyncData(() => getMyApplications(), [reloadKey]);
  const applications = applicationsQuery.data ?? [];
  const selectedApplication = applicationId ? applications.find((application) => String(application.id) === applicationId) : applications[0];

  const filteredApplications = useMemo(() => {
    return applications
      .filter((application) => {
        const appliedDate = application.appliedAt.slice(0, 10);
        const matchQuery = !query || `${application.jobTitle} ${application.companyName}`.toLowerCase().includes(query.toLowerCase());
        const matchStatus = !status || application.status === status;
        const matchFrom = !dateFrom || appliedDate >= dateFrom;
        const matchTo = !dateTo || appliedDate <= dateTo;
        return matchQuery && matchStatus && matchFrom && matchTo;
      })
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  }, [applications, dateFrom, dateTo, query, status]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const pagedApplications = filteredApplications.slice((page - 1) * pageSize, page * pageSize);

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
  }

  async function withdrawApplication(application: ApplicationResponse) {
    await updateApplicationStatus(application.id, "WITHDRAWN");
    setWithdrawTarget(null);
    setReloadKey((current) => current + 1);
    showToast({ type: "success", title: "Đã rút hồ sơ", message: "Trạng thái đơn ứng tuyển đã được cập nhật lên backend." });
  }

  if (applicationsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (applicationsQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={applicationsQuery.error} />
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "status") && !selectedApplication) {
    return (
      <PageContainer>
        <PageHeader title="Không tìm thấy đơn ứng tuyển" description="Mã ứng tuyển không tồn tại trong dữ liệu backend hiện tại." />
        <Card>
          <EmptyState message="Không tìm thấy đơn ứng tuyển." />
          <div className="mt-4 flex justify-center">
            <Link to="/candidate/applications"><Button>Quay lại lịch sử ứng tuyển</Button></Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "status") && selectedApplication) {
    return (
      <PageContainer>
        <ApplicationDetail application={selectedApplication} onWithdraw={() => setWithdrawTarget(selectedApplication)} />
        <WithdrawApplicationModal application={withdrawTarget} onClose={() => setWithdrawTarget(null)} onConfirm={withdrawApplication} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Lịch sử ứng tuyển" description="Theo dõi các đơn ứng tuyển của ứng viên từ API backend." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Từ khóa" value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} placeholder="Tên việc làm, công ty..." />
          <Select label="Trạng thái" value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value as ApplicationStatus | ""))} options={statusOptions} />
          <Input label="Từ ngày" type="date" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} />
          <Input label="Đến ngày" type="date" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} />
        </div>
      </Card>

      {pagedApplications.length === 0 ? (
        <Card>
          <EmptyState message="Chưa có đơn ứng tuyển." />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/candidate/jobs"><Button>Tìm việc</Button></Link>
            <Link to="/candidate/jobs/recommended"><Button variant="secondary">Xem việc làm gợi ý</Button></Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {pagedApplications.map((application) => (
              <ApplicationCard key={application.id} application={application} onWithdraw={() => setWithdrawTarget(application)} />
            ))}
          </div>
          <div className="mt-5">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <WithdrawApplicationModal application={withdrawTarget} onClose={() => setWithdrawTarget(null)} onConfirm={withdrawApplication} />
    </PageContainer>
  );
}

function ApplicationCard({ application, onWithdraw }: { application: ApplicationResponse; onWithdraw: () => void }) {
  const status = getStatusMeta(application.status);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={status.label} tone={status.tone} />
            <StatusBadge label={`Mã ${application.id}`} />
          </div>
          <h2 className="mt-3 font-semibold text-slate-950">{application.jobTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{application.companyName}</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>Ngày ứng tuyển: <strong>{formatDateTime(application.appliedAt)}</strong></p>
            <p>CV đã dùng: <strong>{application.cvFileName || "Không chọn CV"}</strong></p>
            <p>Cập nhật cuối: <strong>{formatDateTime(application.updatedAt)}</strong></p>
            <p>Ngày xem xét: <strong>{application.reviewedAt ? formatDateTime(application.reviewedAt) : "Chưa có"}</strong></p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link to={`/candidate/applications/${application.id}`}><Button variant="secondary" size="sm">Xem chi tiết</Button></Link>
          <Link to={`/candidate/applications/${application.id}/status`}><Button variant="secondary" size="sm">Xem trạng thái</Button></Link>
          <Link to={`/candidate/jobs/${application.jobId}`}><Button variant="secondary" size="sm">Xem việc làm</Button></Link>
          {canWithdraw(application.status) ? <Button variant="danger" size="sm" onClick={onWithdraw}>Rút hồ sơ</Button> : null}
        </div>
      </div>
    </Card>
  );
}

function ApplicationDetail({ application, onWithdraw }: { application: ApplicationResponse; onWithdraw: () => void }) {
  const status = getStatusMeta(application.status);

  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">{application.jobTitle}</h1>
            <p className="mt-1 text-sm text-slate-600">{application.companyName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge label={status.label} tone={status.tone} />
              <StatusBadge label={`Mã ${application.id}`} />
              <StatusBadge label={`Ứng tuyển ${formatDateTime(application.appliedAt)}`} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/candidate/jobs/${application.jobId}`}><Button variant="secondary">Xem việc làm</Button></Link>
            {application.cvFileId ? <Link to={`/candidate/cvs/${application.cvFileId}`}><Button variant="secondary">Xem CV</Button></Link> : null}
            {canWithdraw(application.status) ? <Button variant="danger" onClick={onWithdraw}>Rút hồ sơ</Button> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin đơn ứng tuyển" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <SummaryItem label="Ứng viên" value={application.studentName} />
              <SummaryItem label="Email" value={application.studentEmail} />
              <SummaryItem label="Công việc" value={application.jobTitle} />
              <SummaryItem label="Công ty" value={application.companyName} />
              <SummaryItem label="CV" value={application.cvFileName || "Không chọn CV"} />
              <SummaryItem label="Trạng thái" value={status.label} />
              <SummaryItem label="Ngày ứng tuyển" value={formatDateTime(application.appliedAt)} />
              <SummaryItem label="Cập nhật cuối" value={formatDateTime(application.updatedAt)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Thư giới thiệu" />
            <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{application.coverLetter || "Không có thư giới thiệu."}</p>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái" />
            <div className="space-y-3 text-sm text-slate-700">
              <SummaryItem label="Hiện tại" value={status.label} />
              <SummaryItem label="Ngày review" value={application.reviewedAt ? formatDateTime(application.reviewedAt) : "Chưa có"} />
              <SummaryItem label="Bước tiếp theo" value={getNextStep(application.status)} />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

function WithdrawApplicationModal({
  application,
  onClose,
  onConfirm,
}: {
  application: ApplicationResponse | null;
  onClose: () => void;
  onConfirm: (application: ApplicationResponse) => void;
}) {
  return (
    <Modal open={Boolean(application)} title="Rút hồ sơ ứng tuyển" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Bạn có chắc muốn rút hồ sơ ứng tuyển vị trí <strong>{application?.jobTitle}</strong> tại <strong>{application?.companyName}</strong>?
        </p>
        <p className="text-sm text-slate-500">Backend hiện chỉ hỗ trợ cập nhật trạng thái sang WITHDRAWN, chưa có trường lưu lý do rút hồ sơ.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => application && onConfirm(application)}>Rút hồ sơ</Button>
        </div>
      </div>
    </Modal>
  );
}

async function getMyApplications() {
  const response = await httpClient.get<ApiResponse<ApplicationResponse[]>>("/students/me/applications");
  return response.data.data;
}

async function updateApplicationStatus(applicationId: number, status: ApplicationStatus) {
  const response = await httpClient.patch<ApiResponse<ApplicationResponse>>(`/applications/${applicationId}/status`, { status });
  return response.data.data;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function getStatusMeta(status: ApplicationStatus): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (status === "PENDING") return { label: "Đang chờ", tone: "warning" };
  if (status === "REVIEWED") return { label: "Đã xem", tone: "neutral" };
  if (status === "ACCEPTED") return { label: "Đã chấp nhận", tone: "success" };
  if (status === "REJECTED") return { label: "Bị từ chối", tone: "danger" };
  return { label: "Đã rút", tone: "neutral" };
}

function canWithdraw(status: ApplicationStatus) {
  return status === "PENDING";
}

function getNextStep(status: ApplicationStatus) {
  if (status === "PENDING") return "Chờ nhà tuyển dụng xem hồ sơ";
  if (status === "REVIEWED") return "Chờ kết quả từ nhà tuyển dụng";
  if (status === "ACCEPTED") return "Nhà tuyển dụng đã chấp nhận hồ sơ";
  if (status === "REJECTED") return "Đơn ứng tuyển đã bị từ chối";
  return "Hồ sơ đã được rút";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
