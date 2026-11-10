import { BriefcaseBusiness, Eye, Pencil, Plus, RefreshCcw, Users, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { ErrorState } from "../../components/feedback/ErrorState";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { RecruiterDataTable } from "../../features/recruiter/RecruiterDataTable";
import { getCompanyJobActions } from "../../features/recruiter/jobModerationActions";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

interface RecruiterJobsPageProps {
  mode?: "list" | "create" | "detail" | "edit" | "preview" | "statistics";
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

interface JobSkillResponse {
  id: number;
  skillId: number;
  skillName: string;
  normalizedName: string;
  category: string | null;
  importance: SkillImportance | null;
  minLevel: SkillLevel | null;
}

interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  jobType: JobType | null;
  workingModel: WorkingModel | null;
  status: JobStatus;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
  skills: JobSkillResponse[];
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobDetailResponse extends JobResponse {
  description: string | null;
  requirements: string | null;
  benefits: string | null;
}

interface SkillResponse {
  id: number;
  name: string;
  normalizedName: string;
  category: string | null;
  description: string | null;
}

interface CompanyResponse {
  id: number;
  companyName?: string | null;
  taxCode?: string | null;
  description?: string | null;
  website?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  industry?: string | null;
  status: CompanyStatus;
}

interface JobFormState {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  location: string;
  jobType: JobType;
  workingModel: WorkingModel;
  status: JobStatus;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  deadline: string;
  skillIds: string[];
  skillConfig: Record<string, SkillConfig>;
}

type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type CompanyStatus = "PENDING" | "VERIFIED" | "BLOCKED";
type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type WorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type SkillImportance = "REQUIRED" | "PREFERRED" | "NICE_TO_HAVE";
type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
interface SkillConfig { importance: SkillImportance | null; minLevel: SkillLevel | null }
const DEFAULT_SKILL_CONFIG: SkillConfig = { importance: "REQUIRED", minLevel: "BEGINNER" };
const SKILL_IMPORTANCE_LABELS: Record<SkillImportance, string> = { REQUIRED: "Bắt buộc", PREFERRED: "Ưu tiên", NICE_TO_HAVE: "Là điểm cộng" };
const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = { BEGINNER: "Cơ bản", INTERMEDIATE: "Trung bình", ADVANCED: "Nâng cao" };

const DEFAULT_FORM: JobFormState = {
  title: "",
  description: "",
  requirements: "",
  benefits: "",
  location: "",
  jobType: "FULL_TIME",
  workingModel: "ONSITE",
  status: "DRAFT",
  salaryMin: "",
  salaryMax: "",
  currency: "đồng",
  deadline: "",
  skillIds: [],
  skillConfig: {},
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang tuyển",
  CLOSED: "Đã đóng",
  REJECTED: "Bị từ chối",
  EXPIRED: "Hết hạn",
};

const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  CONTRACT: "Hợp đồng",
};

const WORKING_MODEL_LABELS: Record<WorkingModel, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  PENDING: "Chờ xác thực",
  VERIFIED: "Đã xác thực",
  BLOCKED: "Bị khóa",
};

const maxJobTitleLength = 255; // CreateJobRequest/UpdateJobRequest @Size(max = 255)
const maxJobContentLength = 10000; // description/requirements/benefits @Size(max = 10000)
const maxSalaryAmount = 1_000_000_000;

const VIETNAM_PROVINCES = [
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Dương",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cần Thơ",
  "Cao Bằng",
  "Đà Nẵng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Nội",
  "Hà Tĩnh",
  "Hải Dương",
  "Hải Phòng",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "TP. Hồ Chí Minh",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
];

