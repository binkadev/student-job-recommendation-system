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
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";
import { getStorageItem, setStorageItem } from "../../utils/localStorage";

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
  cvFileUrl?: string | null;
  cvFilePath?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
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

interface ApplicationListQuery {
  page: number;
  size: number;
  keyword: string;
  status: string;
  jobId: string;
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

const SAVED_CANDIDATES_STORAGE_KEY = "recruiter-saved-candidates";

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
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationResponse | null>(null);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [updating, setUpdating] = useState(false);
  const [savedIds, setSavedIds] = useState(() => new Set(readSavedCandidates().map((application) => application.id)));
  const [sortOrder, setSortOrder] = useState("appliedAt,desc");

  const dateRangeError = appliedFrom && appliedTo && appliedFrom > appliedTo ? "Từ ngày phải nhỏ hơn hoặc bằng đến ngày." : "";
  const jobOptions = useMemo(() => jobs.slice().sort((left, right) => left.title.localeCompare(right.title)), [jobs]);
  const jobIdsKey = useMemo(() => jobs.map((job) => job.id).sort((left, right) => left - right).join(","), [jobs]);
  const applicationsQuery = useAsyncData(() => getCompanyApplicationsPage({
    page,
    size: 8,
    keyword: query,
    status: statusFilter,
    jobId: jobFilter,
    sort: sortOrder,
    jobIds: jobs.map((job) => job.id),
  }), [page, query, statusFilter, jobFilter, sortOrder, jobIdsKey, reloadKey]);
  const applicationsPage = applicationsQuery.data;
  const applications = applicationsPage?.items ?? [];
  const filteredApplications = useMemo(() => {
    if (dateRangeError) return [];
    return applications.filter((application) => {
      const appliedDate = application.appliedAt.slice(0, 10);
      const matchFrom = !appliedFrom || appliedDate >= appliedFrom;
      const matchTo = !appliedTo || appliedDate <= appliedTo;
      return matchFrom && matchTo;
    });
  }, [applications, appliedFrom, appliedTo, dateRangeError]);

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
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(updateError) });
    } finally {
      setUpdating(false);
    }
  }

  function saveCandidate(application: ApplicationResponse) {
    saveCandidateProfile(application);
    setSavedIds(new Set(readSavedCandidates().map((item) => item.id)));
    showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: application.studentName || application.studentEmail || application.jobTitle });
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "pipeline" ? "Pipeline ứng tuyển" : "Ứng viên ứng tuyển"}
        description="Dữ liệu lấy từ API /companies/me/applications theo filter backend hỗ trợ."
      />
      <Card>
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Tìm kiếm" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên, email, vị trí..." />
          <Select label="Vị trí tuyển dụng" value={jobFilter} disabled={jobsLoading} onChange={(event) => { setJobFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((job) => ({ label: job.title, value: String(job.id) }))]} />
          <Input label="Từ ngày" type="date" value={appliedFrom} max={appliedTo || undefined} error={dateRangeError} onChange={(event) => { setAppliedFrom(event.target.value); setPage(1); }} />
          <Input label="Đến ngày" type="date" value={appliedTo} min={appliedFrom || undefined} onChange={(event) => { setAppliedTo(event.target.value); setPage(1); }} />
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
        {applicationsQuery.loading ? <LoadingState /> : null}
        {!applicationsQuery.loading && applicationsQuery.error ? <EmptyState message={applicationsQuery.error} /> : null}
        {!applicationsQuery.loading && !applicationsQuery.error && dateRangeError ? <EmptyState message={dateRangeError} /> : null}
        {!applicationsQuery.loading && !applicationsQuery.error && !dateRangeError && filteredApplications.length === 0 ? <EmptyState message="Không có hồ sơ ứng tuyển phù hợp." /> : null}
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
                { key: "actions", header: "Thao tác", render: (application) => <ApplicationActions application={application} saved={savedIds.has(application.id)} onSave={saveCandidate} onOpenStatus={(target) => { setSelectedApplication(target); setNextStatus(getDefaultNextStatus(target.status)); }} /> },
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
  const [savedIds, setSavedIds] = useState(() => new Set(readSavedCandidates().map((item) => item.id)));

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
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(updateError) });
    } finally {
      setUpdating(false);
    }
  }

  function saveCandidate(application: ApplicationResponse) {
    saveCandidateProfile(application);
    setSavedIds(new Set(readSavedCandidates().map((item) => item.id)));
    showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: application.studentName || application.studentEmail || application.jobTitle });
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
        <PageHeader title="Chi tiết ứng viên" description="Không thể tải dữ liệu ứng tuyển từ backend." />
        <EmptyState message={applicationQuery.error ?? "Không tìm thấy hồ sơ ứng tuyển."} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={application.studentName || "Ứng viên"} description={`${application.jobTitle} · ${formatDateTime(application.appliedAt)}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        <Button variant="secondary" icon={savedIds.has(application.id) ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />} onClick={() => saveCandidate(application)}>
          {savedIds.has(application.id) ? "Đã lưu hồ sơ" : "Lưu hồ sơ"}
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
          <UnsupportedCard title="Đánh giá & hoạt động" items={["Match score", "Tag", "Ghi chú nội bộ", "Lịch phỏng vấn", "Lịch sử hoạt động"]} />
        </div>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái ứng tuyển" />
            <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} />
            <div className="mt-4 grid gap-3">
              <Select label="Chuyển trạng thái" value={nextStatus} disabled={application.status === "WITHDRAWN"} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={getAllowedStatusOptions(application.status)} />
              <Button loading={updating} disabled={application.status === "WITHDRAWN"} onClick={() => void changeStatus()}>Cập nhật trạng thái</Button>
              {application.status === "WITHDRAWN" ? <p className="text-xs text-slate-500">Ứng viên đã rút đơn nên không thể cập nhật trạng thái khác.</p> : null}
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
  const [savedCandidates, setSavedCandidates] = useState(() => readSavedCandidates());

  function removeSavedCandidate(applicationId: number) {
    const nextCandidates = savedCandidates.filter((application) => application.id !== applicationId);
    setSavedCandidates(nextCandidates);
    writeSavedCandidates(nextCandidates);
    showToast({ type: "success", title: "Đã bỏ lưu hồ sơ ứng viên" });
  }

  return (
    <PageContainer>
      <PageHeader title="Hồ sơ đã lưu" description="Danh sách hồ sơ ứng viên đã lưu từ các đơn ứng tuyển thật của công ty." />
      <Card>
        <SectionHeader title="Danh sách hồ sơ" description={`${savedCandidates.length} hồ sơ đã lưu`} />
        {savedCandidates.length === 0 ? <EmptyState message="Chưa có hồ sơ ứng viên nào được lưu." /> : null}
        {savedCandidates.length > 0 ? (
          <Table
            rows={savedCandidates}
            getRowKey={(application) => String(application.id)}
            columns={[
              { key: "candidate", header: "Ứng viên", render: (application) => <CandidateCell application={application} /> },
              { key: "job", header: "Tin ứng tuyển", render: (application) => <div><p className="font-medium text-slate-900">{application.jobTitle}</p><p className="text-xs text-slate-500">{formatDateTime(application.appliedAt)}</p></div> },
              { key: "cv", header: "CV", render: (application) => application.cvFileName ? <StatusBadge label={application.cvFileName} /> : "Chưa có CV" },
              { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} /> },
              {
                key: "actions",
                header: "Thao tác",
                render: (application) => (
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/recruiter/candidates/${application.id}`}><Button variant="secondary" size="sm" icon={<Search size={14} />}>Chi tiết</Button></Link>
                    <Button variant="secondary" size="sm" onClick={() => removeSavedCandidate(application.id)}>Bỏ lưu</Button>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
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
      <Button variant="secondary" size="sm" icon={saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />} onClick={() => onSave(application)}>
        {saved ? "Đã lưu" : "Lưu hồ sơ"}
      </Button>
      <Button variant="secondary" size="sm" icon={<UserCheck size={14} />} disabled={application.status === "WITHDRAWN"} onClick={() => onOpenStatus(application)}>Trạng thái</Button>
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
          <Select label="Trạng thái mới" value={nextStatus} disabled={application.status === "WITHDRAWN"} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={getAllowedStatusOptions(application.status)} />
          {application.status === "WITHDRAWN" ? <p className="text-xs text-slate-500">Ứng viên đã rút đơn nên không thể cập nhật trạng thái khác.</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Hủy</Button>
            <Button loading={loading} disabled={application.status === "WITHDRAWN"} onClick={onConfirm}>Cập nhật</Button>
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
    if (page.totalItems > 0 || query.keyword.trim() || query.status || query.jobId || query.jobIds.length === 0) {
      return { ...page, items: sortedItems };
    }
  } catch {
    if (query.keyword.trim() || query.status || query.jobId || query.jobIds.length === 0) {
      throw new Error("Cannot load company applications");
    }
  }

  return getCompanyApplicationsByJobs(query);
}

