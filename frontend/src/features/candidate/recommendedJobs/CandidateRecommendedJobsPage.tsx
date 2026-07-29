import { BarChart3, Bookmark, BookmarkCheck, BriefcaseBusiness, EyeOff, MapPin, RefreshCw, RotateCcw, Send, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../../components/common/PageContainer";
import { PageHeader } from "../../../components/common/PageHeader";
import { Pagination } from "../../../components/common/Pagination";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useSavedJobs } from "../../../hooks/useSavedJobs";
import { useToast } from "../../../hooks/useToast";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";
import { formatExperience } from "../../public/jobs/experienceDisplay";
import { CandidateApplyFlowModal, type ApplyFlowJob } from "../apply/CandidateApplyFlowModal";
import {
  generateRecommendations,
  getCandidateCvOptions,
  getRecommendationRun,
  getRecommendationRuns,
  getRecommendedFilterOptions,
  getRecommendedJobs,
  getRecommendedJobState,
  saveRecommendedJobState,
  summarizeRecommendationRuns,
} from "./recommendedJobsService";
import type { CandidateRecommendedJob, RecommendedJobFilters } from "./recommendedJobsTypes";

const pageSize = 6;

const defaultFilters: RecommendedJobFilters = {
  minMatch: 0,
  location: "",
  industry: "",
  salary: "",
  workMode: "",
};

const salaryOptions = [
  { label: "Tất cả", value: "" },
  { label: "Từ 10 triệu", value: "10" },
  { label: "Từ 15 triệu", value: "15" },
  { label: "Từ 20 triệu", value: "20" },
  { label: "Từ 30 triệu", value: "30" },
];

