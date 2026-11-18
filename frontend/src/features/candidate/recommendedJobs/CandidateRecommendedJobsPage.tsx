import {
  BarChart3,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  EyeOff,
  MapPin,
  RefreshCw,
  RotateCcw,
  Send,
  Wallet,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { PageContainer } from "../../../components/common/PageContainer";
import { ScoreMeter } from "../../shared/ranking/ScoreMeter";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useSavedJobs } from "../../../hooks/useSavedJobs";
import { useToast } from "../../../hooks/useToast";
import { createAuthenticatedTabUrl } from "../../../services/auth/authService";
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { formatNormalizedScore } from "../../shared/ranking/rankingScoreTypes";
import { GenerationRecovery } from "../../shared/ranking/GenerationRecovery";
import { useGenerationRecovery } from "../../shared/ranking/useGenerationRecovery";
import { useSessionAlive } from "../../account/useSessionAlive";
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
  { label: "Tất cả mức lương", value: "" },
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
  const [limit, setLimit] = useState("20");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const { canApply, getApplyButtonLabel, applications, syncError: appliedSyncError, refreshAppliedJobs } = useAppliedJobs();
  const { showToast } = useToast();

  const cvsQuery = useAsyncData(() => getCandidateCvOptions(), [reloadKey]);
  const runsQuery = useAsyncData(() => getRecommendationRuns(), [reloadKey]);
  const runDetailQuery = useAsyncData(() => (selectedRunId ? getRecommendationRun(selectedRunId) : Promise.resolve(null)), [selectedRunId, reloadKey]);
  const latestRun = runsQuery.data?.[0];
  const alive = useSessionAlive();
  const recovery = useGenerationRecovery(getRecommendationRuns, () => setReloadKey((current) => current + 1));
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
  const generateDisabled = generating || recovery.blocked || latestRun?.status === "PROCESSING" || cvsQuery.loading || !selectedCvId || !selectedCvReady;

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
  const legacyJobs = useMemo(() => filteredJobs.filter((job) => job.rankingTier == null), [filteredJobs]);

  useGSAP(
    () => {
      if (!containerRef.current || jobsQuery.loading || runDetailQuery.loading) return;
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".nova-rec-reveal",
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            ease: "power3.out",
            stagger: 0.05,
            clearProps: "all",
          },
        );
      });

      return () => mm.revert();
    },
    {
      scope: containerRef.current ? containerRef : undefined,
      dependencies: [jobsQuery.loading, runDetailQuery.loading, filteredJobs.length],
    },
  );

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
    if (generatingRef.current || recovery.blocked || !alive()) return;
    if (!selectedCvId) {
      showToast({ type: "error", title: "Chưa có CV sẵn sàng", message: "Vui lòng phân tích CV đến trạng thái READY trước khi tạo gợi ý." });
      return;
    }
    if (!selectedCv?.ready) {
      showToast({ type: "error", title: "CV chưa sẵn sàng", message: selectedCv?.readinessReason ?? "Chỉ có thể tạo gợi ý bằng CV READY và có đầy đủ dữ liệu phân tích." });
      return;
    }
    const thresholdValue = Number(threshold);
    const limitValue = Number(limit);
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      showToast({ type: "error", title: "Threshold không hợp lệ", message: "Threshold phải nằm trong khoảng 0 đến 1." });
      return;
    }
    if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 100) {
      showToast({ type: "error", title: "Limit không hợp lệ", message: "Limit phải nằm trong khoảng 1 đến 100." });
      return;
    }
    generatingRef.current = true;
    setGenerating(true);
    try {
      await generateRecommendations({ cvId: selectedCvId, threshold: thresholdValue, limit: limitValue });
      if (!alive()) return;
      setSelectedRunId("");
      showToast({ type: "success", title: "Đã gửi yêu cầu cập nhật gợi ý", message: "Danh sách sẽ được tải lại khi có kết quả mới." });
      setReloadKey((current) => current + 1);
    } catch (error) {
      if (!alive()) return;
      recovery.requireReadBack();
      showToast({ type: "error", title: "Không thể cập nhật gợi ý", message: getApiErrorMessage(error) });
    } finally {
      generatingRef.current = false;
      if (alive()) setGenerating(false);
    }
  }

  function openApply(job: CandidateRecommendedJob) {
    if (!canApply(job.id)) {
      showToast({ type: "error", title: "Chưa thể ứng tuyển", message: "Đơn ứng tuyển gần nhất cho việc làm này vẫn đang được xử lý." });
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
      <div ref={containerRef} className="space-y-6">
        {/* ── HERO BANNER ─────────────────────────────── */}
        <section className="nova-rec-reveal overflow-hidden rounded-2xl border border-[#E5E9F0] bg-[#0C111C] p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#237D70]/30 bg-[#237D70]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#78D2C3]">
                <Sparkles size={12} aria-hidden="true" />
                <span>Gợi ý việc làm · Content-Based Filtering</span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Hiểu vì sao một công việc phù hợp với bạn.
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#9BB0C9]">
                Kết quả dựa trên nội dung CV và kỹ năng đã phân tích. Hai nhóm đối sánh có ý nghĩa riêng; điểm không phải xác suất trúng tuyển.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <Link to="/candidate/cvs">
                <Button variant="secondary" size="sm" className="border-white/15 bg-white/10 text-white hover:bg-white/20">
                  Quản lý CV
                </Button>
              </Link>
              <Button
                size="sm"
                loading={generating}
                disabled={generateDisabled}
                onClick={() => void refreshRecommendations()}
                icon={<RefreshCw size={14} aria-hidden="true" />}
                className="bg-[#D5F36A] font-bold text-[#0C111C] hover:bg-[#c8e85d]"
              >
                Cập nhật gợi ý
              </Button>
            </div>
          </div>
        </section>

        <GenerationRecovery recovery={recovery} />

        {applications?.some((item) => item.status === "WITHDRAWN") ? (
          <p className="text-sm text-[#52637A]">
            Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.
          </p>
        ) : null}

        {appliedSyncError ? (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{appliedSyncError}</p>
            <Button className="mt-3" variant="secondary" onClick={() => void refreshAppliedJobs()}>
              Tải lại trạng thái ứng tuyển
            </Button>
          </div>
        ) : null}

        {/* ── TIER EXPLANATIONS BENTO ─────────────────── */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="nova-rec-reveal rounded-2xl border border-[#D6F2EC] bg-[#F0FAF8] p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#237D70] text-xs font-bold text-white">1</span>
              <p className="text-sm font-bold text-[#134B43]">PRIMARY · Phù hợp tổng thể</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#52637A]">
              Đối sánh nội dung và kỹ năng cho CV và việc làm đủ điều kiện cùng ngôn ngữ. Nhóm này được ưu tiên hiển thị trước.
            </p>
          </div>
          <div className="nova-rec-reveal rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">2</span>
              <p className="text-sm font-bold text-amber-900">FALLBACK · Đối sánh kỹ năng</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#52637A]">
              Điểm thể hiện mức đáp ứng kỹ năng, không phải độ phù hợp tổng thể. Không so sánh trực tiếp điểm giữa hai nhóm.
            </p>
          </div>
        </div>

        {/* ── RECS GENERATION CONTROL CARD ────────────── */}
        <section className="nova-rec-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0C111C]">Tạo gợi ý từ CV</h2>
              <p className="mt-0.5 text-xs text-[#52637A]">Chọn CV đã phân tích sẵn sàng (READY) để bắt đầu đối sánh.</p>
            </div>
            <Link to="/candidate/cvs" className="inline-flex items-center gap-1 text-xs font-semibold text-[#134B43] hover:text-[#237D70]">
              <span>Quản lý CV</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <Select
              label="CV dùng để gợi ý"
              value={selectedCvId}
              onChange={(event) => setSelectedCvId(event.target.value)}
              options={[
                { label: cvsQuery.loading ? "Đang tải CV..." : readyCvs.length ? "Chọn CV READY" : "Chưa có CV READY", value: "" },
                ...readyCvs.map((cv) => ({ label: `${cv.name}${cv.active ? " (active)" : ""} - ${cv.analysisStatus}`, value: cv.id })),
              ]}
            />
            <Input
              label="Ngưỡng xếp hạng"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
            <Input
              label="Số kết quả tối đa"
              type="number"
              min="1"
              max="100"
              step="1"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
            />
            <Button
              className="w-full sm:w-auto"
              loading={generating}
              disabled={generateDisabled}
              onClick={() => void refreshRecommendations()}
              icon={<RefreshCw size={15} />}
            >
              Cập nhật gợi ý
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              disabled={jobsQuery.loading || runsQuery.loading}
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Tải lại
            </Button>
          </div>

          {cvsQuery.error ? (
            <div className="mt-4">
              <ErrorState message="Không tải được danh sách CV. Vui lòng tải lại để thử lại." />
            </div>
          ) : null}

          {!cvsQuery.loading && !cvsQuery.error && !cvsQuery.data?.length ? (
            <p className="mt-4 text-sm leading-6 text-[#52637A]">
              Bạn chưa có CV.{" "}
              <Link to="/candidate/cvs/upload" className="font-semibold text-[#134B43] underline">
                Tải CV đầu tiên
              </Link>{" "}
              để phân tích và nhận gợi ý.
            </p>
          ) : null}

          <div className="mt-4 grid gap-2.5 border-t border-[#F0F4F8] pt-4 text-sm sm:grid-cols-2 md:grid-cols-4">
            <InfoPill label="Run mới nhất" value={latestRun ? `#${latestRun.id}` : "Chưa có"} />
            <InfoPill label="Trạng thái" value={latestRun?.status ?? "Chưa có"} />
            <InfoPill label="Số việc đã gợi ý" value={String(latestRun?.totalRecommended ?? displayJobs.length)} />
            <InfoPill label="Thời gian" value={latestRun?.createdAt ?? "Chưa cập nhật"} />
          </div>

          {successfulRuns.length ? (
            <div className="mt-4 grid items-end gap-3 border-t border-[#F0F4F8] pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <Select
                label="Xem kết quả SUCCESS lịch sử"
                value={selectedRunId}
                onChange={(event) => setSelectedRunId(event.target.value)}
                options={[
                  { label: "Dùng kết quả hiện tại", value: "" },
                  ...successfulRuns.map((run) => ({ label: `#${run.id} - SUCCESS - ${run.createdAt}`, value: run.id })),
                ]}
              />
              <div className="pb-1">
                <StatusBadge
                  label={showingHistoricalRun ? "Đang xem kết quả lịch sử" : "Kết quả hiện tại"}
                  tone={showingHistoricalRun ? "warning" : "success"}
                />
              </div>
            </div>
          ) : null}

          {latestRun && !latestRunSuccess && !selectedRunId ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">Run mới nhất không thành công: {latestRun.status}</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                {latestRun.errorMessage ?? "Không thể tạo danh sách gợi ý mới. Vui lòng thử lại hoặc chọn một run SUCCESS trong lịch sử."}
              </p>
            </div>
          ) : null}

          {runsQuery.error ? (
            <p className="mt-3 text-xs text-amber-700">Không tải được lịch sử gợi ý. Kết quả hiện tại vẫn được hiển thị nếu có.</p>
          ) : null}

          {showingHistoricalRun ? (
            <p className="mt-3 text-xs text-amber-700">
              Bạn đang xem kết quả lịch sử từ run #{runDetailQuery.data?.run.id}, không phải kết quả hiện tại.
            </p>
          ) : null}

          {!cvsQuery.loading && (cvsQuery.data?.length ?? 0) > 0 && readyCvs.length === 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p>Chưa có CV nào sẵn sàng để tạo gợi ý. CV cần ở trạng thái READY và có đủ dữ liệu xử lý, metadata ngôn ngữ hợp lệ.</p>
              {notReadyCvs.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {notReadyCvs.slice(0, 3).map((cv) => (
                    <li key={cv.id}>
                      {cv.name}: {cv.readinessReason ?? cv.analysisStatus}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ── FILTER CARD ─────────────────────────────── */}
        <section className="nova-rec-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Select
              label="Điểm hiển thị tối thiểu"
              value={String(filters.minDisplayScore)}
              onChange={(event) => updateFilter("minDisplayScore", Number(event.target.value))}
              options={[
                { label: "Tất cả điểm", value: "0" },
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
              options={[{ label: "Tất cả địa điểm", value: "" }, ...options.locations.map((value) => ({ label: value, value }))]}
            />
            <Select
              label="Vị trí / Lĩnh vực"
              value={filters.industry}
              onChange={(event) => updateFilter("industry", event.target.value)}
              options={[{ label: "Tất cả vị trí", value: "" }, ...options.industries.map((value) => ({ label: value, value }))]}
            />
            <Select
              label="Mức lương"
              value={filters.salary}
              onChange={(event) => updateFilter("salary", event.target.value)}
              options={salaryOptions}
            />
            <Select
              label="Hình thức làm việc"
              value={filters.workMode}
              onChange={(event) => updateFilter("workMode", event.target.value)}
              options={[{ label: "Tất cả hình thức", value: "" }, ...options.workModes.map((value) => ({ label: value, value }))]}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F4F8] pt-4">
            <p className="text-sm font-medium text-[#52637A]">
              {showHidden ? `${filteredJobs.length} việc làm đang bị ẩn` : `${filteredJobs.length} việc làm phù hợp`}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHidden((current) => !current)}
              icon={showHidden ? <BriefcaseBusiness size={14} /> : <EyeOff size={14} />}
            >
              {showHidden ? "Quay lại gợi ý" : `Xem việc đã ẩn (${hiddenIds.length})`}
            </Button>
          </div>
        </section>

        {/* ── JOB SECTIONS / RESULTS ──────────────────── */}
        {jobsQuery.loading || runDetailQuery.loading ? (
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-8 shadow-sm">
            <LoadingState />
          </div>
        ) : (jobsQuery.error && !selectedRunId) || (runDetailQuery.error && selectedRunId) ? (
          <ErrorState message={selectedRunId ? runDetailQuery.error ?? "Không thể tải kết quả lịch sử." : jobsQuery.error ?? "Không thể tải gợi ý."} />
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E9F0] bg-white p-8 shadow-sm">
            <EmptyState message={showHidden ? "Chưa có việc làm nào bị ẩn." : "Chưa có kết quả gợi ý phù hợp với bộ lọc hiện tại."} />
          </div>
        ) : (
          <div className="space-y-6">
            <RecommendedJobSection
              title="Phù hợp tổng thể"
              description="Các việc làm có đủ bằng chứng nội dung và kỹ năng để tính Match Score."
              jobs={primaryJobs}
              savedIds={isSaved}
              canApply={canApply}
              getApplyButtonLabel={getApplyButtonLabel}
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
              canApply={canApply}
              getApplyButtonLabel={getApplyButtonLabel}
              hiddenIds={hiddenIds}
              onToggleSave={(job) => void toggleSave(job)}
              onHide={setHideTarget}
              onRestore={restoreJob}
              onOpenAnalysis={setAnalysisJob}
              onApply={openApply}
            />
            {legacyJobs.length ? (
              <RecommendedJobSection
                title="Kết quả lịch sử"
                description="Các kết quả cũ chưa có ngữ nghĩa xếp hạng V3 đầy đủ. Điểm chỉ dùng để tham khảo lịch sử."
                jobs={legacyJobs}
                savedIds={isSaved}
                canApply={canApply}
                getApplyButtonLabel={getApplyButtonLabel}
                hiddenIds={hiddenIds}
                onToggleSave={(job) => void toggleSave(job)}
                onHide={setHideTarget}
                onRestore={restoreJob}
                onOpenAnalysis={setAnalysisJob}
                onApply={openApply}
              />
            ) : null}
          </div>
        )}

        <MatchAnalysisModal job={analysisJob} onClose={() => setAnalysisJob(null)} />
        <CandidateApplyFlowModal job={applyJob} onClose={() => setApplyJob(null)} />
        <HideJobModal job={hideTarget} onClose={() => setHideTarget(null)} onConfirm={hideJob} />
      </div>
    </PageContainer>
  );
}

/* ── Section Group ───────────────────────────────────── */
function RecommendedJobSection({
  title,
  description,
  jobs,
  savedIds,
  canApply,
  getApplyButtonLabel,
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
  canApply: (id: string) => boolean;
  getApplyButtonLabel: (id: string) => string;
  hiddenIds: string[];
  onToggleSave: (job: CandidateRecommendedJob) => void;
  onHide: (job: CandidateRecommendedJob) => void;
  onRestore: (job: CandidateRecommendedJob) => void;
  onOpenAnalysis: (job: CandidateRecommendedJob) => void;
  onApply: (job: CandidateRecommendedJob) => void;
}) {
  if (!jobs.length) {
    return (
      <div className="nova-rec-reveal rounded-2xl border border-[#E5E9F0] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0C111C]">{title} · 0</h2>
            <p className="mt-0.5 text-xs text-[#52637A]">{description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="nova-rec-reveal flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-[#0C111C]">{title} · {jobs.length}</h2>
          <p className="mt-0.5 text-xs text-[#52637A]">{description}</p>
        </div>
      </div>
      <div className="grid gap-4">
        {jobs.map((job) => (
          <RecommendedJobCard
            key={`${job.rankingTier}-${job.id}`}
            job={job}
            saved={savedIds(job.id)}
            canApply={canApply(job.id)}
            applyLabel={getApplyButtonLabel(job.id)}
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

/* ── Job Card ────────────────────────────────────────── */
function RecommendedJobCard({
  job,
  saved,
  canApply,
  applyLabel,
  hidden,
  onToggleSave,
  onHide,
  onRestore,
  onOpenAnalysis,
  onApply,
}: {
  job: CandidateRecommendedJob;
  saved: boolean;
  canApply: boolean;
  applyLabel: string;
  hidden: boolean;
  onToggleSave: () => void;
  onHide: () => void;
  onRestore: () => void;
  onOpenAnalysis: () => void;
  onApply: () => void;
}) {
  const unavailable = job.status === "unavailable";
  const fallback = job.rankingTier === "FALLBACK";
  const detailPath = `/candidate/jobs/${job.id}`;

  return (
    <div className={`nova-rec-reveal rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${fallback ? "border-[#E5E9F0]" : "border-[#D6F2EC] ring-1 ring-[#AEE6DC]/40"}`}>
      <div className="grid gap-5 xl:grid-cols-[170px_minmax(0,1fr)]">
        {/* Score column */}
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border p-4 xl:block xl:self-start xl:text-center ${
            fallback
              ? "border-amber-200 bg-amber-50/70 text-amber-900"
              : "border-[#D6F2EC] bg-[#F0FAF8] text-[#134B43]"
          }`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">{job.displayScoreLabel}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
              {formatNormalizedScore(job.displayScore)}
            </p>
            <div className="mt-2">
              <ScoreMeter value={job.displayScore} label={job.displayScoreLabel} tier={job.rankingTier} />
            </div>
            {fallback ? <p className="mt-2 text-xs leading-5">Mức đáp ứng kỹ năng</p> : null}
          </div>
          <div className="text-right text-xs leading-5 xl:mt-3 xl:border-t xl:border-current/15 xl:pt-2.5 xl:text-center">
            <p className="font-bold">{job.rankPosition ? `Thứ hạng #${job.rankPosition}` : "Kết quả lịch sử"}</p>
            <p className="text-[11px] opacity-80">
              {job.tierRankPosition ? `#${job.tierRankPosition} trong nhóm ${job.rankingTier}` : job.displayTierLabel}
            </p>
          </div>
        </div>

        {/* Details column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                to={detailPath}
                onClick={(event) => openAuthenticatedTab(event, detailPath)}
                className="text-base font-bold text-[#0C111C] hover:text-[#237D70] sm:text-lg"
              >
                {job.title}
              </Link>
              <p className="mt-0.5 text-sm font-semibold text-[#52637A]">{job.companyName}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-[#52637A]">
                <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F8F6] px-2 py-1 font-medium">
                  <Wallet size={13} className="text-[#237D70]" aria-hidden="true" />
                  {job.salary}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F8F6] px-2 py-1 font-medium">
                  <MapPin size={13} className="text-[#237D70]" aria-hidden="true" />
                  {job.location}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F8F6] px-2 py-1 font-medium">
                  <BriefcaseBusiness size={13} className="text-[#237D70]" aria-hidden="true" />
                  {formatExperience(job.experienceYears, job.experienceLabel)} - {job.scoringStrategyLabel ?? "Chưa cập nhật"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge label={job.displayTierLabel} tone={job.rankingTier === "PRIMARY" ? "success" : "warning"} />
              {hidden ? <StatusBadge label="Đã ẩn" tone="warning" /> : null}
              {unavailable ? <StatusBadge label="Không còn khả dụng" tone="danger" /> : null}
              <StatusBadge label={job.industry} />
            </div>
          </div>

          {/* Skills match/missing */}
          <div className="mt-3.5 grid gap-3 md:grid-cols-2">
            <SkillGroup title="Kỹ năng khớp" skills={job.matchedSkills} tone="success" emptyLabel="Chưa có kỹ năng khớp" />
            <SkillGroup title="Kỹ năng còn thiếu" skills={job.missingSkills} tone="warning" emptyLabel="Không có kỹ năng thiếu được ghi nhận" />
          </div>

          {/* Recommendation reasons */}
          <div className="mt-3.5 rounded-xl bg-[#F7F8F6] p-3 text-xs">
            <p className="font-bold text-[#0C111C]">Lý do được gợi ý</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[#52637A]">
              {job.recommendationReasons.length ? (
                job.recommendationReasons.map((reason) => <li key={reason}>{reason}</li>)
              ) : (
                <li>Chưa có lý do gợi ý cho kết quả này.</li>
              )}
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#F0F4F8] pt-3.5">
            <Button variant="secondary" size="sm" icon={<BarChart3 size={14} />} onClick={onOpenAnalysis}>
              Xem phân tích
            </Button>
            <Button
              variant={saved ? "primary" : "secondary"}
              size="sm"
              icon={saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              onClick={onToggleSave}
            >
              {saved ? "Bỏ lưu" : "Lưu"}
            </Button>
            <Button
              size="sm"
              icon={<Send size={14} />}
              onClick={onApply}
              disabled={!canApply || unavailable}
            >
              {applyLabel}
            </Button>
            <Link to={detailPath} onClick={(event) => openAuthenticatedTab(event, detailPath)}>
              <Button variant="secondary" size="sm">Xem chi tiết</Button>
            </Link>
            {hidden ? (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={onRestore}>
                Khôi phục
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<EyeOff size={14} />} onClick={onHide}>
                Ẩn
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function openAuthenticatedTab(event: MouseEvent<HTMLAnchorElement>, path: string) {
  event.preventDefault();
  window.open(createAuthenticatedTabUrl(path), "_blank", "noopener,noreferrer");
}

function SkillGroup({
  title,
  skills,
  tone,
  emptyLabel,
}: {
  title: string;
  skills: string[];
  tone: "success" | "warning";
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-[#0C111C]">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {skills.length ? (
          skills.map((skill) => (
            <span
              key={skill}
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                tone === "success"
                  ? "border border-[#D6F2EC] bg-[#F0FAF8] text-[#134B43]"
                  : "border border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {skill}
            </span>
          ))
        ) : (
          <span className="text-xs text-[#9BB0C9]">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function HideJobModal({
  job,
  onClose,
  onConfirm,
}: {
  job: CandidateRecommendedJob | null;
  onClose: () => void;
  onConfirm: (job: CandidateRecommendedJob) => void;
}) {
  return (
    <Modal open={Boolean(job)} title="Ẩn việc làm gợi ý" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[#52637A]">
          Bạn có muốn ẩn tin <strong className="text-[#0C111C]">{job?.title}</strong> khỏi danh sách việc làm gợi ý không?
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
    <Modal
      open={Boolean(job)}
      title={`Phân tích ${job?.displayScoreLabel ?? "kết quả"} ${formatNormalizedScore(job?.displayScore)}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div>
          <p className="text-base font-bold text-[#0C111C]">{job?.title}</p>
          <p className="mt-0.5 text-sm font-medium text-[#52637A]">{job?.companyName}</p>
        </div>
        <div className="grid gap-2.5 text-sm sm:grid-cols-2">
          <InfoPill label="Hạng gợi ý" value={job?.rankPosition ? `#${job.rankPosition}` : "Chưa cập nhật"} />
          <InfoPill label={job?.displayScoreLabel ?? "Điểm hiển thị"} value={formatNormalizedScore(job?.displayScore)} />
          <InfoPill label="Điểm tổng thể" value={formatNormalizedScore(job?.overallScore)} />
          <InfoPill label="Điểm nội dung" value={formatNormalizedScore(job?.textScore)} />
          <InfoPill label="Skill Score" value={formatNormalizedScore(job?.skillScore)} />
          <InfoPill label="Chiến lược" value={job?.scoringStrategyLabel ?? "Chưa cập nhật"} />
          <InfoPill label="Ngày tạo kết quả" value={job?.postedAt ?? "Chưa cập nhật"} />
          <InfoPill label="Số kỹ năng khớp" value={String(job?.matchedSkills.length ?? 0)} />
        </div>
        <div className="rounded-xl border border-[#E5E9F0] p-3.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#0C111C]">Kỹ năng khớp</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(job?.matchedSkills.length ? job.matchedSkills : ["Chưa cập nhật"]).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full border border-[#D6F2EC] bg-[#F0FAF8] px-2.5 py-0.5 text-xs font-semibold text-[#134B43]"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-[#E5E9F0] p-3.5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#0C111C]">Kỹ năng còn thiếu</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job?.missingSkills?.length ? (
              job.missingSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#9BB0C9]">Không có kỹ năng thiếu được ghi nhận</span>
            )}
          </div>
        </div>
        {job?.rankingTier === "FALLBACK" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            FALLBACK chỉ đối sánh kỹ năng. Điểm nội dung và điểm tổng thể không áp dụng; điểm này không cùng thang đo với PRIMARY.
          </p>
        ) : null}
        <div className="rounded-xl bg-[#F7F8F6] p-3.5">
          <p className="text-xs font-bold text-[#0C111C]">Lý do gợi ý</p>
          <div className="mt-1.5 space-y-1 text-xs text-[#52637A]">
            {job?.recommendationReasons.length ? (
              job.recommendationReasons.map((reason) => <p key={reason}>{reason}</p>)
            ) : (
              <p>Chưa có giải thích cho kết quả này.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F8F6] p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#9BB0C9]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[#0C111C]">{value}</p>
    </div>
  );
}

function filterRecommendedJobs(
  jobs: CandidateRecommendedJob[],
  filters: RecommendedJobFilters,
  hiddenIds: string[],
  showHidden: boolean,
) {
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
  return (left.tierRankPosition ?? Number.MAX_SAFE_INTEGER) - (right.tierRankPosition ?? Number.MAX_SAFE_INTEGER);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
