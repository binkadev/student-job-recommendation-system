import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Clock,
  DollarSign,
  Filter,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
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
import { getLatestApplication, useAppliedJobs } from "../../features/public/jobs/useAppliedJobs";

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

interface SavedSearchResponse {
  id: number;
  name: string;
  keyword: string | null;
  location: string | null;
  jobType: JobType | null;
  workingModel: WorkingModel | null;
  createdAt: string;
  updatedAt: string;
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

const vietnamProvinceOptions = [
  "An Giang",
  "Bắc Ninh",
  "Cà Mau",
  "Cao Bằng",
  "Cần Thơ",
  "Đà Nẵng",
  "Đắk Lắk",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Nội",
  "Hà Tĩnh",
  "Hải Phòng",
  "Huế",
  "Hưng Yên",
  "Khánh Hòa",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Nghệ An",
  "Ninh Bình",
  "Phú Thọ",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sơn La",
  "Tây Ninh",
  "Thái Nguyên",
  "Thanh Hóa",
  "TP. Hồ Chí Minh",
  "Tuyên Quang",
  "Vĩnh Long",
].map((label) => ({
  label,
  value: label === "TP. Hồ Chí Minh" ? "Ho Chi Minh City" : label,
}));

export function CandidateJobsPage({ mode = "list" }: CandidateJobsPageProps) {
  if (mode === "recommended") {
    return <CandidateRecommendedJobsPage />;
  }

  if (mode === "saved") {
    return <CandidateSavedJobsPage />;
  }

  if (mode === "saved-searches") {
    return <SavedSearchesPage />;
  }

  return <CandidateJobsContent mode={mode} />;
}

function CandidateJobsContent({ mode }: { mode: CandidateJobsContentMode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { getApplicationState } = useAppliedJobs();
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState(() => searchParams.get("keyword") ?? "");
  const [location, setLocation] = useState(() => searchParams.get("location") ?? "");
  const [jobType, setJobType] = useState<JobType | "">(() => parseJobTypeParam(searchParams.get("jobType")));
  const [workingModel, setWorkingModel] = useState<WorkingModel | "">(() => parseWorkingModelParam(searchParams.get("workingModel")));
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    setKeyword(params.get("keyword") ?? "");
    setLocation(params.get("location") ?? "");
    setJobType(parseJobTypeParam(params.get("jobType")));
    setWorkingModel(parseWorkingModelParam(params.get("workingModel")));
    setPage(1);
  }, [searchParamsKey]);

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

  useGSAP(
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!containerRef.current) return;

