import { MessageLauncher } from "../../features/messaging/MessageLauncher";
import { InvitationLauncher } from "../../features/recruiting/InvitationLauncher";
import { BookmarkCheck, BookmarkPlus, CheckCircle2, Clock3, FileText, Search, Sparkles, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { ErrorState } from "../../components/feedback/ErrorState";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { RecruiterDataTable } from "../../features/recruiter/RecruiterDataTable";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../services/api/httpClient";
import { SavedCandidatesPage } from "../../features/recruiter/saved-candidates/SavedCandidatesPage";
import { updateSavedNote, type SavedCandidate } from "../../features/recruiter/saved-candidates/savedCandidatesApi";
import { useCandidateMutation } from "../../features/recruiter/saved-candidates/useCandidateMutation";
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

type SavedCandidateResponse = SavedCandidate;

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

export function RecruiterCandidatesPage(props: RecruiterCandidatesPageProps) {
  return <RecruiterCandidateWorkspace key={sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? "anonymous"} {...props} />;
}

function RecruiterCandidateWorkspace({ mode = "list" }: RecruiterCandidatesPageProps) {
  const { candidateId } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const jobsQuery = useAsyncData(() => getCompanyJobs(), []);

  if (mode === "saved") {
    return <SavedCandidatesPage />;
  }

  if (mode === "search") {
    return (
      <CandidateSearchPage
        jobs={jobsQuery.data ?? []}
        jobsLoading={jobsQuery.loading}
        jobsError={jobsQuery.error}
        showToast={showToast}
      />
    );
  }

  if (mode === "recommended") {
    return <UnsupportedCandidateMode mode={mode} />;
  }

  if (mode === "evaluation" && candidateId) {
    return (
      <CandidateEvaluationPage
        applicationId={Number(candidateId)}
        reloadKey={reloadKey}
        onReload={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  if (mode === "detail" && candidateId) {
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
      jobsError={jobsQuery.error}
      showToast={showToast}
    />
  );
}

function CandidateSearchPage({
  jobs,
  jobsLoading,
  jobsError,
  showToast,
}: {
  jobs: JobResponse[];
  jobsLoading: boolean;
  jobsError: string | null;
  showToast: ReturnType<typeof useToast>["showToast"];
}) {
  const [activeView, setActiveView] = useState<"applicants" | "saved">("applicants");

  return (
    <PageContainer>
      <PageHeader
        title="Tìm kiếm ứng viên"
        description="Tra cứu ứng viên thuộc phạm vi đơn ứng tuyển và hồ sơ đã lưu của công ty bạn."
      />
      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            items={[
              { label: "Ứng viên ứng tuyển", value: "applicants" },
              { label: "Hồ sơ đã lưu", value: "saved" },
            ]}
            value={activeView}
            onChange={(value) => setActiveView(value as "applicants" | "saved")}
          />
          <p className="text-xs text-slate-600" data-testid="candidate-search-scope-notice">
            Chỉ tra cứu ứng viên đã ứng tuyển hoặc đã lưu thuộc công ty hiện tại (không có danh bạ sinh viên công khai).
          </p>
        </div>
      </Card>
      {activeView === "applicants" ? (
        <ApplicationsListPage
          mode="list"
          embedded
          jobs={jobs}
          jobsLoading={jobsLoading}
          jobsError={jobsError}
          showToast={showToast}
        />
      ) : (
        <SavedCandidatesPage embedded />
      )}
    </PageContainer>
  );
}

function ApplicationsListPage({
  mode,
  embedded = false,
  jobs,
  jobsLoading,
  jobsError,
  showToast,
}: {
  mode: RecruiterCandidatesPageProps["mode"];
  embedded?: boolean;
  jobs: JobResponse[];
  jobsLoading: boolean;
  jobsError: string | null;
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
  const saveMutation = useCandidateMutation();

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
    if (savedCandidatesQuery.loading || savedCandidatesQuery.error) return;
    await saveMutation.run(() => saveCandidateByApplication(application.id), () => {
      setSavedReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: application.studentName || application.studentEmail || application.jobTitle });
    });
  }

  const content = (
    <>
      <Card>
        <div className="grid items-end gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Input label="Tìm kiếm" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên, email, vị trí..." />
          <Select label="Vị trí tuyển dụng" value={jobFilter} disabled={jobsLoading} onChange={(event) => { setJobFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((job) => ({ label: job.title, value: String(job.id) }))]} />
          <Select label="Trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="Sắp xếp" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1); }} options={[{ label: "Mới nhất", value: "appliedAt,desc" }, { label: "Cũ nhất", value: "appliedAt,asc" }]} />
          <div className="flex flex-wrap gap-2 sm:col-span-2 2xl:col-span-4">
            <Button variant="secondary" disabled={applicationsQuery.loading} icon={<Search size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tải lại danh sách</Button>
            {query || jobFilter || statusFilter ? <Button variant="ghost" onClick={() => { setQuery(""); setJobFilter(""); setStatusFilter(""); setPage(1); }}>Xóa bộ lọc</Button> : null}
          </div>
        </div>
        {jobsError ? <p role="alert" className="mt-4 text-sm text-amber-800">Không tải được danh sách vị trí cho bộ lọc. Bạn vẫn có thể xem hồ sơ ứng tuyển.</p> : null}
      </Card>

      {mode === "pipeline" && !applicationsQuery.loading && !applicationsQuery.error ? <><p className="mt-5 text-xs text-slate-500">Số lượng theo trạng thái trên trang kết quả hiện tại, sau khi lọc.</p><PipelineSummary applications={filteredApplications} /></> : null}

      <Card className="mt-5">
        <SectionHeader title="Danh sách ứng viên" description={applicationsQuery.loading ? "Đang tải hồ sơ..." : applicationsQuery.error ? "Danh sách chưa sẵn sàng." : `${applicationsPage?.totalItems ?? 0} hồ sơ ứng tuyển`} />
        {applicationsQuery.loading ? <LoadingState /> : null}
        {!applicationsQuery.loading && applicationsQuery.error ? <ErrorState message={applicationsQuery.error} /> : null}
        {saveMutation.error ? <ErrorState message={saveMutation.error} /> : null}
        {savedCandidatesQuery.error ? <p role="alert" className="mb-4 text-sm text-amber-800">Chưa tải được trạng thái lưu ứng viên. Vui lòng tải lại trang trước khi lưu hồ sơ.</p> : null}
        {!applicationsQuery.loading && !applicationsQuery.error && filteredApplications.length === 0 ? <EmptyState message="Không có hồ sơ ứng tuyển phù hợp." /> : null}
        {!applicationsQuery.loading && !applicationsQuery.error && filteredApplications.length > 0 ? (
          <div className="space-y-4">
            <RecruiterDataTable
              rows={filteredApplications}
              getRowKey={(application) => String(application.id)}
              columns={[
                { key: "candidate", header: "Ứng viên", render: (application) => <CandidateCell application={application} /> },
                { key: "job", header: "Tin ứng tuyển", render: (application) => <div><p className="font-medium text-slate-900">{application.jobTitle}</p><p className="text-xs text-slate-500">{formatDateTime(application.appliedAt)}</p></div> },
                { key: "cv", header: "CV", render: (application) => <span className="block max-w-56 truncate text-sm" title={application.cvFileName ?? undefined}>{application.cvFileName || "Chưa có CV"}</span> },
                { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} /> },
                { key: "actions", header: "Thao tác", render: (application) => <ApplicationActions saving={saveMutation.pending} saveDisabled={savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error)} application={application} saved={savedStudentIds.has(application.studentId)} onSave={(target) => void saveCandidate(target)} onOpenStatus={(target) => { setSelectedApplication(target); setNextStatus(getDefaultNextStatus(target.status)); }} /> },
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
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <PageContainer>
      <PageHeader
        title={mode === "pipeline" ? "Pipeline ứng tuyển" : "Ứng viên ứng tuyển"}
        description="Theo dõi hồ sơ ứng tuyển theo tin tuyển dụng và trạng thái xử lý."
      />
      {content}
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
  const saveMutation = useCandidateMutation();
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
    if (savedCandidatesQuery.loading || savedCandidatesQuery.error) return;
    await saveMutation.run(() => saveCandidateByApplication(application.id), () => {
      setSavedReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: application.studentName || application.studentEmail || application.jobTitle });
    });
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
        <ErrorState message={applicationQuery.error ?? "Không tìm thấy hồ sơ ứng tuyển."} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={application.studentName || "Ứng viên"} description={`${application.jobTitle} · ${formatDateTime(application.appliedAt)}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        <InvitationLauncher applicationId={application.id} />
        <Link to={`/recruiter/candidates/${application.id}/evaluation`}><Button variant="secondary">Đánh giá hồ sơ</Button></Link>
        <Button variant="secondary" loading={saveMutation.pending} disabled={savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error) || savedStudentIds.has(application.studentId)} icon={savedStudentIds.has(application.studentId) ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />} onClick={() => void saveCandidate(application)}>
          {savedStudentIds.has(application.studentId) ? "Đã lưu ứng viên" : "Lưu hồ sơ"}
        </Button>
        <MessageLauncher applicationId={application.id} role="recruiter" />
      </div>
      {saveMutation.error ? <ErrorState message={saveMutation.error} /> : null}
      {savedCandidatesQuery.error ? <ErrorState message={savedCandidatesQuery.error} /> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
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
            {application.cvFileId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="shrink-0 text-brand-600" size={20} />
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">{application.cvFileName || "CV ứng tuyển"}</p>
                    <p className="text-xs text-slate-500">Tệp đính kèm hồ sơ ứng tuyển</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => void openApplicationCv(application, showToast)}>Xem CV</Button>
              </div>
            ) : <EmptyState message="Hồ sơ ứng tuyển chưa có CV." />}
          </Card>
        </div>
        <aside className="min-w-0 space-y-5">
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

function CandidateEvaluationPage({
  applicationId,
  reloadKey,
  onReload,
}: {
  applicationId: number;
  reloadKey: number;
  onReload: () => void;
}) {
  const { showToast } = useToast();
  const validApplicationId = Number.isInteger(applicationId) && applicationId > 0;
  const applicationQuery = useAsyncData(
    () => (validApplicationId ? getCompanyApplicationDetail(applicationId) : Promise.resolve(null)),
    [applicationId, reloadKey],
  );
  const application = applicationQuery.data;
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [updating, setUpdating] = useState(false);
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const saveMutation = useCandidateMutation();
  const noteMutation = useCandidateMutation();
  const savedCandidatesQuery = useAsyncData(
    () => (validApplicationId ? getAllSavedCandidates() : Promise.resolve([])),
    [savedReloadKey],
  );
  const [savedRecord, setSavedRecord] = useState<SavedCandidateResponse | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [draftStale, setDraftStale] = useState(false);

  const matchedSaved = useMemo(() => {
    if (!application || !savedCandidatesQuery.data) return null;
    return savedCandidatesQuery.data.find((candidate) => candidate.studentId === application.studentId) ?? null;
  }, [application, savedCandidatesQuery.data]);

  const activeSaved = savedRecord && application && savedRecord.studentId === application.studentId ? savedRecord : matchedSaved;

  useEffect(() => {
    if (application) setNextStatus(getDefaultNextStatus(application.status));
  }, [application]);

  useEffect(() => {
    if (!application || !savedCandidatesQuery.data || noteDirty || draftStale) return;
    const matched = savedCandidatesQuery.data.find((candidate) => candidate.studentId === application.studentId) ?? null;
    if (savedRecord && matched && savedRecord.studentId === matched.studentId && savedRecord.revision > matched.revision) {
      return;
    }
    setSavedRecord(matched);
    setNoteDraft(matched?.note ?? "");
  }, [application, savedCandidatesQuery.data, noteDirty, draftStale, savedRecord]);

  useEffect(() => {
    const refresh = () => setSavedReloadKey((current) => current + 1);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "job-system:saved-candidates-changed") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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

  async function saveCandidate(targetApplication: ApplicationResponse) {
    if (savedCandidatesQuery.loading || savedCandidatesQuery.error) return;
    await saveMutation.run(
      () => saveCandidateByApplication(targetApplication.id),
      (createdSaved) => {
        setSavedRecord(createdSaved);
        setNoteDraft(createdSaved.note ?? "");
        setNoteDirty(false);
        setDraftStale(false);
        noteMutation.clearError();
        setSavedReloadKey((current) => current + 1);
        localStorage.setItem("job-system:saved-candidates-changed", String(Date.now()));
        showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: targetApplication.studentName || targetApplication.studentEmail || targetApplication.jobTitle });
      },
    );
  }

  function saveNote() {
    if (!activeSaved || noteDraft.length > 2000 || draftStale || savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error)) return;
    void noteMutation.run(
      () => updateSavedNote(activeSaved, noteDraft),
      (updatedSaved) => {
        setSavedRecord(updatedSaved);
        setNoteDraft(updatedSaved.note ?? "");
        setNoteDirty(false);
        setDraftStale(false);
        setSavedReloadKey((current) => current + 1);
        localStorage.setItem("job-system:saved-candidates-changed", String(Date.now()));
        showToast({ type: "success", title: "Đã lưu ghi chú nội bộ" });
      },
      () => setDraftStale(true),
    );
  }

  function readBackSavedNote() {
    if (!application) return;
    void noteMutation.run(
      () => getAllSavedCandidates(),
      (candidates) => {
        const current = candidates.find((row) => row.studentId === application.studentId) ?? null;
        if (!current) {
          setSavedRecord(null);
          setDraftStale(true);
          setSavedReloadKey((value) => value + 1);
          return;
        }
        setSavedRecord(current);
        setNoteDraft(current.note ?? "");
        setNoteDirty(false);
        setDraftStale(false);
        setSavedReloadKey((value) => value + 1);
      },
    );
  }

  if (!validApplicationId) {
    return (
      <PageContainer>
        <PageHeader title="Đánh giá hồ sơ ứng viên" description="Không thể tải dữ liệu đánh giá." />
        <ErrorState message="Mã đơn ứng tuyển không hợp lệ." />
        <div className="mt-4">
          <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        </div>
      </PageContainer>
    );
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
        <PageHeader title="Đánh giá hồ sơ ứng viên" description="Không thể tải dữ liệu ứng tuyển." />
        <ErrorState message={applicationQuery.error ?? "Không tìm thấy hồ sơ ứng tuyển."} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onReload}>Thử lại</Button>
          <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        </div>
      </PageContainer>
    );
  }

  const hasContactInfo = Boolean(application.studentName?.trim() && application.studentEmail?.trim());
  const hasCvAttachment = Boolean(application.cvFileId);
  const hasCoverLetter = Boolean(application.coverLetter?.trim());
  const hasProfileDetails = Boolean(activeSaved && (activeSaved.university || activeSaved.major || activeSaved.headline));
  const hasReviewedStatus = application.status !== "PENDING";

  const factualItems = [
    {
      key: "contact",
      label: "Thông tin định danh & liên hệ",
      available: hasContactInfo,
      statusLabel: hasContactInfo ? "Đã đầy đủ" : "Còn thiếu",
      detail: hasContactInfo
        ? `${application.studentName} (${application.studentEmail})`
        : "Thiếu họ tên hoặc địa chỉ email liên hệ của ứng viên.",
    },
    {
      key: "cv",
      label: "Tệp CV đính kèm",
      available: hasCvAttachment,
      statusLabel: hasCvAttachment ? "Đã đính kèm" : "Chưa đính kèm",
      detail: hasCvAttachment
        ? application.cvFileName || `Tệp CV #${application.cvFileId}`
        : "Đơn ứng tuyển chưa có tệp CV đính kèm.",
    },
    {
      key: "coverLetter",
      label: "Thư giới thiệu (Cover Letter)",
      available: hasCoverLetter,
      statusLabel: hasCoverLetter ? "Đã cung cấp" : "Chưa cung cấp",
      detail: hasCoverLetter
        ? `Đã cung cấp thư giới thiệu (${application.coverLetter!.trim().length} ký tự).`
        : "Ứng viên không nhập thư giới thiệu cho đơn ứng tuyển này.",
    },
    {
      key: "profile",
      label: "Thông tin học vấn & tiêu đề hồ sơ",
      available: hasProfileDetails,
      statusLabel: !activeSaved ? "Chưa lưu hồ sơ" : hasProfileDetails ? "Đã có thông tin" : "Chưa cập nhật",
      detail: !activeSaved
        ? "Lưu hồ sơ ứng viên để đồng bộ thông tin trường đào tạo, chuyên ngành và tiêu đề hồ sơ."
        : hasProfileDetails
          ? [activeSaved.university, activeSaved.major, activeSaved.headline].filter(Boolean).join(" · ")
          : "Hồ sơ ứng viên chưa cập nhật trường đào tạo, chuyên ngành hoặc tiêu đề hồ sơ.",
    },
    {
      key: "reviewStatus",
      label: "Tiến độ xét duyệt đơn",
      available: hasReviewedStatus,
      statusLabel: APPLICATION_STATUS_LABELS[application.status],
      detail: application.reviewedAt
        ? `Đã xem xét lúc ${formatDateTime(application.reviewedAt)}.`
        : "Đơn ứng tuyển đang chờ nhà tuyển dụng xem xét.",
    },
  ];

  const availableCount = factualItems.filter((item) => item.available).length;
  const missingCount = factualItems.length - availableCount;

  return (
    <PageContainer>
      <PageHeader
        title="Đánh giá hồ sơ ứng viên"
        description={`Đơn ứng tuyển #${application.id} · ${application.studentName || application.studentEmail || "Ứng viên"} · ${application.jobTitle}`}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to="/recruiter/candidates"><Button variant="secondary">Quay lại danh sách</Button></Link>
        <Link to={`/recruiter/candidates/${application.id}`}><Button variant="secondary">Xem chi tiết đơn</Button></Link>
        <Button
          variant="secondary"
          loading={saveMutation.pending}
          disabled={savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error) || Boolean(activeSaved)}
          icon={activeSaved ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
          onClick={() => void saveCandidate(application)}
        >
          {activeSaved ? "Đã lưu ứng viên" : "Lưu hồ sơ"}
        </Button>
      </div>
      {saveMutation.error ? <ErrorState message={saveMutation.error} /> : null}
      {savedCandidatesQuery.error ? (
        <div className="mb-5 space-y-2">
          <ErrorState message={savedCandidatesQuery.error} />
          <Button variant="secondary" size="sm" onClick={() => setSavedReloadKey((current) => current + 1)}>
            Tải lại trạng thái lưu
          </Button>
        </div>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader
              title="Thông tin ứng viên & đơn ứng tuyển"
              description="Dữ liệu thực tế từ đơn ứng tuyển và hồ sơ sinh viên đã xác thực."
            />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <InfoRow label="Mã đơn ứng tuyển" value={`#${application.id}`} />
              <InfoRow label="Mã ứng viên" value={`#${application.studentId}`} />
              <InfoRow label="Ứng viên" value={application.studentName} />
              <InfoRow label="Email" value={application.studentEmail} />
              <InfoRow label="Tin tuyển dụng" value={`${application.jobTitle} (#${application.jobId})`} />
              <InfoRow label="Công ty" value={application.companyName} />
              <InfoRow label="Ngày ứng tuyển" value={formatDateTime(application.appliedAt)} />
              <InfoRow label="Ngày xem xét" value={formatDateTime(application.reviewedAt)} />
              <InfoRow label="Trường đào tạo" value={activeSaved?.university ?? (activeSaved ? "Chưa cập nhật" : "Lưu hồ sơ để đồng bộ")} />
              <InfoRow label="Chuyên ngành" value={activeSaved?.major ?? (activeSaved ? "Chưa cập nhật" : "Lưu hồ sơ để đồng bộ")} />
              <InfoRow label="Tiêu đề hồ sơ" value={activeSaved?.headline ?? (activeSaved ? "Chưa cập nhật" : "Lưu hồ sơ để đồng bộ")} />
            </div>
          </Card>

          <Card>
            <div data-testid="factual-review-card">
              <SectionHeader
                title="Đánh giá thực tế thông tin hồ sơ"
                description="Tổng hợp khách quan các hạng mục đã có và còn thiếu trong hồ sơ ứng tuyển."
              />
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span data-testid="factual-available-summary" className="font-medium text-slate-900">
                  Đã xác nhận {availableCount}/{factualItems.length} nhóm thông tin
                </span>
                <span data-testid="factual-missing-summary" className="text-slate-600">
                  {missingCount === 0 ? "Đầy đủ các nhóm thông tin cơ bản" : `Còn thiếu hoặc chờ bổ sung ${missingCount} mục`}
                </span>
              </div>
              <div className="divide-y divide-slate-100" data-testid="factual-review-list">
                {factualItems.map((item) => (
                  <div key={item.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.available ? (
                          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        ) : (
                          <Clock3 size={16} className="shrink-0 text-amber-600" />
                        )}
                        <p className="font-medium text-slate-900">{item.label}</p>
                      </div>
                      <p className="mt-1 pl-6 text-xs text-slate-600">{item.detail}</p>
                    </div>
                    <div className="shrink-0 pl-6 sm:pl-0">
                      <StatusBadge label={item.statusLabel} tone={item.available ? "success" : "warning"} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Thư giới thiệu" />
            {application.coverLetter ? (
              <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{application.coverLetter}</p>
            ) : (
              <EmptyState message="Ứng viên chưa nhập thư giới thiệu." />
            )}
          </Card>

          <Card>
            <SectionHeader title="CV ứng tuyển" />
            {application.cvFileId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="shrink-0 text-brand-600" size={20} />
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">{application.cvFileName || "CV ứng tuyển"}</p>
                    <p className="text-xs text-slate-500">Tệp đính kèm hồ sơ ứng tuyển</p>
                  </div>
                </div>
                <Button variant="secondary" onClick={() => void openApplicationCv(application, showToast)}>Xem CV</Button>
              </div>
            ) : (
              <EmptyState message="Hồ sơ ứng tuyển chưa có CV." />
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Trạng thái ứng tuyển" />
            <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone={applicationStatusTone(application.status)} />
            <div className="mt-4 grid gap-3">
              <Select
                label="Chuyển trạng thái"
                value={nextStatus}
                disabled={!hasAllowedStatusTransition(application.status)}
                onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)}
                options={getAllowedStatusOptions(application.status)}
              />
              <Button loading={updating} disabled={!hasAllowedStatusTransition(application.status)} onClick={() => void changeStatus()}>
                Cập nhật trạng thái
              </Button>
              {!hasAllowedStatusTransition(application.status) ? (
                <p className="text-xs text-slate-500">Trạng thái hiện tại không còn bước chuyển hợp lệ cho nhà tuyển dụng.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <div data-testid="saved-candidate-note-card">
              <SectionHeader
                title="Ghi chú đánh giá nội bộ"
                description="Chỉ công ty bạn được đọc và cập nhật ghi chú trên hồ sơ ứng viên đã lưu."
              />
              {!activeSaved ? (
                <div className="space-y-3" data-testid="unsaved-note-lock">
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    Chưa thể chỉnh sửa ghi chú vì ứng viên chưa được lưu vào danh sách của công ty. Lưu hồ sơ ứng viên để mở khóa ghi chú đánh giá nội bộ.
                  </p>
                  <Textarea
                    label="Ghi chú đánh giá"
                    value=""
                    disabled
                    placeholder="Lưu hồ sơ ứng viên trước khi nhập ghi chú đánh giá..."
                    onChange={() => undefined}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      loading={saveMutation.pending}
                      disabled={savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error)}
                      icon={<BookmarkPlus size={16} />}
                      onClick={() => void saveCandidate(application)}
                    >
                      Lưu hồ sơ để ghi chú
                    </Button>
                    <Button disabled>Lưu ghi chú</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3" data-testid="saved-note-editor">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">
                      Hồ sơ đã lưu #{activeSaved.id} · Phiên bản v{activeSaved.revision}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-slate-700" data-testid="saved-note-current">
                      {activeSaved.note ? `Ghi chú đã lưu: ${activeSaved.note}` : "Chưa có ghi chú đã lưu."}
                    </p>
                  </div>
                  <Textarea
                    label="Ghi chú đánh giá"
                    value={noteDraft}
                    maxLength={2000}
                    disabled={noteMutation.pending || savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error)}
                    onChange={(event) => {
                      setNoteDraft(event.target.value);
                      setNoteDirty(true);
                    }}
                  />
                  <p className="text-xs text-slate-500">{noteDraft.length}/2000</p>
                  {noteMutation.error ? <ErrorState message={noteMutation.error} /> : null}
                  {draftStale ? (
                    <p role="alert" className="text-sm text-amber-800">
                      Chưa lưu bản nháp. Hãy sao chép nội dung cần giữ rồi tải ghi chú hiện tại để đối chiếu trước khi lưu lại.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {draftStale ? (
                      <Button variant="secondary" disabled={noteMutation.pending} onClick={readBackSavedNote}>
                        Tải ghi chú hiện tại
                      </Button>
                    ) : null}
                    <Button
                      loading={noteMutation.pending}
                      disabled={draftStale || noteDraft.length > 2000 || savedCandidatesQuery.loading || Boolean(savedCandidatesQuery.error)}
                      onClick={saveNote}
                    >
                      Lưu ghi chú
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div data-testid="v3-ranking-link-card">
              <SectionHeader
                title="Xếp hạng ứng viên AI (V3)"
                description="Đối chiếu mức độ phù hợp kỹ năng và nội dung CV từ hệ thống xếp hạng chính thức."
              />
              <p className="text-xs leading-5 text-slate-600">
                Trang đánh giá hồ sơ chỉ tổng hợp thông tin thực tế của đơn ứng tuyển và không tự suy diễn điểm số AI. Để xem xếp hạng ứng viên V3 chính thức (PRIMARY / FALLBACK) của tin tuyển dụng này, vui lòng mở bảng xếp hạng ứng viên.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Link to={`/recruiter/jobs/${application.jobId}/candidate-ranking`}>
                  <Button variant="secondary" icon={<Sparkles size={16} />} className="w-full justify-center">
                    Mở xếp hạng ứng viên AI (V3)
                  </Button>
                </Link>
                <Link to={`/recruiter/jobs/${application.jobId}/preview`}>
                  <Button variant="secondary" className="w-full justify-center">
                    Xem tin tuyển dụng
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function PipelineSummary({ applications }: { applications: ApplicationResponse[] }) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-5">
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
      <div className="min-w-0 break-words">
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">{application.studentEmail || "Chưa có email"}</p>
      </div>
    </div>
  );
}

function ApplicationActions({
  saving,
  saveDisabled,
  application,
  saved,
  onSave,
  onOpenStatus,
}: {
  saving: boolean;
  saveDisabled: boolean;
  application: ApplicationResponse;
  saved: boolean;
  onSave: (application: ApplicationResponse) => void;
  onOpenStatus: (application: ApplicationResponse) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/recruiter/candidates/${application.id}`}><Button variant="secondary" size="sm" icon={<Search size={14} />}>Chi tiết</Button></Link>
      <InvitationLauncher applicationId={application.id} />
      <Link to={`/recruiter/candidates/${application.id}/evaluation`}><Button variant="secondary" size="sm">Đánh giá</Button></Link>
      <Button variant="secondary" size="sm" loading={saving} disabled={saved || saveDisabled} icon={saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />} onClick={() => onSave(application)}>
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
      <strong className="min-w-0 break-words text-right font-medium text-slate-900">{value || "Chưa cập nhật"}</strong>
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
    return response.data.data;
  } catch {
    throw new Error("Không thể tải danh sách ứng viên ứng tuyển.");
  }
}

async function getCompanyApplicationDetail(applicationId: number) {
  const response = await httpClient.get<ApiResponse<ApplicationResponse>>(`/companies/me/applications/${applicationId}`);
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

const COMPANY_JOBS_PAGE_SIZE = 100;

async function getCompanyJobs(page = 1, items: JobResponse[] = []): Promise<JobResponse[]> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/companies/me/jobs", {
    params: { page, size: COMPANY_JOBS_PAGE_SIZE },
  });
  const data = response.data.data;
  const nextItems = [...items, ...data.items];
  if (data.items.length > 0 && data.page < data.totalPages) return getCompanyJobs(page + 1, nextItems);
  return nextItems;
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