async function getCompanyApplicationsByJobs(query: ApplicationListQuery): Promise<PageResponse<ApplicationResponse>> {
  const responses = await Promise.allSettled(
    query.jobIds.map((jobId) => httpClient.get<ApiResponse<ApplicationResponse[]>>(`/companies/me/jobs/${jobId}/applications`)),
  );
  const applications = responses
    .flatMap((response) => response.status === "fulfilled" ? response.value.data.data : [])
    .filter((application, index, list) => list.findIndex((item) => item.id === application.id) === index);
  const sortedApplications = sortApplicationsForRecruiter(applications, query.sort);
  const totalItems = applications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.size));
  const currentPage = Math.min(Math.max(query.page, 1), totalPages);
  const start = (currentPage - 1) * query.size;

  return {
    items: sortedApplications.slice(start, start + query.size),
    page: currentPage,
    size: query.size,
    totalItems,
    totalPages,
  };
}

async function getCompanyApplicationDetail(applicationId: number) {
  const response = await httpClient.get<ApiResponse<ApplicationResponse>>(`/companies/me/applications/${applicationId}`);
  return response.data.data;
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
  if (currentStatus === "ACCEPTED") return ["WITHDRAWN"];
  if (currentStatus === "REJECTED") return ["ACCEPTED"];
  if (currentStatus === "WITHDRAWN") return ["WITHDRAWN"];
  if (currentStatus === "REVIEWED") return ["ACCEPTED", "REJECTED", "WITHDRAWN"];
  return ["REVIEWED", "ACCEPTED", "REJECTED", "WITHDRAWN"];
}

