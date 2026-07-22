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
import { Select } from "../../components/ui/Select";
import { CandidateApplyFlowModal, type ApplyFlowJob } from "../../features/candidate/apply/CandidateApplyFlowModal";
import { CandidateRecommendedJobsPage } from "../../features/candidate/recommendedJobs/CandidateRecommendedJobsPage";
import { CandidateSavedJobsPage } from "../../features/candidate/savedJobs/CandidateSavedJobsPage";
import { JobCard } from "../../features/public/components/JobCard";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";
import type { Job } from "../../types/domain";

interface CandidateJobsPageProps {
  mode?: "list" | "recommended" | "saved" | "saved-searches" | "detail";
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
  importance: string;
  minLevel: string;
}

interface SavedJobResponse {
  savedJobId: number;
  jobId: number;
}

interface ApplicationResponse {
  id: number;
  jobId: number;
  status: "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
}

interface BackendJobResponse {
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

interface BackendJobDetailResponse extends BackendJobResponse {
  description: string | null;
  requirements: string | null;
  benefits: string | null;
}

type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type WorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type CandidateJobsContentMode = "list" | "saved-searches" | "detail";

const pageSize = 6;

const jobTypeOptions: Array<{ label: string; value: "" | JobType }> = [
  { label: "Tất cả", value: "" },
  { label: "Toàn thời gian", value: "FULL_TIME" },
  { label: "Bán thời gian", value: "PART_TIME" },
  { label: "Thực tập", value: "INTERNSHIP" },
  { label: "Hợp đồng", value: "CONTRACT" },
];

const workingModelOptions: Array<{ label: string; value: "" | WorkingModel }> = [
  { label: "Tất cả", value: "" },
  { label: "Onsite", value: "ONSITE" },
  { label: "Hybrid", value: "HYBRID" },
  { label: "Remote", value: "REMOTE" },
];

export function CandidateJobsPage({ mode = "list" }: CandidateJobsPageProps) {
  if (mode === "recommended") {
    return <CandidateRecommendedJobsPage />;
  }

  if (mode === "saved") {
    return <CandidateSavedJobsPage />;
  }

  return <CandidateJobsContent mode={mode} />;
}

function CandidateJobsContent({ mode }: { mode: CandidateJobsContentMode }) {
  const { jobId } = useParams();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState<JobType | "">("");
  const [workingModel, setWorkingModel] = useState<WorkingModel | "">("");
  const [savedReloadKey, setSavedReloadKey] = useState(0);

  const jobsQuery = useAsyncData(() => getJobs({
    page,
    size: pageSize,
    keyword,
    location,
    jobType,
    workingModel,
    status: "ACTIVE",
  }), [page, keyword, location, jobType, workingModel]);
  const savedJobsQuery = useAsyncData(() => getSavedJobs(), [savedReloadKey]);

  if (mode === "saved-searches") {
    return <SavedSearchesPage />;
  }

  if (mode === "detail" && jobId) {
    return <CandidateJobDetail jobId={jobId} />;
  }

  const result = jobsQuery.data;
  const jobs = result?.items.map(mapJobListItem) ?? [];
  const locations = getLocationOptions(result?.items ?? []);
  const savedJobIds = new Set((savedJobsQuery.data?.items ?? []).map((item) => String(item.jobId)));

  async function toggleSavedJob(job: Job) {
    const saved = savedJobIds.has(job.id);
    try {
      if (saved) {
        await removeSavedJobById(job.id);
        showToast({ type: "success", title: "Đã bỏ lưu việc làm", message: `${job.title} đã được xóa khỏi danh sách việc làm đã lưu.` });
      } else {
        await saveJobById(job.id);
        showToast({ type: "success", title: "Đã lưu việc làm", message: `${job.title} đã được thêm vào danh sách việc làm đã lưu.` });
      }
      setSavedReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật việc đã lưu", message: getApiErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Tìm việc"
        description="Danh sách việc làm đang hoạt động từ API backend."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-5">
          <Input label="Từ khóa" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="Vị trí, kỹ năng..." />
          <Select label="Địa điểm" value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...locations.map((value) => ({ label: value, value }))]} />
          <Select label="Loại hình" value={jobType} onChange={(event) => { setJobType(event.target.value as JobType | ""); setPage(1); }} options={jobTypeOptions} />
          <Select label="Hình thức" value={workingModel} onChange={(event) => { setWorkingModel(event.target.value as WorkingModel | ""); setPage(1); }} options={workingModelOptions} />
          <div className="self-end text-sm text-slate-600">{result?.totalItems ?? 0} kết quả</div>
        </div>
      </Card>

      {jobsQuery.loading ? <LoadingState /> : null}
      {jobsQuery.error ? <ErrorState message={jobsQuery.error} /> : null}
      {!jobsQuery.loading && !jobsQuery.error && jobs.length === 0 ? <EmptyState message="Không có việc làm phù hợp." /> : null}

      <div className="grid gap-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} detailPath={`/candidate/jobs/${job.id}`} saved={savedJobIds.has(job.id)} onToggleSave={() => void toggleSavedJob(job)} />
        ))}
      </div>

      <div className="mt-5">
        <Pagination page={result?.page ?? page} totalPages={result?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </PageContainer>
  );
}

