import { BookmarkCheck, BookmarkPlus, FileText, Mail, Search, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";
import { getApiErrorMessage } from "../../utils/apiErrors";

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

interface JobResponse {
  id: number;
  companyId: number;
  title: string;
}

interface CompanyResponse {
  id: number;
}

interface SavedCandidateResponse {
  id: number;
  applicationId: number;
  studentId: number;
  studentName: string | null;
  studentEmail: string | null;
  university: string | null;
  major: string | null;
  headline: string | null;
  jobId: number;
  jobTitle: string;
  cvFileId: number | null;
  cvFileName: string | null;
  note: string | null;
  savedAt: string;
  updatedAt: string;
}

interface ApplicationListQuery {
  page: number;
  size: number;
  keyword: string;
  status: string;
  jobId: string;
  appliedFrom: string;
  appliedTo: string;
  sort: string;
  jobIds: number[];
}

type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: "Chờ xử lý",
  REVIEWED: "Đã xem",
  ACCEPTED: "Đã nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Ứng viên rút đơn",
};

export function RecruiterCandidatesPage({ mode = "list" }: RecruiterCandidatesPageProps) {
  const { candidateId } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const jobsQuery = useAsyncData(() => getCompanyJobs(), []);

  if (mode === "saved") {
    return <SavedCandidatesPage />;
  }

  if (mode === "recommended" || mode === "search") {
    return <UnsupportedCandidateMode mode={mode} />;
  }

  if ((mode === "detail" || mode === "evaluation") && candidateId) {
    return (
      <ApplicationDetailPage
        applicationId={Number(candidateId)}
        reloadKey={reloadKey}
        onReload={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  return (
    <ApplicationsListPage
      mode={mode}
      jobs={jobsQuery.data ?? []}
      jobsLoading={jobsQuery.loading}
      showToast={showToast}
    />
  );
}

function ApplicationsListPage({
  mode,
  jobs,
  jobsLoading,
  showToast,
}: {
  mode: RecruiterCandidatesPageProps["mode"];
  jobs: JobResponse[];
  jobsLoading: boolean;
  showToast: ReturnType<typeof useToast>["showToast"];
}) {
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationResponse | null>(null);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [updating, setUpdating] = useState(false);
  const [sortOrder, setSortOrder] = useState("appliedAt,desc");
  const [savedReloadKey, setSavedReloadKey] = useState(0);

  const jobOptions = useMemo(() => jobs.slice().sort((left, right) => left.title.localeCompare(right.title)), [jobs]);
  const applicationsQuery = useAsyncData(() => getCompanyApplicationsPage({
    page,
    size: 8,
    keyword: query,
    status: statusFilter,
    jobId: jobFilter,
    appliedFrom: "",
    appliedTo: "",
    sort: sortOrder,
    jobIds: [],
  }), [page, query, statusFilter, jobFilter, sortOrder, reloadKey]);
  const applicationsPage = applicationsQuery.data;
  const applications = useMemo(() => applicationsPage?.items ?? [], [applicationsPage?.items]);
  const savedCandidatesQuery = useAsyncData(() => getAllSavedCandidates(), [savedReloadKey]);
  const savedStudentIds = new Set((savedCandidatesQuery.data ?? []).map((candidate) => candidate.studentId));
  const filteredApplications = applications;

  async function changeStatus(application: ApplicationResponse, status: ApplicationStatus) {
    if (!canChangeApplicationStatus(application.status, status)) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: "Trạng thái này không được phép chuyển theo quy trình hiện tại." });
      return;
    }

    setUpdating(true);
    try {
      await updateApplicationStatus(application.id, status);
      showToast({ type: "success", title: "Đã cập nhật trạng thái ứng tuyển", message: APPLICATION_STATUS_LABELS[status] });
      setSelectedApplication(null);
      setReloadKey((current) => current + 1);
    } catch (updateError) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getApiErrorMessage(updateError) });
    } finally {
      setUpdating(false);
    }
  }

  async function saveCandidate(application: ApplicationResponse) {
    try {
      await saveCandidateByApplication(application.id);
      setSavedReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: application.studentName || application.studentEmail || application.jobTitle });
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu hồ sơ ứng viên", message: getApiErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "pipeline" ? "Pipeline ứng tuyển" : "Ứng viên ứng tuyển"}
        description="Theo dõi hồ sơ ứng tuyển theo tin tuyển dụng và trạng thái xử lý."
      />
      <Card>
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Tìm kiếm" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên, email, vị trí..." />
          <Select label="Vị trí tuyển dụng" value={jobFilter} disabled={jobsLoading} onChange={(event) => { setJobFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((job) => ({ label: job.title, value: String(job.id) }))]} />
          <Input label="Từ ngày" type="date" value="" onChange={() => undefined} disabled />
          <Input label="Đến ngày" type="date" value="" onChange={() => undefined} disabled />
          <div className="grid items-start gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
            <Select label="Trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
            <Select label="Sắp xếp" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1); }} options={[{ label: "Mới nhất", value: "appliedAt,desc" }, { label: "Cũ nhất", value: "appliedAt,asc" }]} />
            <div className="flex items-end pt-6">
              <Button className="w-full" icon={<Search size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tìm kiếm</Button>
            </div>
          </div>
        </div>
      </Card>

      {mode === "pipeline" ? <PipelineSummary applications={filteredApplications} /> : null}

      <Card className="mt-5">
        <SectionHeader title="Danh sách ứng viên" description={`${applicationsPage?.totalItems ?? 0} hồ sơ ứng tuyển`} />
        <p className="mb-4 text-sm text-amber-700">Bộ lọc ngày chưa được hỗ trợ nên đang tạm khóa để tránh hiển thị thiếu dữ liệu.</p>
        {applicationsQuery.loading ? <LoadingState /> : null}
        {!applicationsQuery.loading && applicationsQuery.error ? <EmptyState message={applicationsQuery.error} /> : null}
        {!applicationsQuery.loading && !applicationsQuery.error && filteredApplications.length === 0 ? <EmptyState message="Không có hồ sơ ứng tuyển phù hợp." /> : null}
        {!applicationsQuery.loading && filteredApplications.length > 0 ? (
          <div className="space-y-4">
            <Table
              rows={filteredApplications}
              getRowKey={(application) => String(application.id)}
              columns={[
                { key: "candidate", header: "Ứng viên", render: (application) => <CandidateCell application={application} /> },
                { key: "job", header: "Tin ứng tuyển", render: (application) => <div><p className="font-medium text-slate-900">{application.jobTitle}</p><p className="text-xs text-slate-500">{formatDateTime(application.appliedAt)}</p></div> },
                { key: "cv", header: "CV", render: (application) => application.cvFileName ? <StatusBadge label={application.cvFileName} /> : "Chưa có CV" },
                { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} /> },
                { key: "actions", header: "Thao tác", render: (application) => <ApplicationActions application={application} saved={savedStudentIds.has(application.studentId)} onSave={(target) => void saveCandidate(target)} onOpenStatus={(target) => { setSelectedApplication(target); setNextStatus(getDefaultNextStatus(target.status)); }} /> },
              ]}
            />
            <Pagination page={applicationsPage?.page ?? page} totalPages={applicationsPage?.totalPages ?? 1} onPageChange={setPage} />
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
  reloadKey,
  onReload,
}: {
  applicationId: number;
  reloadKey: number;
  onReload: () => void;
}) {
  const { showToast } = useToast();
  const applicationQuery = useAsyncData(() => getCompanyApplicationDetail(applicationId), [applicationId, reloadKey]);
  const application = applicationQuery.data;
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [updating, setUpdating] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const savedCandidatesQuery = useAsyncData(() => getAllSavedCandidates(), [savedReloadKey]);
  const savedStudentIds = new Set((savedCandidatesQuery.data ?? []).map((candidate) => candidate.studentId));

  useEffect(() => {
    if (application) setNextStatus(getDefaultNextStatus(application.status));
  }, [application]);

  async function changeStatus() {
    if (!application) return;
    if (!canChangeApplicationStatus(application.status, nextStatus)) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: "Trạng thái này không được phép chuyển theo quy trình hiện tại." });
      return;
    }

    setUpdating(true);
    try {
      await updateApplicationStatus(application.id, nextStatus);
      showToast({ type: "success", title: "Đã cập nhật trạng thái ứng tuyển", message: APPLICATION_STATUS_LABELS[nextStatus] });
      onReload();
    } catch (updateError) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getApiErrorMessage(updateError) });
    } finally {
      setUpdating(false);
    }
  }

  async function saveCandidate(application: ApplicationResponse) {
    try {
      await saveCandidateByApplication(application.id);
      setSavedReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: application.studentName || application.studentEmail || application.jobTitle });
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu hồ sơ ứng viên", message: getApiErrorMessage(error) });
    }
  }

  if (applicationQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (applicationQuery.error || !application) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết ứng viên" description="Không thể tải dữ liệu ứng tuyển." />
        <EmptyState message={applicationQuery.error ?? "Không tìm thấy hồ sơ ứng tuyển."} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={application.studentName || "Ứng viên"} description={`${application.jobTitle} · ${formatDateTime(application.appliedAt)}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        <Button variant="secondary" disabled={savedStudentIds.has(application.studentId)} icon={savedStudentIds.has(application.studentId) ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />} onClick={() => void saveCandidate(application)}>
          {savedStudentIds.has(application.studentId) ? "Đã lưu ứng viên" : "Lưu hồ sơ"}
        </Button>
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
                <Button variant="secondary" onClick={() => void openApplicationCv(application, showToast)}>Xem CV</Button>
              </div>
            ) : <EmptyState message="Hồ sơ ứng tuyển chưa có CV." />}
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái ứng tuyển" />
            <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} />
            <div className="mt-4 grid gap-3">
              <Select label="Chuyển trạng thái" value={nextStatus} disabled={!hasAllowedStatusTransition(application.status)} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={getAllowedStatusOptions(application.status)} />
              <Button loading={updating} disabled={!hasAllowedStatusTransition(application.status)} onClick={() => void changeStatus()}>Cập nhật trạng thái</Button>
              {!hasAllowedStatusTransition(application.status) ? <p className="text-xs text-slate-500">Trạng thái hiện tại không còn bước chuyển hợp lệ cho nhà tuyển dụng.</p> : null}
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

function SavedCandidatesPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const savedCandidatesQuery = useAsyncData(() => getSavedCandidatesPage(page), [page, reloadKey]);
  const result = savedCandidatesQuery.data;
  const savedCandidates = result?.items ?? [];

  async function removeSavedCandidate(savedCandidateId: number) {
    try {
      await deleteSavedCandidate(savedCandidateId);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã bỏ lưu hồ sơ ứng viên" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể bỏ lưu hồ sơ", message: getApiErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Hồ sơ đã lưu" description="Danh sách hồ sơ ứng viên đã lưu." />
      <Card>
        <SectionHeader title="Danh sách hồ sơ" description={`${result?.totalItems ?? 0} hồ sơ đã lưu`} />
        {savedCandidatesQuery.loading ? <LoadingState /> : null}
        {savedCandidatesQuery.error ? <EmptyState message={savedCandidatesQuery.error} /> : null}
        {!savedCandidatesQuery.loading && !savedCandidatesQuery.error && savedCandidates.length === 0 ? <EmptyState message="Chưa có hồ sơ ứng viên nào được lưu." /> : null}
        {savedCandidates.length > 0 ? (
          <Table
            rows={savedCandidates}
            getRowKey={(candidate) => String(candidate.id)}
            columns={[
              { key: "candidate", header: "Ứng viên", render: (candidate) => <SavedCandidateCell candidate={candidate} /> },
              { key: "job", header: "Tin ứng tuyển", render: (candidate) => <div><p className="font-medium text-slate-900">{candidate.jobTitle}</p><p className="text-xs text-slate-500">{formatDateTime(candidate.savedAt)}</p></div> },
              { key: "cv", header: "CV", render: (candidate) => candidate.cvFileName ? <StatusBadge label={candidate.cvFileName} /> : "Chưa có CV" },
              {
                key: "actions",
                header: "Thao tác",
                render: (candidate) => (
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/recruiter/candidates/${candidate.applicationId}`}><Button variant="secondary" size="sm" icon={<Search size={14} />}>Chi tiết</Button></Link>
                    <Button variant="secondary" size="sm" onClick={() => void removeSavedCandidate(candidate.id)}>Bỏ lưu</Button>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
        <Pagination page={result?.page ?? page} totalPages={result?.totalPages ?? 1} onPageChange={setPage} />
      </Card>
    </PageContainer>
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

function SavedCandidateCell({ candidate }: { candidate: SavedCandidateResponse }) {
  const name = candidate.studentName || candidate.studentEmail || "Ứng viên";
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} />
      <div>
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{candidate.studentEmail || "Chưa có email"}</p>
        {candidate.headline ? <p className="text-xs text-slate-500">{candidate.headline}</p> : null}
      </div>
    </div>
  );
}