function getDefaultNextStatus(currentStatus: ApplicationStatus): ApplicationStatus {
  if (currentStatus === "PENDING") return "REVIEWED";
  return getAllowedNextStatuses(currentStatus)[0] ?? currentStatus;
}

function canChangeApplicationStatus(currentStatus: ApplicationStatus, nextStatus: ApplicationStatus) {
  return getAllowedNextStatuses(currentStatus).includes(nextStatus);
}

function sortApplicationsForRecruiter(applications: ApplicationResponse[], sort: string) {
  const direction = sort.endsWith(",asc") ? 1 : -1;
  return applications.slice().sort((left, right) => {
    if (left.status === "ACCEPTED" && right.status !== "ACCEPTED") return 1;
    if (left.status !== "ACCEPTED" && right.status === "ACCEPTED") return -1;
    return (new Date(left.appliedAt).getTime() - new Date(right.appliedAt).getTime()) * direction;
  });
}

function readSavedCandidates() {
  return getStorageItem<ApplicationResponse[]>(SAVED_CANDIDATES_STORAGE_KEY, []);
}

function writeSavedCandidates(candidates: ApplicationResponse[]) {
  setStorageItem(SAVED_CANDIDATES_STORAGE_KEY, candidates);
}

function saveCandidateProfile(application: ApplicationResponse) {
  const savedCandidates = readSavedCandidates();
  const nextCandidates = [
    application,
    ...savedCandidates.filter((savedApplication) => savedApplication.id !== application.id),
  ];
  writeSavedCandidates(nextCandidates);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

async function openApplicationCv(application: ApplicationResponse, showToast: ReturnType<typeof useToast>["showToast"]) {
  if (application.cvFileId) {
    try {
      const response = await httpClient.get<Blob>(`/companies/me/applications/${application.id}/cv`, {
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
      return;
    } catch (error) {
      showToast({
        type: "error",
        title: "Không thể mở CV",
        message: getErrorMessage(error),
      });
      return;
    }
  }

  const cvUrl = resolveCvUrl(application);
  if (!cvUrl) {
    showToast({
      type: "info",
      title: "Chưa có link file CV",
      message: "API ứng tuyển hiện chỉ trả CV file ID/tên file, chưa có fileUrl/filePath hoặc endpoint download để mở file thật.",
    });
    return;
  }
  window.open(cvUrl, "_blank", "noopener,noreferrer");
}

function resolveCvUrl(application: ApplicationResponse) {
  const rawUrl = application.cvFileUrl ?? application.cvFilePath ?? application.fileUrl ?? application.filePath;
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith("/")) return rawUrl;
  return `/${rawUrl.replace(/^\/+/, "")}`;
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