export function RecruiterJobsPage({ mode = "list" }: RecruiterJobsPageProps) {
  const { jobId } = useParams();
  const { showToast } = useToast();
  const companyQuery = useAsyncData(() => getMyCompany(), []);
  const company = companyQuery.data;

  if (companyQuery.loading && (mode === "create" || mode === "edit")) {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  if (mode === "create") return <JobFormView mode="create" company={company} />;
  if (mode === "detail" || mode === "edit" || mode === "preview" || mode === "statistics") {
    return <JobDetailRouter mode={mode} jobId={Number(jobId)} company={company} />;
  }

  return <RecruiterJobsList showToast={showToast} company={company} companyLoading={companyQuery.loading} />;
}

function RecruiterJobsList({ showToast, company, companyLoading }: { showToast: ReturnType<typeof useToast>["showToast"]; company: CompanyResponse | null; companyLoading: boolean }) {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [jobType, setJobType] = useState("");
  const [workingModel, setWorkingModel] = useState("");
  const [closeTarget, setCloseTarget] = useState<JobResponse | null>(null);
  useEffect(() => {
    if (keyword === queryKeyword) return;
    const timer = window.setTimeout(() => { setQueryKeyword(keyword); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword, queryKeyword]);
  const jobsQuery = useAsyncData(() => getJobs({ page, keyword: queryKeyword, status, jobType, workingModel }), [page, reloadKey, queryKeyword, status, jobType, workingModel]);
  const jobs = jobsQuery.data?.items ?? [];
  const queryKey = JSON.stringify({ page, keyword, status, jobType, workingModel });
  const confirmed = jobsQuery.data;
  const current = confirmed?.queryKey === queryKey;
  const refreshing = jobsQuery.loading || Boolean(confirmed && !current && !jobsQuery.error);
  const actionsLocked = refreshing || Boolean(jobsQuery.error) || !current;

  useEffect(() => {
    if (!confirmed || !current || jobsQuery.loading || jobsQuery.error) return;
    // A status/close operation can remove the last row on the last filtered page.
    const last = Math.max(1, confirmed.totalPages);
    if (page > last) setPage(last);
  }, [confirmed, current, jobsQuery.loading, jobsQuery.error, page]);

  async function updateStatus(job: JobResponse, nextStatus: JobStatus) {
    if (nextStatus === "PENDING_APPROVAL" && company && !isCompanyVerified(company)) {
      showToast({ type: "error", title: "Công ty chưa được xác thực", message: "Bạn cần chờ admin chuyển trạng thái công ty sang Đã xác thực trước khi gửi duyệt tin." });
      return;
    }

    try {
      await updateJobStatus(job.id, nextStatus);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật trạng thái tin", message: JOB_STATUS_LABELS[nextStatus] });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(error) });
    }
  }

  async function closeJob(job: JobResponse) {
    try {
      await deleteJob(job.id);
      setReloadKey((current) => current + 1);
      setCloseTarget(null);
      showToast({ type: "success", title: "Đã đóng tin tuyển dụng" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể đóng tin", message: getErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý tin tuyển dụng" description="Theo dõi trạng thái tin, cập nhật nội dung và tìm ứng viên cho từng vị trí." />
      {company && !isCompanyVerified(company) ? (
        <Card className="mb-5 border-amber-200 bg-amber-50">
          <SectionHeader title="Công ty chưa đủ điều kiện công khai tin" description={`Trạng thái hiện tại: ${COMPANY_STATUS_LABELS[company.status]}. Bạn vẫn có thể lưu tin nháp và chỉnh sửa bản nháp. Chỉ gửi duyệt khi Admin xác thực; tin không được công khai trong lúc công ty chưa xác thực hoặc bị chặn.`} />
        </Card>
      ) : null}
      <Card>
        <div className="grid items-end gap-4 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <Input label="Từ khóa" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tên tin, địa điểm..." />
          <Select label="Trạng thái" value={status} onChange={(event) => { setStatus(event.target.value); setQueryKeyword(keyword); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="Loại việc" value={jobType} onChange={(event) => { setJobType(event.target.value); setQueryKeyword(keyword); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="Hình thức" value={workingModel} onChange={(event) => { setWorkingModel(event.target.value); setQueryKeyword(keyword); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label }))]} />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 2xl:col-span-4">
            <Button variant="secondary" disabled={jobsQuery.loading} icon={<RefreshCcw size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tải lại</Button>
            {keyword || status || jobType || workingModel ? <Button variant="ghost" onClick={() => { setKeyword(""); setQueryKeyword(""); setStatus(""); setJobType(""); setWorkingModel(""); setPage(1); }}>Xóa bộ lọc</Button> : null}
            {company ? (
              <Link to="/recruiter/jobs/create"><Button icon={<Plus size={16} />}>Tạo tin</Button></Link>
            ) : (
              <Button disabled={companyLoading || !company} icon={<Plus size={16} />}>Tạo tin</Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <SectionHeader title="Tin tuyển dụng" description={confirmed ? `${confirmed.totalItems} tin tuyển dụng • Trang ${confirmed.page}/${Math.max(1, confirmed.totalPages)}` : jobsQuery.error ? "Chưa tải được danh sách." : "Đang tải danh sách..."} />
        {refreshing && !confirmed ? <LoadingState /> : null}
        {confirmed && (refreshing || jobsQuery.error || !current) ? <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{refreshing ? "Đang cập nhật danh sách. " : "Chưa cập nhật được danh sách. "}Kết quả bên dưới là lần tải thành công gần nhất; bộ lọc hoặc trang mới chưa được xác nhận.</p> : null}
        {jobsQuery.error ? <div className="mb-4 space-y-3"><ErrorState message={jobsQuery.error} /><Button variant="secondary" onClick={() => setReloadKey(key => key + 1)}>Thử tải lại</Button></div> : null}
        {!refreshing && !jobsQuery.error && current && confirmed?.totalItems === 0 ? <EmptyState message="Không có tin tuyển dụng phù hợp." /> : null}
        {jobs.length > 0 ? (
          <div className="space-y-4">
            <RecruiterDataTable
              rows={jobs}
              getRowKey={(job) => String(job.id)}
              columns={[
                { key: "title", header: "Tin tuyển dụng", render: (job) => <JobTitleCell job={job} /> },
                { key: "type", header: "Loại", render: (job) => formatJobMeta(job) },
                { key: "salary", header: "Mức lương", render: (job) => formatSalary(job) },
                { key: "deadline", header: "Hạn nộp", render: (job) => formatDate(job.deadline) },
                { key: "status", header: "Trạng thái", render: (job) => <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={jobStatusTone(job.status)} /> },
                { key: "actions", header: "Thao tác", render: (job) => <JobActions job={job} disabled={actionsLocked} canPublish={Boolean(company && isCompanyVerified(company))} onUpdateStatus={updateStatus} onClose={setCloseTarget} /> },
              ]}
            />
          </div>
        ) : null}
        {confirmed && confirmed.totalPages > 0 ? <fieldset disabled={actionsLocked} className="mt-4"><Pagination page={confirmed.page} totalPages={confirmed.totalPages} onPageChange={setPage} /></fieldset> : null}
      </Card>
      <CloseJobModal job={closeTarget} onClose={() => setCloseTarget(null)} onConfirm={(job) => void closeJob(job)} />
    </PageContainer>
  );
}

function JobDetailRouter({ mode, jobId, company }: { mode: "detail" | "edit" | "preview" | "statistics"; jobId: number; company: CompanyResponse | null }) {
  const [reloadKey, setReloadKey] = useState(0);
  const detailQuery = useAsyncData(() => getJobDetail(jobId), [jobId, reloadKey]);

  if (detailQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    const headerTitle =
      mode === "preview"
        ? "Xem trước tin tuyển dụng"
        : mode === "statistics"
          ? "Thống kê tin tuyển dụng"
          : mode === "edit"
            ? "Chỉnh sửa tin tuyển dụng"
            : "Chi tiết tin tuyển dụng";
    return (
      <PageContainer>
        <PageHeader title={headerTitle} description="Không thể tải dữ liệu tin tuyển dụng." />
        <ErrorState message={detailQuery.error ?? "Không tìm thấy tin tuyển dụng."} />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => setReloadKey((key) => key + 1)}>
            Thử lại
          </Button>
          <Link to="/recruiter/jobs">
            <Button variant="secondary">Quay lại danh sách</Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  const { job: resolvedJob, company: resolvedCompany } = detailQuery.data;

  if (mode === "edit" && resolvedJob.status !== "DRAFT") return <PrepareJobDraft job={resolvedJob} onChanged={() => setReloadKey(key => key + 1)} />;
  if (mode === "edit") return <JobFormView mode="edit" job={resolvedJob} company={resolvedCompany ?? company} onSaved={() => setReloadKey(key => key + 1)} />;
  if (mode === "preview") return <JobPreviewView job={resolvedJob} company={resolvedCompany ?? company} />;
  if (mode === "statistics") return <UnsupportedJobView job={resolvedJob} title="Thống kê tin tuyển dụng" message="Chưa có dữ liệu thống kê cho tin tuyển dụng này." />;
  return <JobDetailView job={resolvedJob} />;
}

function PrepareJobDraft({ job, onChanged }: { job: JobDetailResponse; onChanged: () => void }) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [confirmClose, setConfirmClose] = useState(false);
  async function prepare(target: "DRAFT" | "CLOSED") {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await updateJobStatus(job.id, target);
      setConfirmClose(false);
      onChanged();
      showToast({ type: "success", title: target === "DRAFT" ? "Đã đưa tin về nháp" : "Đã đóng tin", message: "Mọi lần gửi lại đều cần Admin phê duyệt trước khi công khai." });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái tin", message: getErrorMessage(error) });
    } finally { inFlight.current = false; setPending(false); }
  }
  return <PageContainer>
    <PageHeader title="Chuẩn bị chỉnh sửa tin" description={job.title} />
    <Card>
      <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={jobStatusTone(job.status)} />
      <p className="mt-4 text-sm leading-6 text-slate-700">Chỉ tin ở trạng thái Bản nháp được chỉnh sửa. Tin đang tuyển cần được đóng trước; tin chờ duyệt cần được rút về nháp. Sau khi sửa, hãy gửi duyệt lại.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {job.status === "ACTIVE" ? <Button variant="danger" disabled={pending} onClick={() => setConfirmClose(true)}>Đóng tin để chỉnh sửa</Button>
          : <Button loading={pending} disabled={pending} onClick={() => void prepare("DRAFT")}>{job.status === "PENDING_APPROVAL" ? "Rút về nháp" : "Đưa về nháp"}</Button>}
        <Link to="/recruiter/jobs"><Button variant="secondary">Quay lại danh sách tin</Button></Link>
      </div>
    </Card>
    <CloseJobModal job={confirmClose ? job : null} pending={pending} onClose={() => { if (!pending) setConfirmClose(false); }} onConfirm={() => void prepare("CLOSED")} />
  </PageContainer>;
}

function JobDetailView({ job }: { job: JobDetailResponse }) {
  return (
    <PageContainer>
      <PageHeader title={job.title} description={`${job.companyName} • ${job.location || "Chưa cập nhật địa điểm"}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to={`/recruiter/jobs/${job.id}/preview`}><Button variant="secondary" icon={<Eye size={16} />}>Xem trước tin</Button></Link>
        <Link to={`/recruiter/jobs/${job.id}/candidate-ranking`}><Button icon={<Users size={16} />}>Ứng viên phù hợp</Button></Link>
        <Link to={`/recruiter/jobs/${job.id}/edit`}><Button icon={<Pencil size={16} />}>{job.status === "DRAFT" ? "Sửa tin" : "Chuẩn bị chỉnh sửa"}</Button></Link>
        <Link to="/recruiter/jobs"><Button variant="secondary">Quay lại danh sách</Button></Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <TextBlock title="Mô tả công việc" value={job.description} />
          <TextBlock title="Yêu cầu" value={job.requirements} />
          <TextBlock title="Quyền lợi" value={job.benefits} />
          <Card>
            <SectionHeader title="Kỹ năng yêu cầu" />
            {job.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => <StatusBadge key={skill.id} label={`${skill.skillName}${skill.minLevel ? ` • ${skill.minLevel}` : ""}`} />)}
              </div>
            ) : <EmptyState message="Tin chưa có kỹ năng yêu cầu." />}
          </Card>
        </div>
        <aside className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Thông tin tin tuyển dụng" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoRow label="Trạng thái" value={JOB_STATUS_LABELS[job.status]} />
              <InfoRow label="Loại việc" value={job.jobType ? JOB_TYPE_LABELS[job.jobType] : null} />
              <InfoRow label="Hình thức" value={job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : null} />
              <InfoRow label="Mức lương" value={formatSalary(job)} />
              <InfoRow label="Hạn nộp" value={formatDate(job.deadline)} />
              <InfoRow label="Ngày tạo" value={formatDateTime(job.createdAt)} />
              <InfoRow label="Cập nhật" value={formatDateTime(job.updatedAt)} />
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function JobPreviewView({ job, company }: { job: JobDetailResponse; company: CompanyResponse | null }) {
  const companyName = company?.companyName || job.companyName || "Chưa cập nhật tên công ty";
  const companyStatus = company?.status;
  const isPubliclyVisible = job.status === "ACTIVE" && companyStatus === "VERIFIED";

  return (
    <PageContainer>
      <PageHeader
        title="Xem trước tin tuyển dụng"
        description={`Bản xem trước tin tuyển dụng của ${companyName} • ${job.location || "Chưa cập nhật địa điểm"}`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link to={`/recruiter/jobs/${job.id}`}>
          <Button variant="secondary">Chi tiết quản lý</Button>
        </Link>
        <Link to={`/recruiter/jobs/${job.id}/edit`}>
          <Button icon={<Pencil size={16} />}>{job.status === "DRAFT" ? "Sửa tin" : "Chuẩn bị chỉnh sửa"}</Button>
        </Link>
        <Link to={`/recruiter/jobs/${job.id}/candidate-ranking`}>
          <Button variant="secondary" icon={<Users size={16} />}>Ứng viên phù hợp</Button>
        </Link>
        <Link to="/recruiter/jobs">
          <Button variant="secondary">Quay lại danh sách</Button>
        </Link>
      </div>

      <Card className={`mb-5 ${isPubliclyVisible ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {isPubliclyVisible
                ? "Tin đang hiển thị công khai cho ứng viên"
                : "Tin chưa hiển thị công khai trên cổng tìm việc"}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Trạng thái tin: <strong>{JOB_STATUS_LABELS[job.status]}</strong>
              {companyStatus ? (
                <>
                  {" "}• Trạng thái công ty: <strong>{COMPANY_STATUS_LABELS[companyStatus]}</strong>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={jobStatusTone(job.status)} />
            {companyStatus ? (
              <StatusBadge
                label={COMPANY_STATUS_LABELS[companyStatus]}
                tone={companyStatus === "VERIFIED" ? "success" : companyStatus === "BLOCKED" ? "danger" : "warning"}
              />
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="border-brand-100 bg-brand-50">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-semibold text-brand-700 shadow-sm">
                  {getCompanyInitials(companyName)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">{job.title}</h2>
                    <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={jobStatusTone(job.status)} />
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">{companyName}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatJobMeta(job)} • {job.location || "Chưa cập nhật địa điểm"} • Mức lương: {formatSalary(job)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <TextBlock title="Mô tả công việc" value={job.description} />
          <TextBlock title="Yêu cầu" value={job.requirements} />
          <TextBlock title="Quyền lợi" value={job.benefits} />

          <Card>
            <SectionHeader
              title="Kỹ năng yêu cầu"
              description={job.skills?.length ? `${job.skills.length} kỹ năng kèm mức độ quan trọng và trình độ tối thiểu.` : undefined}
            />
            {job.skills?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {job.skills.map((skill) => (
                  <div key={skill.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-900">{skill.skillName}</strong>
                      {skill.category ? <span className="text-xs text-slate-500">{skill.category}</span> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge
                        label={`Mức độ: ${skill.importance ? SKILL_IMPORTANCE_LABELS[skill.importance] : "Chưa xác định"}`}
                        tone={skill.importance === "REQUIRED" ? "warning" : "neutral"}
                      />
                      <StatusBadge
                        label={`Trình độ: ${skill.minLevel ? SKILL_LEVEL_LABELS[skill.minLevel] : "Chưa xác định"}`}
                        tone="neutral"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Tin chưa có kỹ năng yêu cầu." />
            )}
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Thông tin tin tuyển dụng" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoRow label="Mã tin" value={`#${job.id}`} />
              <InfoRow label="Trạng thái" value={JOB_STATUS_LABELS[job.status]} />
              <InfoRow label="Địa điểm" value={job.location} />
              <InfoRow label="Loại việc" value={job.jobType ? JOB_TYPE_LABELS[job.jobType] : null} />
              <InfoRow label="Hình thức" value={job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : null} />
              <InfoRow label="Mức lương" value={formatSalary(job)} />
              <InfoRow label="Hạn nộp" value={formatDate(job.deadline)} />
              <InfoRow label="Ngày đăng" value={formatDateTime(job.publishedAt)} />
              <InfoRow label="Ngày đóng" value={formatDateTime(job.closedAt)} />
              <InfoRow label="Ngày tạo" value={formatDateTime(job.createdAt)} />
              <InfoRow label="Cập nhật" value={formatDateTime(job.updatedAt)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Thông tin công ty" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoRow label="Tên công ty" value={companyName} />
              <InfoRow label="Xác thực" value={companyStatus ? COMPANY_STATUS_LABELS[companyStatus] : null} />
              <InfoRow label="Lĩnh vực" value={company?.industry} />
              <InfoRow label="Mã số thuế" value={company?.taxCode} />
              <InfoRow label="Địa chỉ" value={company?.address || job.location} />
              <InfoRow label="Website" value={company?.website} />
              <InfoRow label="Điện thoại" value={company?.phone} />
              <InfoRow label="Email" value={company?.email} />
            </div>
            {company?.description ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Giới thiệu công ty</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{company.description}</p>
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function JobFormView({ mode, job, company, onSaved }: { mode: "create" | "edit"; job?: JobDetailResponse; company: CompanyResponse | null; onSaved?: () => void }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFieldSetElement>(null);
  const { showToast } = useToast();
  const [form, setForm] = useState<JobFormState>(() => job ? mapJobToForm(job) : DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (Object.keys(errors).length) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);
  const skillsQuery = useAsyncData(() => getSkills(), []);
  const editing = mode === "edit";
  const verifiedCompany = Boolean(company && isCompanyVerified(company));
  const deadlineMinDate = getNextDateValue(job?.createdAt);
  const initialForm = useMemo(() => job ? mapJobToForm(job) : DEFAULT_FORM, [job]);
  const formChanged = !areJobFormsEqual(form, initialForm);

  useEffect(() => {
    if (job) setForm(mapJobToForm(job));
  }, [job]);

  const selectedSkillIds = useMemo(() => new Set(form.skillIds), [form.skillIds]);

  function update<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSkill(skillId: number, checked: boolean) {
    const value = String(skillId);
    setForm((current) => {
      const skillConfig = { ...current.skillConfig };
      if (checked) skillConfig[value] = skillConfig[value] ?? { ...DEFAULT_SKILL_CONFIG };
      else delete skillConfig[value];
      return {
        ...current,
        skillIds: checked ? Array.from(new Set([...current.skillIds, value])) : current.skillIds.filter((item) => item !== value),
        skillConfig,
      };
    });
  }

  function updateSkillConfig(skillId: number, patch: Partial<SkillConfig>) {
    const key = String(skillId);
    setForm((current) => ({
      ...current,
      skillConfig: { ...current.skillConfig, [key]: { ...(current.skillConfig[key] ?? DEFAULT_SKILL_CONFIG), ...patch } },
    }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "Vui lòng nhập tiêu đề tin.";
    if (form.title.trim().length > maxJobTitleLength) nextErrors.title = `Tiêu đề tối đa ${maxJobTitleLength} ký tự.`;
    if (!form.location) nextErrors.location = "Vui lòng chọn tỉnh/thành.";
    if (!form.description.trim()) nextErrors.description = "Vui lòng nhập mô tả công việc.";
    if (form.description.trim().length > maxJobContentLength) nextErrors.description = `Mô tả công việc tối đa ${maxJobContentLength} ký tự.`;
    if (form.requirements.trim().length > maxJobContentLength) nextErrors.requirements = `Yêu cầu tối đa ${maxJobContentLength} ký tự.`;
    if (form.benefits.trim().length > maxJobContentLength) nextErrors.benefits = `Quyền lợi tối đa ${maxJobContentLength} ký tự.`;
    if (form.salaryMin && !isPositiveIntegerMoney(form.salaryMin)) nextErrors.salaryMin = "Lương tối thiểu phải là số nguyên dương.";
    if (form.salaryMax && !isPositiveIntegerMoney(form.salaryMax)) nextErrors.salaryMax = "Lương tối đa phải là số nguyên dương.";
    if (form.salaryMax && parseMoneyInput(form.salaryMax) > maxSalaryAmount) nextErrors.salaryMax = "Lương tối đa không được vượt quá 1.000.000.000 đồng.";
    if (form.salaryMin && form.salaryMax && parseMoneyInput(form.salaryMin) > parseMoneyInput(form.salaryMax)) nextErrors.salaryMax = "Lương tối đa phải lớn hơn lương tối thiểu.";
    if (!form.deadline) nextErrors.deadline = "Vui lòng chọn hạn nộp.";
    if (form.deadline && form.deadline < deadlineMinDate) nextErrors.deadline = "Hạn nộp phải lớn hơn ngày tạo tin.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save(nextStatus?: JobStatus) {
    if (!validate()) return;
    const targetStatus = nextStatus ?? form.status;
    if (targetStatus !== "DRAFT" && !verifiedCompany) {
      showToast({ type: "error", title: "Công ty chưa được xác thực", message: "Bạn chỉ có thể gửi duyệt tin sau khi admin xác thực công ty." });
      return;
    }
    setSaving(true);
    try {
      const { status, ...content } = buildJobPayload({ ...form, status: targetStatus });
      if (editing && job) {
        if (formChanged || targetStatus === "DRAFT") await updateJob(job.id, content);
        if (status !== job.status) await updateJobStatus(job.id, status);
        onSaved?.();
        showToast({ type: "success", title: "Đã cập nhật tin tuyển dụng" });
      } else {
        const created = await createJob({ ...content, status });
        showToast({
          type: "success",
          title: targetStatus === "DRAFT" ? "Lưu nháp thành công" : "Đã gửi tin chờ duyệt",
          message: targetStatus === "PENDING_APPROVAL" ? "Tin tuyển dụng đã được gửi sang admin chờ duyệt." : "Tin tuyển dụng đã được lưu nháp.",
        });
        navigate(`/recruiter/jobs/${created.id}`);
      }
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu tin tuyển dụng", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title={editing ? "Chỉnh sửa tin tuyển dụng" : "Tạo tin tuyển dụng"} description="Chuẩn bị thông tin vị trí, nội dung và kỹ năng trước khi lưu nháp hoặc gửi duyệt." />
      {Object.keys(errors).length ? <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Vui lòng kiểm tra các trường được đánh dấu bên dưới trước khi lưu tin.</div> : null}
      <fieldset ref={formRef} disabled={saving} aria-busy={saving} className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="1. Thông tin vị trí" description="Tiêu đề, địa điểm và hạn nộp là thông tin bắt buộc. Mức lương sử dụng đơn vị đồng." />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Input label="Tiêu đề" value={form.title} maxLength={maxJobTitleLength} error={errors.title} onChange={(event) => update("title", limitText(event.target.value, maxJobTitleLength))} />
                <FieldCounter value={form.title} max={maxJobTitleLength} />
              </div>
              <Select label="Địa điểm" value={form.location} error={errors.location} onChange={(event) => update("location", event.target.value)} options={[{ label: "Chọn tỉnh/thành", value: "" }, ...VIETNAM_PROVINCES.map((province) => ({ label: province, value: province }))]} />
              <Select label="Loại việc" value={form.jobType} onChange={(event) => update("jobType", event.target.value as JobType)} options={Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              <Select label="Hình thức làm việc" value={form.workingModel} onChange={(event) => update("workingModel", event.target.value as WorkingModel)} options={Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input label="Lương tối thiểu" inputMode="numeric" value={form.salaryMin} error={errors.salaryMin} onChange={(event) => update("salaryMin", formatMoneyInput(event.target.value))} />
              <Input label="Lương tối đa" inputMode="numeric" value={form.salaryMax} error={errors.salaryMax} onChange={(event) => update("salaryMax", formatMoneyInput(event.target.value, maxSalaryAmount))} />
              <Input label="Đơn vị" value="đồng" disabled />
              <Input label="Hạn nộp" type="date" min={deadlineMinDate} value={form.deadline} error={errors.deadline} onChange={(event) => update("deadline", event.target.value)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="2. Nội dung tuyển dụng" description="Mô tả rõ công việc, yêu cầu và quyền lợi để ứng viên dễ đánh giá cơ hội." />
            <div className="grid gap-4">
              <LimitedTextarea label="Mô tả công việc" value={form.description} error={errors.description} onChange={(value) => update("description", value)} />
              <LimitedTextarea label="Yêu cầu" value={form.requirements} error={errors.requirements} onChange={(value) => update("requirements", value)} />
              <LimitedTextarea label="Quyền lợi" value={form.benefits} error={errors.benefits} onChange={(value) => update("benefits", value)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="3. Kỹ năng yêu cầu" description={`Đã chọn ${form.skillIds.length} kỹ năng. Chọn kỹ năng phù hợp với yêu cầu tuyển dụng.`} />
            {skillsQuery.loading ? <LoadingState /> : null}
            {!skillsQuery.loading && skillsQuery.error ? <ErrorState message={skillsQuery.error} /> : null}
            {!skillsQuery.loading && skillsQuery.data?.length === 0 ? <EmptyState message="Chưa có danh mục kỹ năng." /> : null}
            <div className="grid gap-2 md:grid-cols-2">
              {(skillsQuery.data ?? []).map((skill) => (
                <div key={skill.id} className="space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-brand-200 ${selectedSkillIds.has(String(skill.id)) ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:border-brand-200"}`}>
                  <input className="h-4 w-4 shrink-0 accent-brand-600" type="checkbox" checked={selectedSkillIds.has(String(skill.id))} onChange={(event) => toggleSkill(skill.id, event.target.checked)} />
                  <span>
                    <strong className="block text-slate-900">{skill.name}</strong>
                    <span className="text-xs text-slate-500">{skill.category || "Chưa phân loại"}</span>
                  </span>
                </label>
                {selectedSkillIds.has(String(skill.id)) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      label={`Mức độ quan trọng - ${skill.name}`}
                      value={form.skillConfig[String(skill.id)]?.importance ?? ""}
                      onChange={(event) => updateSkillConfig(skill.id, { importance: (event.target.value || null) as SkillImportance | null })}
                      options={[...(form.skillConfig[String(skill.id)]?.importance ? [] : [{ label: "Chưa xác định", value: "" }]), ...Object.entries(SKILL_IMPORTANCE_LABELS).map(([value, label]) => ({ value, label }))]}
                    />
                    <Select
                      label={`Trình độ tối thiểu - ${skill.name}`}
                      value={form.skillConfig[String(skill.id)]?.minLevel ?? ""}
                      onChange={(event) => updateSkillConfig(skill.id, { minLevel: (event.target.value || null) as SkillLevel | null })}
                      options={[...(form.skillConfig[String(skill.id)]?.minLevel ? [] : [{ label: "Chưa xác định", value: "" }]), ...Object.entries(SKILL_LEVEL_LABELS).map(([value, label]) => ({ value, label }))]}
                    />
                  </div>
                ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Lưu và gửi duyệt" description="Lưu nháp để tiếp tục hoàn thiện. Tin gửi duyệt cần được admin phê duyệt trước khi hiển thị tuyển dụng." />
            <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600"><p className="break-words font-semibold text-slate-900">{form.title.trim() || "Tiêu đề chưa nhập"}</p><p>{form.location || "Chưa chọn địa điểm"}</p><p>{form.skillIds.length} kỹ năng đã chọn</p></div>
            {!verifiedCompany ? <EmptyState message={`Trạng thái công ty hiện tại: ${company ? COMPANY_STATUS_LABELS[company.status] : "Chưa cập nhật"}. Chỉ công ty đã xác thực mới được gửi tin sang admin chờ duyệt.`} /> : null}
            <div className="mt-5 flex flex-col gap-2">
              <Button loading={saving} disabled={!verifiedCompany} onClick={() => void save("PENDING_APPROVAL")}>{editing ? "Gửi duyệt" : "Tạo tin"}</Button>
              <Button variant="secondary" loading={saving} onClick={() => void save("DRAFT")}>Lưu nháp</Button>
              <Link to={editing && job ? `/recruiter/jobs/${job.id}` : "/recruiter/jobs"}><Button className="w-full" variant="secondary">Quay lại</Button></Link>
            </div>
          </Card>
        </aside>
      </fieldset>
    </PageContainer>
  );
}

function UnsupportedJobView({ job, title, message }: { job: JobDetailResponse; title: string; message: string }) {
  return (
    <PageContainer>
      <PageHeader title={title} description={job.title} />
      <Card>
        <EmptyState message={message} />
        <div className="mt-4 flex gap-2">
          <Link to={`/recruiter/jobs/${job.id}`}><Button>Xem chi tiết tin</Button></Link>
          <Link to="/recruiter/jobs"><Button variant="secondary">Quay lại danh sách</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}

function LimitedTextarea({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Textarea
        label={label}
        value={value}
        maxLength={maxJobContentLength}
        error={error}
        onChange={(event) => onChange(limitText(event.target.value, maxJobContentLength))}
      />
      <FieldCounter value={value} max={maxJobContentLength} />
    </div>
  );
}

function FieldCounter({ value, max }: { value: string; max: number }) {
  return <p className="mt-1 text-right text-xs text-slate-500">{value.length}/{max} ký tự</p>;
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {value ? <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{value}</p> : <EmptyState message={`Chưa có ${title.toLowerCase()}.`} />}
    </Card>
  );
}

function JobTitleCell({ job }: { job: JobResponse }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-md bg-brand-50 p-2 text-brand-700"><BriefcaseBusiness size={18} /></div>
      <div>
        <p className="font-medium text-slate-900">{job.title}</p>
        <p className="text-xs text-slate-500">{job.companyName} • {job.location || "Chưa cập nhật địa điểm"}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {job.skills?.slice(0, 3).map((skill) => <StatusBadge key={skill.id} label={skill.skillName} />)}
        </div>
      </div>
    </div>
  );
}

function JobActions({ job, canPublish, onUpdateStatus, onClose, disabled = false }: { job: JobResponse; canPublish: boolean; disabled?: boolean; onUpdateStatus: (job: JobResponse, status: JobStatus) => void; onClose: (job: JobResponse) => void }) {
  const actions = getCompanyJobActions(job.status, canPublish ? "VERIFIED" : "PENDING");

  return (
    <div className="flex w-full max-w-sm flex-col gap-2 xl:min-w-64">
      <div className="grid grid-cols-3 gap-2">
        <Link to={`/recruiter/jobs/${job.id}`} className="min-w-0"><Button className="w-full justify-center" variant="secondary" size="sm" icon={<Eye size={14} />}>Xem</Button></Link>
        {actions.edit && !disabled ? <Link to={`/recruiter/jobs/${job.id}/edit`} className="min-w-0"><Button className="w-full justify-center" variant="secondary" size="sm" icon={<Pencil size={14} />}>Sửa</Button></Link> : <Button className="w-full justify-center" variant="secondary" size="sm" disabled title={disabled ? "Chờ xác nhận lại danh sách" : "Đưa tin về nháp trước khi sửa"}>Sửa</Button>}
        {job.status === "DRAFT" ? (
          <Button className="w-full justify-center" size="sm" disabled={disabled || !actions.submit} onClick={() => onUpdateStatus(job, "PENDING_APPROVAL")}>Gửi duyệt</Button>
        ) : actions.withdraw || actions.returnToDraft ? (
          <Button className="w-full justify-center" variant="secondary" size="sm" disabled={disabled} onClick={() => onUpdateStatus(job, "DRAFT")}>{actions.withdraw ? "Rút về nháp" : "Đưa về nháp"}</Button>
        ) : actions.close ? (
          <Button className="w-full justify-center" variant="danger" size="sm" disabled={disabled} icon={<XCircle size={14} />} onClick={() => onClose(job)}>Đóng</Button>
        ) : (
          <span />
        )}
      </div>
      <Link to={`/recruiter/jobs/${job.id}/candidate-ranking`} className="w-full">
        <Button className="w-full justify-center" variant="secondary" size="sm" icon={<Users size={14} />}>Ứng viên phù hợp</Button>
      </Link>
    </div>
  );
}

function CloseJobModal({ job, onClose, onConfirm, pending = false }: { job: JobResponse | null; onClose: () => void; onConfirm: (job: JobResponse) => void; pending?: boolean }) {
  return (
    <Modal open={Boolean(job)} title="Xác nhận đóng tin tuyển dụng" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Bạn có chắc muốn đóng tin <strong>{job?.title}</strong> không?
        </p>
        <p className="text-sm text-slate-500">Tin đã đóng sẽ không còn hiển thị như tin đang tuyển.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>Hủy</Button>
          <Button variant="danger" loading={pending} disabled={pending} onClick={() => job && onConfirm(job)}>Xác nhận đóng</Button>
        </div>
      </div>
    </Modal>
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

async function getJobs(filters: { page: number; keyword: string; status: string; jobType: string; workingModel: string }) {
  const jobsResponse = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/companies/me/jobs", {
      params: {
        page: filters.page,
        size: 8,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
        jobType: filters.jobType || undefined,
        workingModel: filters.workingModel || undefined,
      },
    });
  return { ...jobsResponse.data.data, queryKey: JSON.stringify(filters) };
}

async function getMyCompany() {
  const response = await httpClient.get<ApiResponse<CompanyResponse>>("/companies/me");
  return response.data.data;
}

function createJobAccessError(status: number, message: string) {
  return Object.assign(new Error(message), {
    response: { status, data: { message } },
  });
}

function getCompanyInitials(companyName: string) {
  const letters = companyName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "CT";
}

async function getJobDetail(jobId: number) {
  if (!Number.isInteger(jobId) || jobId <= 0) {
    throw createJobAccessError(404, "Không tìm thấy tin tuyển dụng.");
  }
  const [companyResponse, jobResponse] = await Promise.all([
    httpClient.get<ApiResponse<CompanyResponse>>("/companies/me"),
    httpClient.get<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`),
  ]);
  const company = companyResponse.data?.data;
  const job = jobResponse.data?.data;
  if (!job) {
    throw createJobAccessError(404, "Không tìm thấy tin tuyển dụng.");
  }
  if (!company || job.companyId !== company.id) {
    throw createJobAccessError(403, "Bạn không có quyền xem hoặc thao tác tin tuyển dụng của công ty khác.");
  }
  return { job, company };
}

function isCompanyVerified(company: CompanyResponse) {
  return company.status === "VERIFIED";
}

async function getSkills() {
  const response = await httpClient.get<ApiResponse<PageResponse<SkillResponse>>>("/skills", {
    params: {
      page: 1,
      size: 100,
    },
  });
  return response.data.data.items;
}

async function createJob(payload: ReturnType<typeof buildJobPayload>) {
  const response = await httpClient.post<ApiResponse<JobDetailResponse>>("/jobs", payload);
  return response.data.data;
}

async function updateJob(jobId: number, payload: Omit<ReturnType<typeof buildJobPayload>, "status">) {
  const response = await httpClient.put<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`, payload);
  return response.data.data;
}

async function updateJobStatus(jobId: number, status: JobStatus) {
  const response = await httpClient.patch<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}/status`, { status });
  return response.data.data;
}

async function deleteJob(jobId: number) {
  const response = await httpClient.delete<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`);
  return response.data.data;
}

function mapJobToForm(job: JobDetailResponse): JobFormState {
  return {
    title: job.title || "",
    description: job.description || "",
    requirements: job.requirements || "",
    benefits: job.benefits || "",
    location: job.location || "",
    jobType: job.jobType || "FULL_TIME",
    workingModel: job.workingModel || "ONSITE",
    status: job.status || "DRAFT",
    salaryMin: job.salaryMin == null ? "" : formatMoneyInput(String(job.salaryMin)),
    salaryMax: job.salaryMax == null ? "" : formatMoneyInput(String(job.salaryMax)),
    currency: "đồng",
    deadline: job.deadline ? job.deadline.slice(0, 10) : "",
    skillIds: job.skills?.map((skill) => String(skill.skillId)) ?? [],
    skillConfig: Object.fromEntries((job.skills ?? []).map((skill) => [String(skill.skillId), { importance: skill.importance ?? null, minLevel: skill.minLevel ?? null }])),
  };
}

function areJobFormsEqual(left: JobFormState, right: JobFormState) {
  const normalize = (form: JobFormState) => ({
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
    requirements: form.requirements.trim(),
    benefits: form.benefits.trim(),
    location: form.location.trim(),
    salaryMin: form.salaryMin.trim(),
    salaryMax: form.salaryMax.trim(),
    deadline: form.deadline.trim(),
    skillIds: [...form.skillIds].sort(),
    skillConfig: form.skillIds.slice().sort().map((id) => [id, form.skillConfig[id]?.importance ?? null, form.skillConfig[id]?.minLevel ?? null]),
  });
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function buildJobPayload(form: JobFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    requirements: emptyToNull(form.requirements),
    benefits: emptyToNull(form.benefits),
    location: emptyToNull(form.location),
    jobType: form.jobType,
    workingModel: form.workingModel,
    status: form.status,
    salaryMin: form.salaryMin ? parseMoneyInput(form.salaryMin) : null,
    salaryMax: form.salaryMax ? parseMoneyInput(form.salaryMax) : null,
    currency: "đồng",
    deadline: emptyToNull(form.deadline),
    skills: form.skillIds.map((skillId) => ({
      skillId: Number(skillId),
      importance: (form.skillConfig[skillId] ?? DEFAULT_SKILL_CONFIG).importance,
      minLevel: (form.skillConfig[skillId] ?? DEFAULT_SKILL_CONFIG).minLevel,
    })),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function jobStatusTone(status: JobStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "REJECTED" || status === "CLOSED" || status === "EXPIRED") return "danger" as const;
  return "warning" as const;
}

function formatJobMeta(job: Pick<JobResponse, "jobType" | "workingModel">) {
  const parts = [
    job.jobType ? JOB_TYPE_LABELS[job.jobType] : null,
    job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Chưa cập nhật";
}

function formatSalary(job: Pick<JobResponse, "salaryMin" | "salaryMax" | "currency">) {
  if (job.salaryMin == null && job.salaryMax == null) return "Thỏa thuận";
  const currency = "đồng";
  const min = job.salaryMin != null ? formatMoney(job.salaryMin) : "";
  const max = job.salaryMax != null ? formatMoney(job.salaryMax) : "";
  if (min && max) return `${min} - ${max} ${currency}`;
  return `${min || max} ${currency}`;
}

function formatMoney(value: number | string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return new Intl.NumberFormat("vi-VN").format(numberValue);
}

function formatMoneyInput(value: string, max?: number) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const amount = max == null ? Number(digits) : Math.min(Number(digits), max);
  return new Intl.NumberFormat("vi-VN").format(amount);
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function isPositiveIntegerMoney(value: string) {
  const amount = parseMoneyInput(value);
  return Number.isInteger(amount) && amount > 0;
}

function limitText(value: string, max: number) {
  return value.slice(0, max);
}

function getNextDateValue(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return getDateValue(addDays(new Date(), 1));
  return getDateValue(addDays(date, 1));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