function CandidateJobDetail({ jobId }: { jobId: string }) {
  const { showToast } = useToast();
  const detailQuery = useAsyncData(() => getJobDetail(jobId), [jobId]);
  const selectedJob = detailQuery.data;
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const savedJobsQuery = useAsyncData(() => getSavedJobs(), [savedReloadKey]);
  const [applicationsReloadKey, setApplicationsReloadKey] = useState(0);
  const applicationsQuery = useAsyncData(() => getMyApplications(), [applicationsReloadKey]);
  const [applyJob, setApplyJob] = useState<ApplyFlowJob | null>(null);
  const isSaved = Boolean(savedJobsQuery.data?.items.some((item) => String(item.jobId) === jobId));
  const appliedApplication = applicationsQuery.data?.find((application) => String(application.jobId) === jobId);

  if (detailQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (detailQuery.error || !selectedJob) {
    return (
      <PageContainer>
        <ErrorState message={detailQuery.error ?? "Không thể tải chi tiết việc làm."} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={selectedJob.title} description="Chi tiết việc làm từ API backend." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader
              title={selectedJob.companyName}
              description={`${selectedJob.location || "Chưa cập nhật"} • ${formatSalary(selectedJob)} • ${getWorkingModelLabel(selectedJob.workingModel)}`}
            />
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={getJobTypeLabel(selectedJob.jobType)} />
              <StatusBadge label={getWorkingModelLabel(selectedJob.workingModel)} />
              <StatusBadge label={getStatusLabel(selectedJob.status)} tone={selectedJob.status === "ACTIVE" ? "success" : "neutral"} />
              {selectedJob.skills.map((skill) => <StatusBadge key={skill.id} label={skill.skillName} />)}
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedJob.description || "Chưa có mô tả công việc."}</p>
          </Card>

          <Card>
            <SectionHeader title="Yêu cầu và quyền lợi" />
            <div className="grid gap-4 md:grid-cols-2">
              <TextList title="Yêu cầu" value={selectedJob.requirements} emptyText="Chưa có yêu cầu." />
              <TextList title="Quyền lợi" value={selectedJob.benefits} emptyText="Chưa có quyền lợi." />
            </div>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Thông tin tuyển dụng" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoRow label="Công ty" value={selectedJob.companyName} />
              <InfoRow label="Địa điểm" value={selectedJob.location || "Chưa cập nhật"} />
              <InfoRow label="Loại hình" value={getJobTypeLabel(selectedJob.jobType)} />
              <InfoRow label="Hình thức" value={getWorkingModelLabel(selectedJob.workingModel)} />
              <InfoRow label="Mức lương" value={formatSalary(selectedJob)} />
              <InfoRow label="Hạn ứng tuyển" value={formatDate(selectedJob.deadline)} />
              <InfoRow label="Ngày đăng" value={formatDateTime(selectedJob.publishedAt || selectedJob.createdAt)} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {appliedApplication ? (
                <Link to={`/candidate/applications/${appliedApplication.id}`}>
                  <Button>Đã ứng tuyển</Button>
                </Link>
              ) : (
                <Button
                  onClick={() => setApplyJob({
                    id: String(selectedJob.id),
                    title: selectedJob.title,
                    companyName: selectedJob.companyName,
                    salary: formatSalary(selectedJob),
                    location: selectedJob.location || "Chưa cập nhật",
                    workMode: getWorkingModelLabel(selectedJob.workingModel),
                  })}
                  disabled={selectedJob.status !== "ACTIVE"}
                >
                  Ứng tuyển
                </Button>
              )}
              <Button variant="secondary" onClick={() => void toggleDetailSavedJob(selectedJob, isSaved, setSavedReloadKey, showToast)}>
                {isSaved ? "Bỏ lưu việc làm" : "Lưu việc làm"}
              </Button>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Kỹ năng yêu cầu" />
            {selectedJob.skills.length ? (
              <div className="grid gap-2">
                {selectedJob.skills.map((skill) => (
                  <div key={skill.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div className="font-medium text-slate-900">{skill.skillName}</div>
                    <div className="mt-1 text-xs text-slate-500">{skill.category || "Chưa phân loại"} • {skill.importance} • {skill.minLevel}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="Chưa có kỹ năng yêu cầu." />
            )}
          </Card>
        </aside>
      </div>
      <CandidateApplyFlowModal
        job={applyJob}
        onClose={() => {
          setApplyJob(null);
          setApplicationsReloadKey((current) => current + 1);
        }}
      />
    </PageContainer>
  );
}

function SavedSearchesPage() {
  return (
    <PageContainer>
      <PageHeader title="Tìm kiếm đã lưu" description="Backend hiện chưa có API lưu bộ lọc tìm kiếm cho ứng viên." />
      <Card>
        <EmptyState message="Chưa có dữ liệu tìm kiếm đã lưu từ API." />
        <Link to="/candidate/jobs" className="mt-4 inline-flex">
          <Button variant="secondary">Quay lại tìm việc</Button>
        </Link>
      </Card>
    </PageContainer>
  );
}

async function getJobs(params: {
  page: number;
  size: number;
  keyword: string;
  location: string;
  jobType: JobType | "";
  workingModel: WorkingModel | "";
  status: JobStatus;
}) {
  const response = await httpClient.get<ApiResponse<PageResponse<BackendJobResponse>>>("/jobs", {
    params: {
      page: params.page,
      size: params.size,
      keyword: emptyToUndefined(params.keyword),
      location: emptyToUndefined(params.location),
      jobType: emptyToUndefined(params.jobType),
      workingModel: emptyToUndefined(params.workingModel),
      status: params.status,
    },
  });
  return response.data.data;
}

async function getJobDetail(jobId: string) {
  const response = await httpClient.get<ApiResponse<BackendJobDetailResponse>>(`/jobs/${jobId}`);
  return response.data.data;
}

async function getMyApplications() {
  const response = await httpClient.get<ApiResponse<ApplicationResponse[]>>("/students/me/applications");
  return response.data.data;
}

async function getSavedJobs() {
  return getAllSavedJobs(1, []);
}

async function getAllSavedJobs(page: number, items: SavedJobResponse[]): Promise<PageResponse<SavedJobResponse>> {
  const response = await httpClient.get<ApiResponse<PageResponse<SavedJobResponse>>>("/students/me/saved-jobs", {
    params: { page, size: 100 },
  });
  const data = response.data.data;
  const nextItems = [...items, ...data.items];
  if (data.page < data.totalPages) return getAllSavedJobs(page + 1, nextItems);
  return { ...data, items: nextItems };
}

async function saveJobById(jobId: string | number) {
  await httpClient.post<ApiResponse<unknown>>(`/students/me/saved-jobs/${jobId}`);
}

async function removeSavedJobById(jobId: string | number) {
  await httpClient.delete<ApiResponse<null>>(`/students/me/saved-jobs/${jobId}`);
}

async function toggleDetailSavedJob(
  job: BackendJobDetailResponse,
  isSaved: boolean,
  setSavedReloadKey: (updater: (current: number) => number) => void,
  showToast: (payload: { type: "success" | "error"; title: string; message?: string }) => void,
) {
  try {
    if (isSaved) {
      await removeSavedJobById(job.id);
      showToast({ type: "success", title: "Đã bỏ lưu việc làm", message: `${job.title} đã được xóa khỏi danh sách việc làm đã lưu.` });
    } else {
      await saveJobById(job.id);
      showToast({ type: "success", title: "Đã lưu việc làm", message: `${job.title} đã được thêm vào danh sách việc làm đã lưu.` });
    }
    setSavedReloadKey((current) => current + 1);
  } catch (error) {
    showToast({ type: "error", title: "Không thể cập nhật việc đã lưu", message: getApiErrorMessage(error) });
  }
}

function mapJobListItem(job: BackendJobResponse): Job {
  return {
    id: String(job.id),
    title: job.title,
    companyId: String(job.companyId),
    companyName: job.companyName,
    location: job.location || "Chưa cập nhật",
    salary: formatSalary(job),
    industry: "",
    experience: "",
    jobType: getJobTypeLabel(job.jobType),
    workMode: mapWorkingModel(job.workingModel),
    level: "",
    skills: job.skills.map((skill) => skill.skillName),
    description: "",
    requirements: [],
    benefits: [],
    deadline: formatDate(job.deadline),
    postedAt: formatDateTime(job.publishedAt || job.createdAt),
    status: mapJobStatus(job.status),
    views: 0,
    applicants: 0,
  };
}

function TextList({ title, value, emptyText }: { title: string; value: string | null; emptyText: string }) {
  const items = splitText(value);
  return (
    <div>
      <h2 className="mb-3 font-semibold text-slate-950">{title}</h2>
      {items.length ? (
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">{emptyText}</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <strong className="max-w-[190px] text-right text-slate-900">{value}</strong>
    </div>
  );
}

function getLocationOptions(jobs: BackendJobResponse[]) {
  return Array.from(new Set(jobs.map((job) => job.location).filter((value): value is string => Boolean(value))));
}

function formatSalary(job: Pick<BackendJobResponse, "salaryMin" | "salaryMax" | "currency">) {
  const currency = "đồng";
  const min = toNumber(job.salaryMin);
  const max = toNumber(job.salaryMax);
  if (min && max) return `${formatMoney(min)} - ${formatMoney(max)} ${currency}`;
  if (min) return `Từ ${formatMoney(min)} ${currency}`;
  if (max) return `Đến ${formatMoney(max)} ${currency}`;
  return "Thỏa thuận";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function getJobTypeLabel(value: JobType | null) {
  if (value === "FULL_TIME") return "Toàn thời gian";
  if (value === "PART_TIME") return "Bán thời gian";
  if (value === "INTERNSHIP") return "Thực tập";
  if (value === "CONTRACT") return "Hợp đồng";
  return "Chưa cập nhật";
}

function getWorkingModelLabel(value: WorkingModel | null) {
  if (value === "ONSITE") return "Onsite";
  if (value === "HYBRID") return "Hybrid";
  if (value === "REMOTE") return "Remote";
  return "Chưa cập nhật";
}

function getStatusLabel(value: JobStatus) {
  if (value === "ACTIVE") return "Đang tuyển";
  if (value === "PENDING_APPROVAL") return "Chờ duyệt";
  if (value === "DRAFT") return "Nháp";
  if (value === "CLOSED") return "Đã đóng";
  if (value === "REJECTED") return "Bị từ chối";
  if (value === "EXPIRED") return "Hết hạn";
  return value;
}

function mapWorkingModel(value: WorkingModel | null): Job["workMode"] {
  if (value === "REMOTE") return "Remote";
  if (value === "HYBRID") return "Hybrid";
  return "Onsite";
}

function mapJobStatus(value: JobStatus): Job["status"] {
  if (value === "ACTIVE") return "published";
  if (value === "DRAFT") return "draft";
  if (value === "REJECTED") return "rejected";
  if (value === "EXPIRED") return "expired";
  if (value === "CLOSED") return "closed";
  return "pending";
}

function splitText(value: string | null) {
  return (value ?? "")
    .split(/\r?\n|[;•]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: number | string | null) {
  if (value === null) return 0;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function emptyToUndefined(value: string) {
  return value.trim() || undefined;
}

function getApiErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Backend trả về lỗi. Vui lòng thử lại.";
  }
  return "Không thể kết nối backend. Vui lòng thử lại.";
}