export function CandidateRecommendedJobsPage() {
  const initialState = useMemo(() => getRecommendedJobState(), []);
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>(initialState.hiddenIds);
  const [analysisJob, setAnalysisJob] = useState<CandidateRecommendedJob | null>(null);
  const [applyJob, setApplyJob] = useState<ApplyFlowJob | null>(null);
  const [hideTarget, setHideTarget] = useState<CandidateRecommendedJob | null>(null);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [threshold, setThreshold] = useState("0.1");
  const [limit, setLimit] = useState("20");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const { hasApplied } = useAppliedJobs();
  const { showToast } = useToast();

  const cvsQuery = useAsyncData(() => getCandidateCvOptions(), [reloadKey]);
  const runsQuery = useAsyncData(() => getRecommendationRuns(), [reloadKey]);
  const runDetailQuery = useAsyncData(() => (selectedRunId ? getRecommendationRun(selectedRunId) : Promise.resolve(null)), [selectedRunId, reloadKey]);
  const jobsQuery = useAsyncData(() => getRecommendedJobs(filters, showHidden ? [] : hiddenIds), [filters, hiddenIds, showHidden, reloadKey]);
  const options = useMemo(() => getRecommendedFilterOptions(jobsQuery.data ?? []), [jobsQuery.data]);
  const runSummary = useMemo(() => summarizeRecommendationRuns(runsQuery.data), [runsQuery.data]);
  const latestRun = runSummary.attemptedRun;
  const latestSuccessfulRun = runSummary.successfulRun;
  const readyCvs = useMemo(() => (cvsQuery.data ?? []).filter((cv) => cv.ready), [cvsQuery.data]);
  const canGenerate = Boolean(selectedCvId && readyCvs.some((cv) => cv.id === selectedCvId)) && !generating && !cvsQuery.loading;

  useEffect(() => {
    if (selectedCvId || !readyCvs.length) return;
    const activeCv = readyCvs.find((cv) => cv.active) ?? readyCvs[0];
    setSelectedCvId(activeCv.id);
  }, [readyCvs, selectedCvId]);

  const filteredJobs = useMemo(() => {
    const jobs = jobsQuery.data ?? [];
    return showHidden ? jobs.filter((job) => hiddenIds.includes(job.id)) : jobs;
  }, [hiddenIds, jobsQuery.data, showHidden]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const pagedJobs = filteredJobs.slice((page - 1) * pageSize, page * pageSize);

  function updateFilter<K extends keyof RecommendedJobFilters>(key: K, value: RecommendedJobFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function persistHiddenJobs(nextHiddenIds: string[]) {
    setHiddenIds(nextHiddenIds);
    saveRecommendedJobState(nextHiddenIds, []);
  }

  function hideJob(job: CandidateRecommendedJob) {
    if (hiddenIds.includes(job.id)) return;
    persistHiddenJobs([...hiddenIds, job.id]);
    setHideTarget(null);
    showToast({ type: "success", title: "Đã ẩn việc làm", message: `${job.title} sẽ không còn xuất hiện trong danh sách gợi ý.` });
  }

  function restoreJob(job: CandidateRecommendedJob) {
    persistHiddenJobs(hiddenIds.filter((id) => id !== job.id));
    showToast({ type: "success", title: "Đã khôi phục", message: `${job.title} đã trở lại danh sách gợi ý.` });
  }

  async function toggleSave(job: CandidateRecommendedJob) {
    try {
      await toggleSavedJob(job.id);
    } catch {
      showToast({ type: "error", title: "Không thể cập nhật lưu việc", message: "Vui lòng thử lại sau." });
    }
  }

  async function refreshRecommendations() {
    if (!selectedCvId) {
      showToast({ type: "error", title: "Chưa có CV sẵn sàng", message: "Vui lòng phân tích CV đến trạng thái sẵn sàng trước khi tạo gợi ý." });
      return;
    }
    const selectedCv = cvsQuery.data?.find((cv) => cv.id === selectedCvId);
    if (!selectedCv?.ready) {
      showToast({ type: "error", title: "CV chưa sẵn sàng", message: "Chỉ có thể tạo gợi ý bằng CV đã phân tích thành công." });
      return;
    }
    const thresholdValue = Number(threshold);
    const limitValue = Number(limit);
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      showToast({ type: "error", title: "Ngưỡng điểm không hợp lệ", message: "Ngưỡng điểm phải nằm trong khoảng 0 đến 1." });
      return;
    }
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
      showToast({ type: "error", title: "Số lượng không hợp lệ", message: "Số lượng phải nằm trong khoảng 1 đến 100." });
      return;
    }
    setGenerating(true);
    try {
      const run = await generateRecommendations({ cvId: selectedCvId, threshold: thresholdValue, limit: limitValue });
      setSelectedRunId(String(run.id));
      showToast({ type: "success", title: "Đã cập nhật gợi ý", message: "Danh sách sẽ được tải lại." });
      setReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật gợi ý", message: getErrorMessage(error) });
    } finally {
      setGenerating(false);
    }
  }

  function openApply(job: CandidateRecommendedJob) {
    if (hasApplied(job.id)) {
      showToast({ type: "error", title: "Không thể ứng tuyển trùng", message: "Bạn đã ứng tuyển việc làm này trước đó." });
      return;
    }
    setApplyJob({
      id: job.id,
      title: job.title,
      companyName: job.companyName,
      salary: job.salary,
      location: job.location,
      workMode: job.workMode,
    });
  }

  return (
    <PageContainer>
      <PageHeader title="Việc làm gợi ý" description="Danh sách việc làm phù hợp với CV đã phân tích." />

      <Card className="mb-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px_160px_190px]">
          <Select
            label="CV dùng để gợi ý"
            value={selectedCvId}
            onChange={(event) => setSelectedCvId(event.target.value)}
            options={[
              { label: cvsQuery.loading ? "Đang tải CV..." : readyCvs.length ? "Chọn CV đã sẵn sàng" : "Chưa có CV sẵn sàng", value: "" },
              ...readyCvs.map((cv) => ({ label: `${cv.name}${cv.active ? " (đang dùng)" : ""} - ${getCvAnalysisStatusLabel(cv.analysisStatus)}`, value: cv.id })),
            ]}
          />
          <Input label="Ngưỡng điểm" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          <Input label="Số lượng" type="number" min="1" max="100" step="1" value={limit} onChange={(event) => setLimit(event.target.value)} />
          <Button className="mt-6 w-full" loading={generating} disabled={!canGenerate} onClick={() => void refreshRecommendations()} icon={<RefreshCw size={16} />}>
            Cập nhật gợi ý
          </Button>
        </div>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
          <InfoPill label="Lần chạy mới nhất" value={latestRun ? `#${latestRun.id} - ${getRunStatusLabel(latestRun.status)}` : "Chưa có"} />
          <InfoPill label="Kết quả thành công mới nhất" value={latestSuccessfulRun ? `#${latestSuccessfulRun.id}` : "Chưa có"} />
          <InfoPill label="Số việc thành công" value={String(latestSuccessfulRun?.totalRecommended ?? 0)} />
          <InfoPill label="Thời gian chạy mới nhất" value={latestRun?.createdAt ?? "Chưa cập nhật"} />
        </div>
        {runSummary.hasStaleSuccessfulResults ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Lần chạy mới nhất #{latestRun?.id} có trạng thái {getRunStatusLabel(latestRun?.status)}. Danh sách bên dưới là kết quả thành công gần nhất #{latestSuccessfulRun?.id}, không phải kết quả của lần chạy lỗi.
          </div>
        ) : null}
        {latestRun && latestRun.status !== "SUCCESS" && latestRun.totalRecommended === 0 ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Lần chạy mới nhất chưa có kết quả hiển thị. Danh sách chỉ hiện khi lần gợi ý thành công và có kết quả.
          </div>
        ) : null}
        {runsQuery.data?.length ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Select
              label="Xem lần gợi ý"
              value={selectedRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
              options={[
                { label: "Chọn lần gợi ý", value: "" },
                ...runsQuery.data.map((run) => ({ label: `#${run.id} - ${getRunStatusLabel(run.status)} - ${run.createdAt}`, value: run.id })),
              ]}
            />
            <div className="mt-6">
              <StatusBadge label={runDetailQuery.loading ? "Đang tải lần gợi ý" : getRunStatusLabel(runDetailQuery.data?.run.status) ?? "Chưa chọn lần gợi ý"} tone={runDetailQuery.data?.run.status === "SUCCESS" ? "success" : undefined} />
            </div>
          </div>
        ) : null}
        {runDetailQuery.data?.run.errorMessage ? <p className="mt-3 text-sm text-red-600">{runDetailQuery.data.run.errorMessage}</p> : null}
        {!cvsQuery.loading && (cvsQuery.data?.length ?? 0) > 0 && readyCvs.length === 0 ? (
          <p className="mt-3 text-sm text-amber-700">Chưa có CV nào đã phân tích thành công. Hãy vào trang CV và bấm Phân tích lại trước khi tạo gợi ý.</p>
        ) : null}
      </Card>

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Select
            label="Điểm phù hợp tối thiểu"
            value={String(filters.minMatch)}
            onChange={(event) => updateFilter("minMatch", Number(event.target.value))}
            options={[
              { label: "Tất cả", value: "0" },
              { label: "Từ 50%", value: "50" },
              { label: "Từ 65%", value: "65" },
              { label: "Từ 75%", value: "75" },
              { label: "Từ 85%", value: "85" },
            ]}
          />
          <Select
            label="Địa điểm"
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
            options={[{ label: "Tất cả", value: "" }, ...options.locations.map((value) => ({ label: value, value }))]}
          />
          <Select
            label="Vị trí"
            value={filters.industry}
            onChange={(event) => updateFilter("industry", event.target.value)}
            options={[{ label: "Tất cả", value: "" }, ...options.industries.map((value) => ({ label: value, value }))]}
          />
          <Select label="Mức lương" value={filters.salary} onChange={(event) => updateFilter("salary", event.target.value)} options={salaryOptions} />
          <Select
            label="Hình thức làm việc"
            value={filters.workMode}
            onChange={(event) => updateFilter("workMode", event.target.value)}
            options={[{ label: "Tất cả", value: "" }, ...options.workModes.map((value) => ({ label: value, value }))]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">
            {showHidden ? `${filteredJobs.length} việc làm đang bị ẩn` : `${filteredJobs.length} việc làm phù hợp`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => { setShowHidden((current) => !current); setPage(1); }} icon={showHidden ? <BriefcaseBusiness size={16} /> : <EyeOff size={16} />}>
            {showHidden ? "Quay lại gợi ý" : `Xem việc đã ẩn (${hiddenIds.length})`}
          </Button>
        </div>
      </Card>

      {jobsQuery.loading ? (
        <LoadingState />
      ) : jobsQuery.error ? (
        <EmptyState message={jobsQuery.error} />
      ) : pagedJobs.length === 0 ? (
        <EmptyState message={showHidden ? "Chưa có việc làm nào bị ẩn." : "Chưa có kết quả gợi ý phù hợp với bộ lọc hiện tại."} />
      ) : (
        <div className="grid gap-4">
          {pagedJobs.map((job) => (
            <RecommendedJobCard
              key={job.id}
              job={job}
              saved={isSaved(job.id)}
              applied={hasApplied(job.id)}
              hidden={hiddenIds.includes(job.id)}
              onToggleSave={() => void toggleSave(job)}
              onHide={() => setHideTarget(job)}
              onRestore={() => restoreJob(job)}
              onOpenAnalysis={() => setAnalysisJob(job)}
              onApply={() => openApply(job)}
            />
          ))}
        </div>
      )}

      <div className="mt-5">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <MatchAnalysisModal job={analysisJob} onClose={() => setAnalysisJob(null)} />
      <CandidateApplyFlowModal job={applyJob} onClose={() => setApplyJob(null)} />
      <HideJobModal job={hideTarget} onClose={() => setHideTarget(null)} onConfirm={hideJob} />
    </PageContainer>
  );
}

