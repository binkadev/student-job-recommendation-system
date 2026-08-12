import { BarChart3, Bookmark, BookmarkCheck, BriefcaseBusiness, EyeOff, MapPin, RefreshCw, RotateCcw, Send, Wallet } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../../components/common/PageContainer";
import { PageHeader } from "../../../components/common/PageHeader";
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
import { createAuthenticatedTabUrl } from "../../../services/auth/authService";
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { formatNormalizedScore } from "../../shared/ranking/rankingScoreTypes";
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
} from "./recommendedJobsService";
import type { CandidateRecommendedJob, RecommendedJobFilters } from "./recommendedJobsTypes";

const defaultFilters: RecommendedJobFilters = {
  minDisplayScore: 0,
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
  const [showHidden, setShowHidden] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>(initialState.hiddenIds);
  const [analysisJob, setAnalysisJob] = useState<CandidateRecommendedJob | null>(null);
  const [applyJob, setApplyJob] = useState<ApplyFlowJob | null>(null);
  const [hideTarget, setHideTarget] = useState<CandidateRecommendedJob | null>(null);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [threshold, setThreshold] = useState("0.1");
  const [primaryLimit, setPrimaryLimit] = useState("20");
  const [fallbackLimit, setFallbackLimit] = useState("20");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const { hasApplied } = useAppliedJobs();
  const { showToast } = useToast();

  const cvsQuery = useAsyncData(() => getCandidateCvOptions(), [reloadKey]);
  const runsQuery = useAsyncData(() => getRecommendationRuns(), [reloadKey]);
  const runDetailQuery = useAsyncData(() => (selectedRunId ? getRecommendationRun(selectedRunId) : Promise.resolve(null)), [selectedRunId, reloadKey]);
  const latestRun = runsQuery.data?.[0];
  const latestRunSuccess = latestRun?.status === "SUCCESS";
  const selectedRunSuccess = runDetailQuery.data?.run.status === "SUCCESS";
  const showingHistoricalRun = Boolean(selectedRunId && selectedRunSuccess);
  const successfulRuns = useMemo(
    () => (runsQuery.data ?? []).filter((run) => run.status === "SUCCESS" && run.id !== latestRun?.id),
    [latestRun?.id, runsQuery.data],
  );
  const jobsQuery = useAsyncData(
    () => (!selectedRunId ? getRecommendedJobs() : Promise.resolve([])),
    [selectedRunId, reloadKey],
  );
  const displayJobs = useMemo(() => {
    const sourceJobs = showingHistoricalRun ? runDetailQuery.data?.results ?? [] : jobsQuery.data ?? [];
    return filterRecommendedJobs(sourceJobs, filters, hiddenIds, showHidden);
  }, [filters, hiddenIds, jobsQuery.data, runDetailQuery.data?.results, showingHistoricalRun, showHidden]);
  const options = useMemo(() => getRecommendedFilterOptions(displayJobs), [displayJobs]);
  const readyCvs = useMemo(() => (cvsQuery.data ?? []).filter((cv) => cv.ready), [cvsQuery.data]);
  const notReadyCvs = useMemo(() => (cvsQuery.data ?? []).filter((cv) => !cv.ready), [cvsQuery.data]);
  const selectedCv = useMemo(() => cvsQuery.data?.find((cv) => cv.id === selectedCvId), [cvsQuery.data, selectedCvId]);
  const selectedCvReady = Boolean(selectedCv?.ready);
  const generateDisabled = generating || cvsQuery.loading || !selectedCvId || !selectedCvReady;

  useEffect(() => {
    if (selectedCvId || !readyCvs.length) return;
    const activeCv = readyCvs.find((cv) => cv.active) ?? readyCvs[0];
    setSelectedCvId(activeCv.id);
  }, [readyCvs, selectedCvId]);

  const filteredJobs = useMemo(() => {
    return displayJobs;
  }, [displayJobs]);

  const primaryJobs = useMemo(() => filteredJobs.filter((job) => job.rankingTier === "PRIMARY").sort(compareTierRank), [filteredJobs]);
  const fallbackJobs = useMemo(() => filteredJobs.filter((job) => job.rankingTier === "FALLBACK").sort(compareTierRank), [filteredJobs]);
  function updateFilter<K extends keyof RecommendedJobFilters>(key: K, value: RecommendedJobFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
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
    if (generatingRef.current) return;
    if (!selectedCvId) {
      showToast({ type: "error", title: "Chưa có CV sẵn sàng", message: "Vui lòng phân tích CV đến trạng thái READY trước khi tạo gợi ý." });
      return;
    }
    if (!selectedCv?.ready) {
      showToast({ type: "error", title: "CV chưa sẵn sàng", message: selectedCv?.readinessReason ?? "Chỉ có thể tạo gợi ý bằng CV READY và có đầy đủ dữ liệu phân tích." });
      return;
    }
    const thresholdValue = Number(threshold);
    const primaryLimitValue = Number(primaryLimit);
    const fallbackLimitValue = Number(fallbackLimit);
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      showToast({ type: "error", title: "Threshold không hợp lệ", message: "Threshold phải nằm trong khoảng 0 đến 1." });
      return;
    }
    if (!Number.isInteger(primaryLimitValue) || primaryLimitValue < 1 || primaryLimitValue > 100 || !Number.isInteger(fallbackLimitValue) || fallbackLimitValue < 1 || fallbackLimitValue > 100) {
      showToast({ type: "error", title: "Limit không hợp lệ", message: "Limit phải nằm trong khoảng 1 đến 100." });
      return;
    }
    generatingRef.current = true;
    setGenerating(true);
    try {
      await generateRecommendations({ cvId: selectedCvId, threshold: thresholdValue, limit: Math.min(primaryLimitValue, fallbackLimitValue), primaryLimit: primaryLimitValue, fallbackLimit: fallbackLimitValue });
      setSelectedRunId("");
      showToast({ type: "success", title: "Đã gửi yêu cầu cập nhật gợi ý", message: "Danh sách sẽ được tải lại khi có kết quả mới." });
      setReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật gợi ý", message: getApiErrorMessage(error) });
    } finally {
      generatingRef.current = false;
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
      <PageHeader title="Việc làm gợi ý" description="Kết quả gợi ý theo CV READY và trạng thái recommendation run mới nhất." />

      <Card className="mb-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_150px_170px_170px_190px_150px]">
          <Select
            label="CV dùng để gợi ý"
            value={selectedCvId}
            onChange={(event) => setSelectedCvId(event.target.value)}
            options={[
              { label: cvsQuery.loading ? "Đang tải CV..." : readyCvs.length ? "Chọn CV READY" : "Chưa có CV READY", value: "" },
              ...readyCvs.map((cv) => ({ label: `${cv.name}${cv.active ? " (active)" : ""} - ${cv.analysisStatus}`, value: cv.id })),
            ]}
          />
          <Input label="Ngưỡng xếp hạng" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          <Input label="Top phù hợp tổng thể" type="number" min="1" max="100" step="1" value={primaryLimit} onChange={(event) => setPrimaryLimit(event.target.value)} />
          <Input label="Top đối sánh kỹ năng" type="number" min="1" max="100" step="1" value={fallbackLimit} onChange={(event) => setFallbackLimit(event.target.value)} />
          <Button className="mt-6 w-full" loading={generating} disabled={generateDisabled} onClick={() => void refreshRecommendations()} icon={<RefreshCw size={16} />}>
            Cập nhật gợi ý
          </Button>
          <Button className="mt-6 w-full" variant="secondary" disabled={jobsQuery.loading || runsQuery.loading} onClick={() => setReloadKey((current) => current + 1)}>
            Tải lại
          </Button>
        </div>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700 md:grid-cols-4">
          <InfoPill label="Run mới nhất" value={latestRun ? `#${latestRun.id}` : "Chưa có"} />
          <InfoPill label="Trạng thái" value={latestRun?.status ?? "Chưa có"} />
          <InfoPill label="Số việc đã gợi ý" value={String(latestRun?.totalRecommended ?? displayJobs.length)} />
          <InfoPill label="Thời gian" value={latestRun?.createdAt ?? "Chưa cập nhật"} />
        </div>
        {successfulRuns.length ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Select
              label="Xem kết quả SUCCESS lịch sử"
              value={selectedRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
              options={[
                { label: "Dùng kết quả hiện tại", value: "" },
                ...successfulRuns.map((run) => ({ label: `#${run.id} - SUCCESS - ${run.createdAt}`, value: run.id })),
              ]}
            />
            <div className="mt-6">
              <StatusBadge label={showingHistoricalRun ? "Đang xem kết quả lịch sử" : "Kết quả hiện tại"} tone={showingHistoricalRun ? "warning" : "success"} />
            </div>
          </div>
        ) : null}
        {latestRun && !latestRunSuccess && !selectedRunId ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">Run mới nhất không thành công: {latestRun.status}</p>
            <p className="mt-2 text-sm leading-6 text-red-700">{latestRun.errorMessage ?? "Không thể tạo danh sách gợi ý mới. Vui lòng thử lại hoặc chọn một run SUCCESS trong lịch sử."}</p>
          </div>
        ) : null}
        {runsQuery.error ? (
          <p className="mt-3 text-sm text-amber-700">Không tải được lịch sử gợi ý. Kết quả hiện tại vẫn được hiển thị nếu có.</p>
        ) : null}
        {showingHistoricalRun ? (
          <p className="mt-3 text-sm text-amber-700">Bạn đang xem kết quả lịch sử từ run #{runDetailQuery.data?.run.id}, không phải kết quả hiện tại.</p>
        ) : null}
        {!cvsQuery.loading && (cvsQuery.data?.length ?? 0) > 0 && readyCvs.length === 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>Chưa có CV nào sẵn sàng để tạo gợi ý. CV cần ở trạng thái READY và có đủ extracted text, processed text.</p>
            {notReadyCvs.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {notReadyCvs.slice(0, 3).map((cv) => <li key={cv.id}>{cv.name}: {cv.readinessReason ?? cv.analysisStatus}</li>)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Select
            label="Điểm hiển thị tối thiểu"
            value={String(filters.minDisplayScore)}
            onChange={(event) => updateFilter("minDisplayScore", Number(event.target.value))}
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
          <Button variant="secondary" size="sm" onClick={() => setShowHidden((current) => !current)} icon={showHidden ? <BriefcaseBusiness size={16} /> : <EyeOff size={16} />}>
            {showHidden ? "Quay lại gợi ý" : `Xem việc đã ẩn (${hiddenIds.length})`}
          </Button>
        </div>
      </Card>

      {jobsQuery.loading || runDetailQuery.loading ? (
        <LoadingState />
      ) : jobsQuery.error && !selectedRunId ? (
        <EmptyState message={jobsQuery.error} />
      ) : filteredJobs.length === 0 ? (
        <EmptyState message={showHidden ? "Chưa có việc làm nào bị ẩn." : "Chưa có kết quả gợi ý phù hợp với bộ lọc hiện tại."} />
      ) : (
        <div className="space-y-6">
          <RecommendedJobSection
            title="Phù hợp tổng thể"
            description="Các việc làm có đủ bằng chứng nội dung và kỹ năng để tính Match Score."
            jobs={primaryJobs}
            savedIds={isSaved}
            appliedIds={hasApplied}
            hiddenIds={hiddenIds}
            onToggleSave={(job) => void toggleSave(job)}
            onHide={setHideTarget}
            onRestore={restoreJob}
            onOpenAnalysis={setAnalysisJob}
            onApply={openApply}
          />
          <RecommendedJobSection
            title="Đối sánh kỹ năng"
            description="Các việc làm được xếp theo mức đáp ứng kỹ năng, không phải điểm phù hợp tổng thể."
            jobs={fallbackJobs}
            savedIds={isSaved}
            appliedIds={hasApplied}
            hiddenIds={hiddenIds}
            onToggleSave={(job) => void toggleSave(job)}
            onHide={setHideTarget}
            onRestore={restoreJob}
            onOpenAnalysis={setAnalysisJob}
            onApply={openApply}
          />
        </div>
      )}

      <MatchAnalysisModal job={analysisJob} onClose={() => setAnalysisJob(null)} />
      <CandidateApplyFlowModal job={applyJob} onClose={() => setApplyJob(null)} />
      <HideJobModal job={hideTarget} onClose={() => setHideTarget(null)} onConfirm={hideJob} />
    </PageContainer>
  );
}

function RecommendedJobSection({
  title,
  description,
  jobs,
  savedIds,
  appliedIds,
  hiddenIds,
  onToggleSave,
  onHide,
  onRestore,
  onOpenAnalysis,
  onApply,
}: {
  title: string;
  description: string;
  jobs: CandidateRecommendedJob[];
  savedIds: (id: string) => boolean;
  appliedIds: (id: string) => boolean;
  hiddenIds: string[];
  onToggleSave: (job: CandidateRecommendedJob) => void;
  onHide: (job: CandidateRecommendedJob) => void;
  onRestore: (job: CandidateRecommendedJob) => void;
  onOpenAnalysis: (job: CandidateRecommendedJob) => void;
  onApply: (job: CandidateRecommendedJob) => void;
}) {
  if (!jobs.length) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title} · 0</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title} · {jobs.length}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="grid gap-4">
        {jobs.map((job) => (
          <RecommendedJobCard
            key={`${job.rankingTier}-${job.id}`}
            job={job}
            saved={savedIds(job.id)}
            applied={appliedIds(job.id)}
            hidden={hiddenIds.includes(job.id)}
            onToggleSave={() => onToggleSave(job)}
            onHide={() => onHide(job)}
            onRestore={() => onRestore(job)}
            onOpenAnalysis={() => onOpenAnalysis(job)}
            onApply={() => onApply(job)}
          />
        ))}
      </div>
    </section>
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
  const unavailable = job.status === "unavailable";
  const detailPath = `/candidate/jobs/${job.id}`;

  return (
    <Card>
      <div className="grid gap-4 lg:grid-cols-[116px_1fr]">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase text-emerald-700">{job.displayScoreLabel}</p>
          <p className="mt-2 text-4xl font-bold text-emerald-700">{formatNormalizedScore(job.displayScore)}</p>
          <p className="mt-1 text-xs text-emerald-700">{job.tierRankPosition ? `Hạng #${job.tierRankPosition}` : job.displayTierLabel}</p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={detailPath} onClick={(event) => openAuthenticatedTab(event, detailPath)} className="text-lg font-semibold text-slate-950 hover:text-brand-700">
                {job.title}
              </Link>
              <p className="mt-1 text-sm font-medium text-slate-700">{job.companyName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1"><Wallet size={15} />{job.salary}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={15} />{job.location}</span>
                <span className="inline-flex items-center gap-1"><BriefcaseBusiness size={15} />{formatExperience(job.experienceYears, job.experienceLabel)} - {job.scoringStrategyLabel ?? "Chưa cập nhật"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={job.displayTierLabel} tone={job.rankingTier === "PRIMARY" ? "success" : "warning"} />
              {hidden ? <StatusBadge label="Đã ẩn" tone="warning" /> : null}
              {unavailable ? <StatusBadge label="Không còn khả dụng" tone="danger" /> : null}
              <StatusBadge label={job.industry} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SkillGroup title="Keyword phù hợp" skills={job.matchedSkills} tone="success" emptyLabel="Chưa cập nhật" />
            <SkillGroup title="Keyword còn thiếu" skills={job.missingSkills} tone="warning" emptyLabel="Không thiếu kỹ năng" />
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
            <Button size="sm" icon={<Send size={16} />} onClick={onApply} disabled={applied || unavailable}>{applied ? "Đã ứng tuyển" : "Ứng tuyển"}</Button>
            <Link to={detailPath} onClick={(event) => openAuthenticatedTab(event, detailPath)}>
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

function openAuthenticatedTab(event: MouseEvent<HTMLAnchorElement>, path: string) {
  event.preventDefault();
  window.open(createAuthenticatedTabUrl(path), "_blank", "noopener,noreferrer");
}

function SkillGroup({ title, skills, tone, emptyLabel }: { title: string; skills: string[]; tone: "success" | "warning"; emptyLabel: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p>
      <div className="flex flex-wrap gap-2">
        {skills.length ? skills.map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />) : <StatusBadge label={emptyLabel} tone={tone} />}
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
    <Modal open={Boolean(job)} title={`Phân tích ${job?.displayScoreLabel ?? "kết quả"} ${formatNormalizedScore(job?.displayScore)}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">{job?.title}</p>
          <p className="mt-1 text-sm text-slate-600">{job?.companyName}</p>
        </div>
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <InfoPill label="Hạng gợi ý" value={job?.rankPosition ? `#${job.rankPosition}` : "Chưa cập nhật"} />
          <InfoPill label={job?.displayScoreLabel ?? "Điểm hiển thị"} value={formatNormalizedScore(job?.displayScore)} />
          <InfoPill label="Final Score" value={formatNormalizedScore(job?.overallScore)} />
          <InfoPill label="Text Score" value={formatNormalizedScore(job?.textScore)} />
          <InfoPill label="Skill Score" value={formatNormalizedScore(job?.skillScore)} />
          <InfoPill label="Chiến lược" value={job?.scoringStrategyLabel ?? "Chưa cập nhật"} />
          <InfoPill label="Ngày tạo kết quả" value={job?.postedAt ?? "Chưa cập nhật"} />
          <InfoPill label="Số keyword khớp" value={String(job?.matchedSkills.length ?? 0)} />
        </div>
        <div className="rounded-md border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">Keyword khớp</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(job?.matchedSkills.length ? job.matchedSkills : ["Chưa cập nhật"]).map((skill) => <StatusBadge key={skill} label={skill} tone={job?.matchedSkills.length ? "success" : undefined} />)}
          </div>
        </div>
        <div className="rounded-md border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">Lý do gợi ý</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {job?.recommendationReasons.length ? job.recommendationReasons.map((reason) => <p key={reason}>{reason}</p>) : <p>Chưa có giải thích cho kết quả này.</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function filterRecommendedJobs(jobs: CandidateRecommendedJob[], filters: RecommendedJobFilters, hiddenIds: string[], showHidden: boolean) {
  return jobs.filter((job) => {
    const matchHidden = showHidden ? hiddenIds.includes(job.id) : !hiddenIds.includes(job.id);
    const displayScorePercent = job.displayScore == null ? -1 : job.displayScore * 100;
    const matchScore = displayScorePercent >= filters.minDisplayScore;
    const matchLocation = !filters.location || normalizeText(job.location).includes(normalizeText(filters.location));
    const matchIndustry = !filters.industry || job.industry === filters.industry;
    const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
    const matchSalary = !filters.salary || job.salaryMax >= Number(filters.salary) * 1_000_000;
    return matchHidden && matchScore && matchLocation && matchIndustry && matchWorkMode && matchSalary;
  });
}

function compareTierRank(left: CandidateRecommendedJob, right: CandidateRecommendedJob) {
  return left.tierRankPosition - right.tierRankPosition;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