      gsap.fromTo(
        ".nm-reveal",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: "power2.out",
        },
      );
    },
    { scope: containerRef.current ? containerRef : undefined, dependencies: [jobsQuery.loading, jobsQuery.data?.totalItems] },
  );

  if (mode === "saved-searches") {
    return <SavedSearchesPage />;
  }

  if (mode === "detail" && jobId) {
    return <CandidateJobDetail jobId={jobId} />;
  }

  const result = jobsQuery.data;
  const jobs = (result?.items ?? []).map(mapJobListItem);
  const totalResults = result?.totalItems ?? 0;
  const locations = location && !vietnamProvinceOptions.some((option) => option.value === location)
    ? [{ label: location, value: location }, ...vietnamProvinceOptions]
    : vietnamProvinceOptions;
  const savedJobIds = new Set((savedJobsQuery.data?.items ?? []).map((item) => String(item.jobId)));
  const hasActiveFilter = Boolean(keyword.trim() || location.trim() || jobType || workingModel);
  const saveCurrentSearchPath = buildSavedSearchCreatePath({ keyword, location, jobType, workingModel });

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
      <div ref={containerRef} className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="nm-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <Search className="h-3.5 w-3.5 text-teal-300" />
                <span>KHÁM PHÁ VIỆC LÀM IT</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Tìm kiếm việc làm phù hợp
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Khám phá hàng trăm cơ hội việc làm CNTT đang mở tuyển với bộ lọc địa điểm, hình thức làm việc và công nghệ.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasActiveFilter ? (
                <Link to={saveCurrentSearchPath}>
                  <Button
                    variant="secondary"
                    className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                    icon={<Bookmark className="h-4 w-4" />}
                  >
                    Lưu bộ lọc hiện tại
                  </Button>
                </Link>
              ) : null}
              <Link to="/candidate/jobs/saved-searches">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  Tìm kiếm đã lưu
                </Button>
              </Link>
              <Link to="/candidate/jobs/recommended">
                <Button
                  className="rounded-xl bg-[#D4F933] font-semibold text-[#0C111C] shadow-sm hover:bg-[#C2E82E]"
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Việc làm gợi ý
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Filter Card */}
        <Card className="nm-reveal border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              <span>Bộ lọc tìm kiếm</span>
            </div>
            <div className="text-xs font-semibold normal-case text-slate-600">
              <span className="font-mono font-bold text-[#134B43]">{totalResults}</span> việc làm đang mở tuyển
            </div>
          </div>

          <div className="mt-3 grid gap-3.5 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.2fr)_minmax(180px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)]">
            <Input
              label="Từ khóa"
              value={keyword}
              onChange={(event) => { setKeyword(event.target.value); setPage(1); }}
              placeholder="Vị trí, kỹ năng, công nghệ..."
            />
            <Select
              label="Địa điểm"
              value={location}
              onChange={(event) => { setLocation(event.target.value); setPage(1); }}
              options={[{ label: "Tất cả", value: "" }, ...locations]}
            />
            <Select
              label="Loại hình"
              value={jobType}
              onChange={(event) => { setJobType(event.target.value as JobType | ""); setPage(1); }}
              options={jobTypeOptions}
            />
            <Select
              label="Hình thức"
              value={workingModel}
              onChange={(event) => { setWorkingModel(event.target.value as WorkingModel | ""); setPage(1); }}
              options={workingModelOptions}
            />
          </div>
        </Card>

        {/* Loading / Error States */}
        {jobsQuery.loading ? <LoadingState /> : null}
        {jobsQuery.error ? <ErrorState message={jobsQuery.error} /> : null}

        {/* Empty State */}
        {!jobsQuery.loading && !jobsQuery.error && jobs.length === 0 ? (
          <Card className="nm-reveal border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
            <EmptyState message="Không có việc làm phù hợp." />
          </Card>
        ) : null}

        {/* Jobs List */}
        {!jobsQuery.loading && !jobsQuery.error && jobs.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="nm-reveal">
                  <JobCard
                    job={job}
                    detailPath={`/candidate/jobs/${job.id}`}
                    detailLabel={getApplicationState(job.id) === "REJECTED_CAN_REAPPLY" ? "Ứng tuyển lại" : "Xem chi tiết"}
                    applicationNote={getApplicationState(job.id) === "WITHDRAWN_BLOCKED" ? "Đơn đã rút không thể ứng tuyển lại theo chính sách hiện tại." : undefined}
                    saved={savedJobIds.has(job.id)}
                    onToggleSave={() => void toggleSavedJob(job)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <Pagination page={result?.page ?? page} totalPages={result?.totalPages ?? 1} onPageChange={setPage} />
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

function CandidateJobDetail({ jobId }: { jobId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const detailQuery = useAsyncData(() => getJobDetail(jobId), [jobId]);
  const selectedJob = detailQuery.data;
  const [savedReloadKey, setSavedReloadKey] = useState(0);
  const savedJobsQuery = useAsyncData(() => getSavedJobs(), [savedReloadKey]);
  const { applications, canApply, getApplyButtonLabel, getApplicationState, syncError, syncing, refreshAppliedJobs } = useAppliedJobs();
  const [applyJob, setApplyJob] = useState<ApplyFlowJob | null>(null);
  const isSaved = Boolean(savedJobsQuery.data?.items.some((item) => String(item.jobId) === jobId));
  const appliedApplication = getLatestApplication(applications, jobId);

  useGSAP(
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!containerRef.current) return;

      gsap.fromTo(
        ".nm-reveal",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: "power2.out",
        },
      );
    },
    { scope: containerRef.current ? containerRef : undefined, dependencies: [detailQuery.loading, Boolean(selectedJob)] },
  );

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
      <div ref={containerRef} className="space-y-6">
        {/* Header Bento Card */}
        <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Link
                to="/candidate/jobs"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#134B43] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Quay lại tìm việc</span>
              </Link>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
                {selectedJob.title}
              </h1>

              <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{selectedJob.companyName}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <StatusBadge label={getJobTypeLabel(selectedJob.jobType)} />
                <StatusBadge label={getWorkingModelLabel(selectedJob.workingModel)} />
                <StatusBadge
                  label={getStatusLabel(selectedJob.status)}
                  tone={selectedJob.status === "ACTIVE" ? "success" : "neutral"}
                />
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  <span>{selectedJob.location || "Chưa cập nhật"}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-[#134B43]">
                  <DollarSign className="h-3 w-3 text-[#134B43]" />
                  <span>{formatSalary(selectedJob)}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
              <Button
                className="rounded-xl bg-[#134B43] font-medium text-white hover:bg-[#0F3E37] shadow-sm"
                onClick={() => setApplyJob({
                  id: String(selectedJob.id),
                  title: selectedJob.title,
                  companyName: selectedJob.companyName,
                  salary: formatSalary(selectedJob),
                  location: selectedJob.location || "Chưa cập nhật",
                  workMode: getWorkingModelLabel(selectedJob.workingModel),
                })}
                disabled={selectedJob.status !== "ACTIVE" || Boolean(selectedJob.deadline && selectedJob.deadline < new Date().toLocaleDateString("en-CA")) || !canApply(jobId)}
              >
                {getApplyButtonLabel(jobId)}
              </Button>

              {appliedApplication ? (
                <Link to={`/candidate/applications/${appliedApplication.id}`}>
                  <Button variant="secondary" className="rounded-xl border-slate-200">
                    Xem đơn gần nhất
                  </Button>
                </Link>
              ) : null}

              <Button
                variant="secondary"
                className="rounded-xl border-slate-200"
                icon={<Bookmark className="h-4 w-4" />}
                onClick={() => void toggleDetailSavedJob(selectedJob, isSaved, setSavedReloadKey, showToast)}
              >
                {isSaved ? "Bỏ lưu việc làm" : "Lưu việc làm"}
              </Button>
            </div>
          </div>
        </Card>

        {/* 2-Column Content */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Main Content */}
          <div className="space-y-6">
            <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
              <SectionHeader title="Mô tả công việc" />
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {selectedJob.description || "Chưa có mô tả công việc."}
              </p>
            </Card>

            <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
              <SectionHeader title="Yêu cầu và quyền lợi" />
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <TextList title="Yêu cầu" value={selectedJob.requirements} emptyText="Chưa có yêu cầu." />
                <TextList title="Quyền lợi" value={selectedJob.benefits} emptyText="Chưa có quyền lợi." />
              </div>
            </Card>
          </div>

          {/* Sticky Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="nm-reveal border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
              <SectionHeader title="Thông tin tuyển dụng" />
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <InfoRow label="Công ty" value={selectedJob.companyName} />
                <InfoRow label="Địa điểm" value={selectedJob.location || "Chưa cập nhật"} />
                <InfoRow label="Loại hình" value={getJobTypeLabel(selectedJob.jobType)} />
                <InfoRow label="Hình thức" value={getWorkingModelLabel(selectedJob.workingModel)} />
                <InfoRow label="Mức lương" value={formatSalary(selectedJob)} />
                <InfoRow label="Hạn ứng tuyển" value={formatDate(selectedJob.deadline)} />
                <InfoRow label="Ngày đăng" value={formatDateTime(selectedJob.publishedAt || selectedJob.createdAt)} />
              </div>

              {getApplicationState(jobId) === "WITHDRAWN_BLOCKED" ? (
                <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs font-medium text-amber-800">
                  Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.
                </div>
              ) : null}

              {syncError ? (
                <div className="mt-4 space-y-2">
                  <ErrorState message={syncError} />
                  <Button variant="secondary" size="sm" className="w-full rounded-xl" disabled={syncing} onClick={() => void refreshAppliedJobs()}>
                    Tải lại trạng thái ứng tuyển
                  </Button>
                </div>
              ) : null}
            </Card>

            <Card className="nm-reveal border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
              <SectionHeader title="Kỹ năng yêu cầu" />
              <div className="mt-4">
                {selectedJob.skills.length ? (
                  <div className="grid gap-2.5">
                    {selectedJob.skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm transition-all hover:bg-slate-100/60"
                      >
                        <div className="font-semibold text-slate-900">{skill.skillName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {skill.category || "Chưa phân loại"} • {skill.importance} • {skill.minLevel}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="Chưa có kỹ năng yêu cầu." />
                )}
              </div>
            </Card>
          </aside>
        </div>

        <CandidateApplyFlowModal
          job={applyJob}
          onClose={() => {
            setApplyJob(null);
            void refreshAppliedJobs();
          }}
        />
      </div>
    </PageContainer>
  );
}

function SavedSearchesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(() => ({
    name: "",
    keyword: searchParams.get("keyword") ?? "",
    location: searchParams.get("location") ?? "",
    jobType: parseJobTypeParam(searchParams.get("jobType")),
    workingModel: parseWorkingModelParam(searchParams.get("workingModel")),
  }));
  const savedSearchesQuery = useAsyncData(() => getSavedSearches(), [reloadKey]);
  const savedSearches = savedSearchesQuery.data ?? [];

  useGSAP(
    () => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!containerRef.current) return;

      gsap.fromTo(
        ".nm-reveal",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
          ease: "power2.out",
        },
      );
    },
    { scope: containerRef.current ? containerRef : undefined, dependencies: [savedSearchesQuery.loading, savedSearches.length, editingId] },
  );

  function applySavedSearch(search: SavedSearchResponse) {
    navigate(buildSavedSearchJobPath(search));
  }

  function editSavedSearch(search: SavedSearchResponse) {
    setEditingId(search.id);
    setForm({
      name: search.name,
      keyword: search.keyword ?? "",
      location: search.location ?? "",
      jobType: search.jobType ?? "",
      workingModel: search.workingModel ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", keyword: "", location: "", jobType: "", workingModel: "" });
  }

  async function saveSearch() {
    if (!form.name.trim()) {
      showToast({ type: "error", title: "Vui lòng nhập tên bộ lọc" });
      return;
    }
    try {
      if (editingId) {
        await updateSavedSearch(editingId, form);
        showToast({ type: "success", title: "Đã cập nhật tìm kiếm đã lưu" });
      } else {
        await createSavedSearch(form);
        showToast({ type: "success", title: "Đã lưu tìm kiếm" });
      }
      resetForm();
      setReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu tìm kiếm", message: getApiErrorMessage(error) });
    }
  }

  async function deleteSearch(searchId: number) {
    try {
      await deleteSavedSearch(searchId);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã xóa tìm kiếm đã lưu" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể xóa tìm kiếm", message: getApiErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <div ref={containerRef} className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="nm-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <Filter className="h-3.5 w-3.5 text-teal-300" />
                <span>BỘ LỌC TÌM KIẾM ĐÃ LƯU</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Bộ lọc tìm kiếm đã lưu
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Quản lý các bộ lọc tìm việc bạn đã lưu để nhanh chóng áp dụng và theo dõi các cơ hội việc làm mới nhất.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/candidate/jobs">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  Quay lại tìm việc
                </Button>
              </Link>
              <Link to="/candidate/jobs/saved">
                <Button
                  className="rounded-xl bg-[#D4F933] font-semibold text-[#0C111C] shadow-sm hover:bg-[#C2E82E]"
                  icon={<Bookmark className="h-4 w-4" />}
                >
                  Việc làm đã lưu
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 2-Column Grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left Column: Saved Searches List */}
          <div className="space-y-4">
            <Card className="nm-reveal border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-950">Danh sách tìm kiếm đã lưu</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span className="font-mono font-bold text-[#134B43]">{savedSearches.length}</span> bộ lọc đã thiết lập
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {savedSearchesQuery.loading ? <LoadingState /> : null}
                {savedSearchesQuery.error ? <ErrorState message={savedSearchesQuery.error} /> : null}
                {!savedSearchesQuery.loading && !savedSearchesQuery.error && savedSearches.length === 0 ? (
                  <div className="py-6">
                    <EmptyState message="Chưa có tìm kiếm đã lưu." />
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="group rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4.5 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h2 className="text-base font-bold text-slate-950 group-hover:text-[#134B43] transition-colors">
                            {search.name}
                          </h2>
                          <p className="text-xs leading-relaxed text-slate-600 font-medium">
                            {formatSavedSearchSummary(search)}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span>Cập nhật: {formatDateTime(search.updatedAt)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 shrink-0">
                          <Button
                            size="sm"
                            className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
                            onClick={() => applySavedSearch(search)}
                          >
                            Áp dụng bộ lọc
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                            onClick={() => editSavedSearch(search)}
                          >
                            Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="rounded-xl text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100"
                            onClick={() => void deleteSearch(search.id)}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Form Card */}
          <div className="space-y-4">
            <Card className="nm-reveal sticky top-6 border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
              <div className="border-b border-slate-100 pb-3">
                <SectionHeader
                  title={editingId ? "Cập nhật bộ lọc" : "Lưu bộ lọc mới"}
                  description={
                    editingId
                      ? "Chỉnh sửa các tiêu chí và tên của bộ lọc đã lưu."
                      : "Lưu lại tổ hợp từ khóa, địa điểm và hình thức làm việc ưa thích."
                  }
                />
              </div>

              <div className="mt-4 grid gap-3.5">
                <Input
                  label="Tên bộ lọc"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Ví dụ: Backend Java Hybrid"
                />
                <Input
                  label="Từ khóa"
                  value={form.keyword}
                  onChange={(event) => setForm({ ...form, keyword: event.target.value })}
                  placeholder="Kỹ năng, vị trí hoặc công nghệ"
                />
                <Input
                  label="Địa điểm"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Tỉnh / Thành phố"
                />
                <Select
                  label="Loại hình"
                  value={form.jobType}
                  onChange={(event) => setForm({ ...form, jobType: event.target.value as JobType | "" })}
                  options={jobTypeOptions}
                />
                <Select
                  label="Hình thức"
                  value={form.workingModel}
                  onChange={(event) => setForm({ ...form, workingModel: event.target.value as WorkingModel | "" })}
                  options={workingModelOptions}
                />

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    className="flex-1 rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
                    onClick={() => void saveSearch()}
                  >
                    {editingId ? "Cập nhật" : "Lưu tìm kiếm"}
                  </Button>
                  {editingId ? (
                    <Button variant="secondary" className="rounded-xl" onClick={resetForm}>
                      Hủy sửa
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <Link to="/candidate/jobs" className="block w-full">
                  <Button variant="secondary" className="w-full rounded-xl">
                    Quay lại tìm việc
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function buildSavedSearchJobPath(search: Pick<SavedSearchResponse, "keyword" | "location" | "jobType" | "workingModel">) {
  const params = new URLSearchParams();
  if (search.keyword?.trim()) params.set("keyword", search.keyword.trim());
  if (search.location?.trim()) params.set("location", search.location.trim());
  if (search.jobType) params.set("jobType", search.jobType);
  if (search.workingModel) params.set("workingModel", search.workingModel);
  const query = params.toString();
  return query ? `/candidate/jobs?${query}` : "/candidate/jobs";
}

function buildSavedSearchCreatePath(filters: { keyword: string; location: string; jobType: JobType | ""; workingModel: WorkingModel | "" }) {
  const params = new URLSearchParams();
  if (filters.keyword.trim()) params.set("keyword", filters.keyword.trim());
  if (filters.location.trim()) params.set("location", filters.location.trim());
  if (filters.jobType) params.set("jobType", filters.jobType);
  if (filters.workingModel) params.set("workingModel", filters.workingModel);
  const query = params.toString();
  return query ? `/candidate/jobs/saved-searches?${query}` : "/candidate/jobs/saved-searches";
}

function parseJobTypeParam(value: string | null): JobType | "" {
  if (value === "FULL_TIME" || value === "PART_TIME" || value === "INTERNSHIP" || value === "CONTRACT") {
    return value;
  }
  return "";
}

function parseWorkingModelParam(value: string | null): WorkingModel | "" {
  if (value === "ONSITE" || value === "HYBRID" || value === "REMOTE") {
    return value;
  }
  return "";
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

async function getSavedSearches() {
  const response = await httpClient.get<ApiResponse<SavedSearchResponse[]>>("/students/me/saved-searches");
  return response.data.data;
}

async function createSavedSearch(form: { name: string; keyword: string; location: string; jobType: JobType | ""; workingModel: WorkingModel | "" }) {
  const response = await httpClient.post<ApiResponse<SavedSearchResponse>>("/students/me/saved-searches", mapSavedSearchPayload(form));
  return response.data.data;
}

async function updateSavedSearch(savedSearchId: number, form: { name: string; keyword: string; location: string; jobType: JobType | ""; workingModel: WorkingModel | "" }) {
  const response = await httpClient.put<ApiResponse<SavedSearchResponse>>(`/students/me/saved-searches/${savedSearchId}`, mapSavedSearchPayload(form));
  return response.data.data;
}

async function deleteSavedSearch(savedSearchId: number) {
  await httpClient.delete<ApiResponse<null>>(`/students/me/saved-searches/${savedSearchId}`);
}

function mapSavedSearchPayload(form: { name: string; keyword: string; location: string; jobType: JobType | ""; workingModel: WorkingModel | "" }) {
  return {
    name: form.name.trim(),
    keyword: emptyToNull(form.keyword),
    location: emptyToNull(form.location),
    jobType: form.jobType || null,
    workingModel: form.workingModel || null,
  };
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
    experience: null,
    jobType: getJobTypeLabel(job.jobType),
    workMode: mapWorkingModel(job.workingModel),
    level: null,
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

function formatSavedSearchSummary(search: SavedSearchResponse) {
  const parts = [
    search.keyword || "Tất cả từ khóa",
    search.location || "Tất cả địa điểm",
    search.jobType ? getJobTypeLabel(search.jobType) : "Tất cả loại hình",
    search.workingModel ? getWorkingModelLabel(search.workingModel) : "Tất cả hình thức",
  ];
  return parts.join(" • ");
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

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getApiErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Backend trả về lỗi. Vui lòng thử lại.";
  }
  return "Không thể kết nối backend. Vui lòng thử lại.";
}