function RecommendedJobCard({
  job,
  saved,
  applied,
  hidden,
  onToggleSave,
  onHide,
  onRestore,
  onOpenAnalysis,
  onApply,
}: {
  job: CandidateRecommendedJob;
  saved: boolean;
  applied: boolean;
  hidden: boolean;
  onToggleSave: () => void;
  onHide: () => void;
  onRestore: () => void;
  onOpenAnalysis: () => void;
  onApply: () => void;
}) {
  return (
    <Card>
      <div className="grid gap-4 lg:grid-cols-[116px_1fr]">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase text-emerald-700">Điểm phù hợp</p>
          <p className="mt-2 text-4xl font-bold text-emerald-700">{job.matchScore}%</p>
          <p className="mt-1 text-xs text-emerald-700">{job.rankPosition ? `Hạng #${job.rankPosition}` : "Điểm phù hợp"}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/candidate/jobs/${job.id}`} className="text-lg font-semibold text-slate-950 hover:text-brand-700">
                {job.title}
              </Link>
              <p className="mt-1 text-sm font-medium text-slate-700">{job.companyName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1"><Wallet size={15} />{job.salary}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={15} />{job.location}</span>
                <span className="inline-flex items-center gap-1"><BriefcaseBusiness size={15} />{formatExperience(job.experienceYears, job.experienceLabel)} - {job.workMode}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hidden ? <StatusBadge label="Đã ẩn" tone="warning" /> : null}
              <StatusBadge label={job.industry} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SkillGroup title="Kỹ năng phù hợp" skills={job.matchedSkills} tone="success" />
            <SkillGroup title="Kỹ năng còn thiếu" skills={job.missingSkills} tone="warning" />
          </div>

          <div className="mt-4 rounded-md bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Lý do được gợi ý</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {job.recommendationReasons.length ? job.recommendationReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              )) : <li>Chưa có lý do gợi ý cho kết quả này.</li>}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" icon={<BarChart3 size={16} />} onClick={onOpenAnalysis}>Xem phân tích</Button>
            <Button variant={saved ? "primary" : "secondary"} size="sm" icon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} onClick={onToggleSave}>
              {saved ? "Bỏ lưu" : "Lưu"}
            </Button>
            <Button size="sm" icon={<Send size={16} />} onClick={onApply} disabled={applied}>{applied ? "Đã ứng tuyển" : "Ứng tuyển"}</Button>
            <Link to={`/candidate/jobs/${job.id}`}>
              <Button variant="secondary" size="sm">Xem chi tiết</Button>
            </Link>
            {hidden ? (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={16} />} onClick={onRestore}>Khôi phục</Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<EyeOff size={16} />} onClick={onHide}>Ẩn</Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SkillGroup({ title, skills, tone }: { title: string; skills: string[]; tone: "success" | "warning" }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p>
      <div className="flex flex-wrap gap-2">
        {skills.length ? skills.map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />) : <StatusBadge label="Chưa cập nhật" />}
      </div>
    </div>
  );
}

function HideJobModal({ job, onClose, onConfirm }: { job: CandidateRecommendedJob | null; onClose: () => void; onConfirm: (job: CandidateRecommendedJob) => void }) {
  return (
    <Modal open={Boolean(job)} title="Ẩn việc làm gợi ý" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Bạn có muốn ẩn tin <strong>{job?.title}</strong> khỏi danh sách việc làm gợi ý không?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => job && onConfirm(job)}>Có, ẩn tin</Button>
        </div>
      </div>
    </Modal>
  );
}

function MatchAnalysisModal({ job, onClose }: { job: CandidateRecommendedJob | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(job)} title={`Phân tích độ phù hợp ${job?.matchScore ?? 0}%`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">{job?.title}</p>
          <p className="mt-1 text-sm text-slate-600">{job?.companyName}</p>
        </div>
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <InfoPill label="Hạng gợi ý" value={job?.rankPosition ? `#${job.rankPosition}` : "Chưa cập nhật"} />
          <InfoPill label="Điểm phù hợp" value={`${job?.matchScore ?? 0}%`} />
          <InfoPill label="Điểm nội dung" value={job?.textScore == null ? "Không áp dụng" : `${job.textScore}%`} />
          <InfoPill label="Điểm kỹ năng" value={job?.skillScore == null ? "Chưa cập nhật" : `${job.skillScore}%`} />
          <InfoPill label="Cách tính điểm" value={job?.scoringStrategy ?? "Chưa cập nhật"} />
          <InfoPill label="Ngày tạo kết quả" value={job?.postedAt ?? "Chưa cập nhật"} />
          <InfoPill label="Số kỹ năng khớp" value={String(job?.matchedSkills.length ?? 0)} />
        </div>
        <div className="rounded-md border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">Kỹ năng khớp</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(job?.matchedSkills.length ? job.matchedSkills : ["Chưa cập nhật"]).map((skill) => <StatusBadge key={skill} label={skill} tone={job?.matchedSkills.length ? "success" : undefined} />)}
          </div>
        </div>
        <div className="rounded-md border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">Lý do gợi ý</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {job?.recommendationReasons.length ? job.recommendationReasons.map((reason) => <p key={reason}>{reason}</p>) : <p>Chưa có lý do gợi ý.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getRunStatusLabel(status?: string | null) {
  if (status === "SUCCESS") return "Thành công";
  if (status === "FAILED") return "Thất bại";
  if (status === "PROCESSING") return "Đang xử lý";
  if (status === "PENDING") return "Đang chờ";
  return status ? "Chưa cập nhật" : "Chưa chọn lần gợi ý";
}

function getCvAnalysisStatusLabel(status?: string | null) {
  if (status === "READY") return "Đã phân tích";
  if (status === "FAILED") return "Phân tích lỗi";
  if (status === "PROCESSING") return "Đang phân tích";
  if (status === "NOT_READY") return "Chưa phân tích";
  return "Chưa cập nhật";
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại sau.";
  }
  return "Vui lòng thử lại sau.";
}