function ApplicationActions({
  application,
  saved,
  onSave,
  onOpenStatus,
}: {
  application: ApplicationResponse;
  saved: boolean;
  onSave: (application: ApplicationResponse) => void;
  onOpenStatus: (application: ApplicationResponse) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/recruiter/candidates/${application.id}`}><Button variant="secondary" size="sm" icon={<Search size={14} />}>Chi tiết</Button></Link>
      <Button variant="secondary" size="sm" disabled={saved} icon={saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />} onClick={() => onSave(application)}>
        {saved ? "Đã lưu ứng viên" : "Lưu hồ sơ"}
      </Button>
      <Button variant="secondary" size="sm" icon={<UserCheck size={14} />} disabled={!hasAllowedStatusTransition(application.status)} onClick={() => onOpenStatus(application)}>Trạng thái</Button>
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
          <Select label="Trạng thái mới" value={nextStatus} disabled={!hasAllowedStatusTransition(application.status)} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={getAllowedStatusOptions(application.status)} />
          {!hasAllowedStatusTransition(application.status) ? <p className="text-xs text-slate-500">Trạng thái hiện tại không còn bước chuyển hợp lệ cho nhà tuyển dụng.</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Hủy</Button>
            <Button loading={loading} disabled={!hasAllowedStatusTransition(application.status)} onClick={onConfirm}>Cập nhật</Button>
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
      <PageHeader title={title} description="Chức năng đang chờ dữ liệu phù hợp." />
      <Card>
        <EmptyState message="Chưa có dữ liệu phù hợp." />
        <div className="mt-4">
          <Link to="/recruiter/candidates"><Button>Quay lại ứng viên ứng tuyển</Button></Link>
        </div>
      </Card>
    </PageContainer>
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

async function getCompanyApplicationsPage(query: ApplicationListQuery) {
  try {
    const response = await httpClient.get<ApiResponse<PageResponse<ApplicationResponse>>>("/companies/me/applications", {
      params: {
        page: query.page,
        size: query.size,
        keyword: query.keyword.trim() || undefined,
        status: query.status || undefined,
        jobId: query.jobId || undefined,
        sort: query.sort,
      },
    });
    const page = response.data.data;
    const sortedItems = sortApplicationsForRecruiter(page.items, query.sort);
    return { ...page, items: sortedItems };
  } catch {
    throw new Error("Không thể tải danh sách ứng viên ứng tuyển.");
  }
}

async function getCompanyApplicationDetail(applicationId: number) {
  const response = await httpClient.get<ApiResponse<ApplicationResponse>>(`/companies/me/applications/${applicationId}`);
  return response.data.data;
}

async function getSavedCandidatesPage(page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<SavedCandidateResponse>>>("/companies/me/saved-candidates", {
    params: { page, size: 10, sort: "createdAt,desc" },
  });
  return response.data.data;
}

async function getAllSavedCandidates(page = 1, items: SavedCandidateResponse[] = []): Promise<SavedCandidateResponse[]> {
  const response = await httpClient.get<ApiResponse<PageResponse<SavedCandidateResponse>>>("/companies/me/saved-candidates", {
    params: { page, size: 100, sort: "createdAt,desc" },
  });
  const data = response.data.data;
  const nextItems = [...items, ...data.items];
  if (data.page < data.totalPages) return getAllSavedCandidates(page + 1, nextItems);
  return nextItems;
}

async function saveCandidateByApplication(applicationId: number) {
  const response = await httpClient.post<ApiResponse<SavedCandidateResponse>>("/companies/me/saved-candidates", {
    applicationId,
    note: null,
  });
  return response.data.data;
}

async function deleteSavedCandidate(savedCandidateId: number) {
  await httpClient.delete<ApiResponse<null>>(`/companies/me/saved-candidates/${savedCandidateId}`);
}

async function getCompanyJobs() {
  const [companyResponse, jobsResponse] = await Promise.all([
    httpClient.get<ApiResponse<CompanyResponse>>("/companies/me"),
    httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
      params: { page: 1, size: 100 },
    }),
  ]);
  const companyId = companyResponse.data.data.id;
  return jobsResponse.data.data.items.filter((job) => job.companyId === companyId);
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

function getAllowedStatusOptions(currentStatus: ApplicationStatus) {
  return getAllowedNextStatuses(currentStatus).map((status) => ({
    value: status,
    label: APPLICATION_STATUS_LABELS[status],
  }));
}

function getAllowedNextStatuses(currentStatus: ApplicationStatus): ApplicationStatus[] {
  if (currentStatus === "PENDING") return ["REVIEWED", "ACCEPTED", "REJECTED"];
  if (currentStatus === "REVIEWED") return ["ACCEPTED", "REJECTED"];
  return [];
}

function getDefaultNextStatus(currentStatus: ApplicationStatus): ApplicationStatus {
  if (currentStatus === "PENDING") return "REVIEWED";
  return getAllowedNextStatuses(currentStatus)[0] ?? currentStatus;
}

function canChangeApplicationStatus(currentStatus: ApplicationStatus, nextStatus: ApplicationStatus) {
  return getAllowedNextStatuses(currentStatus).includes(nextStatus);
}

function hasAllowedStatusTransition(currentStatus: ApplicationStatus) {
  return getAllowedNextStatuses(currentStatus).length > 0;
}

function sortApplicationsForRecruiter(applications: ApplicationResponse[], sort: string) {
  const direction = sort.endsWith(",asc") ? 1 : -1;
  return applications.slice().sort((left, right) => {
    if (left.status === "ACCEPTED" && right.status !== "ACCEPTED") return 1;
    if (left.status !== "ACCEPTED" && right.status === "ACCEPTED") return -1;
    return (new Date(left.appliedAt).getTime() - new Date(right.appliedAt).getTime()) * direction;
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function openApplicationCv(application: ApplicationResponse, showToast: ReturnType<typeof useToast>["showToast"]) {
  if (!application.cvFileId) {
    showToast({
      type: "info",
      title: "Chưa có CV đính kèm",
      message: "Đơn ứng tuyển này chưa có CV để mở.",
    });
    return;
  }

  try {
    const response = await httpClient.get<Blob>(`/companies/me/applications/${application.id}/cv/file`, {
      responseType: "blob",
    });
    const blobUrl = window.URL.createObjectURL(response.data);
    window.open(blobUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    showToast({
      type: "error",
      title: "Không thể mở CV",
      message: getApiErrorMessage(error),
    });
  }
}

function unsupportedToast(showToast: ReturnType<typeof useToast>["showToast"], feature: string) {
  showToast({
    type: "info",
    title: "Chức năng chưa sẵn sàng",
    message: `${feature} hiện chưa thể xử lý.`,
  });
}
