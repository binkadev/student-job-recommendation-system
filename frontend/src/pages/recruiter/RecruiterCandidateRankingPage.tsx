import { ArrowLeft, History, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { CandidateRankingAnalysisModal } from "../../features/recruiter/candidate-ranking/CandidateRankingAnalysisModal";
import {
  createCandidateRankingRun,
  getCandidateRankingJob,
  getCandidateRankingRun,
  getCandidateRankingRuns,
  openCandidateRankingCv,
  saveRankingCandidate,
} from "../../features/recruiter/candidate-ranking/candidateRankingApi";
import { sanitizeErrorMessage } from "../../features/recruiter/candidate-ranking/candidateRankingMappers";
import { CandidateRankingRunHistory } from "../../features/recruiter/candidate-ranking/CandidateRankingRunHistory";
import { CandidateRankingSummary } from "../../features/recruiter/candidate-ranking/CandidateRankingSummary";
import { CandidateRankingTable } from "../../features/recruiter/candidate-ranking/CandidateRankingTable";
import type { CandidateRankingResult } from "../../features/recruiter/candidate-ranking/candidateRankingTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { getApiErrorMessage } from "../../utils/apiErrors";

export function RecruiterCandidateRankingPage() {
  const { jobId = "" } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [threshold, setThreshold] = useState("0.3");
  const [primaryLimit, setPrimaryLimit] = useState("30");
  const [fallbackLimit, setFallbackLimit] = useState("30");
  const [creating, setCreating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [analysisResult, setAnalysisResult] = useState<CandidateRankingResult | null>(null);
  const [savedApplicationIds, setSavedApplicationIds] = useState<Set<string>>(() => new Set());

  const jobQuery = useAsyncData(() => getCandidateRankingJob(jobId), [jobId]);
  const runsQuery = useAsyncData(() => getCandidateRankingRuns(jobId), [jobId, reloadKey]);
  const latestRunId = runsQuery.data?.[0]?.id ?? "";
  const effectiveRunId = selectedRunId || latestRunId;
  const runDetailQuery = useAsyncData(
    () => (effectiveRunId ? getCandidateRankingRun(jobId, effectiveRunId) : Promise.resolve(null)),
    [jobId, effectiveRunId, reloadKey],
  );

  const runDetail = runDetailQuery.data;
  const run = runDetail?.run ?? null;
  const results = useMemo(() => runDetail?.results ?? [], [runDetail?.results]);
  const primaryResults = useMemo(() => results.filter((result) => result.rankingTier === "PRIMARY").sort(compareTierRank), [results]);
  const fallbackResults = useMemo(() => results.filter((result) => result.rankingTier === "FALLBACK").sort(compareTierRank), [results]);
  const isProcessing = run?.status === "PROCESSING" || run?.status === "PENDING";
  const canCreateRun = !creating && !isProcessing && Boolean(jobId);
  useEffect(() => {
    if (!isProcessing || selectedRunId) return;
    const timer = window.setTimeout(() => setReloadKey((current) => current + 1), 5000);
    return () => window.clearTimeout(timer);
  }, [isProcessing, selectedRunId, reloadKey]);

  const filteredRuns = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);

  async function createRun() {
    const thresholdValue = Number(threshold);
    const primaryLimitValue = Number(primaryLimit);
    const fallbackLimitValue = Number(fallbackLimit);
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      showToast({ type: "error", title: "Ngưỡng điểm không hợp lệ", message: "Ngưỡng điểm phải nằm trong khoảng 0 đến 1." });
      return;
    }
    if (!Number.isInteger(primaryLimitValue) || primaryLimitValue < 1 || primaryLimitValue > 100 || !Number.isInteger(fallbackLimitValue) || fallbackLimitValue < 1 || fallbackLimitValue > 100) {
      showToast({ type: "error", title: "Giới hạn kết quả không hợp lệ", message: "Giới hạn kết quả phải nằm trong khoảng 1 đến 100." });
      return;
    }

    setCreating(true);
    try {
      const detail = await createCandidateRankingRun(jobId, { threshold: thresholdValue, limit: Math.min(primaryLimitValue, fallbackLimitValue), primaryLimit: primaryLimitValue, fallbackLimit: fallbackLimitValue });
      setSelectedRunId(detail.run.id);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã chạy xếp hạng ứng viên", message: `Lần chạy #${detail.run.id}` });
    } catch (error) {
      showToast({ type: "error", title: "Không thể chạy xếp hạng", message: getCreateRunErrorMessage(error) });
    } finally {
      setCreating(false);
    }
  }

  async function openCv(result: CandidateRankingResult) {
    try {
      await openCandidateRankingCv(result.applicationId);
    } catch (error) {
      showToast({ type: "error", title: "Không thể mở CV", message: getApiErrorMessage(error) });
    }
  }

  async function saveCandidate(result: CandidateRankingResult) {
    try {
      await saveRankingCandidate(result.applicationId);
      setSavedApplicationIds((current) => new Set(current).add(result.applicationId));
      showToast({ type: "success", title: "Đã lưu hồ sơ ứng viên", message: result.studentName });
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu hồ sơ", message: getApiErrorMessage(error) });
    }
  }

  if (jobQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (jobQuery.error || !jobQuery.data) {
    return (
      <PageContainer>
        <PageHeader title="Ứng viên phù hợp" description="Không thể tải thông tin tin tuyển dụng." />
        <ErrorState message={getRankingErrorMessage(jobQuery.error)} />
        <div className="mt-4">
          <Link to="/recruiter/jobs"><Button variant="secondary" icon={<ArrowLeft size={16} />}>Quay lại danh sách việc làm</Button></Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Ứng viên phù hợp" description="Xếp hạng ứng viên đã ứng tuyển theo từng tin tuyển dụng." />
      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">{jobQuery.data.title}</h2>
              <StatusBadge label={jobStatusLabel(jobQuery.data.status)} tone={jobStatusTone(jobQuery.data.status)} />
            </div>
            <p className="mt-2 text-sm text-slate-600">{jobQuery.data.location} · {jobQuery.data.jobType} · {jobQuery.data.workingModel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/recruiter/jobs/${jobId}`}><Button variant="secondary" icon={<ArrowLeft size={16} />}>Quay lại việc làm</Button></Link>
            <Button variant="secondary" icon={<History size={16} />} onClick={() => setHistoryOpen((current) => !current)}>Xem lịch sử</Button>
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tải lại</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[160px_190px_190px_auto]">
          <Input label="Ngưỡng điểm" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          <Input label="Top phù hợp tổng thể" type="number" min="1" max="100" step="1" value={primaryLimit} onChange={(event) => setPrimaryLimit(event.target.value)} />
          <Input label="Top đối sánh kỹ năng" type="number" min="1" max="100" step="1" value={fallbackLimit} onChange={(event) => setFallbackLimit(event.target.value)} />
          <div className="flex items-end">
            <Button className="w-full lg:w-auto" loading={creating} disabled={!canCreateRun} icon={run ? <RotateCcw size={16} /> : <RefreshCw size={16} />} onClick={() => void createRun()}>
              {run ? "Chạy lại" : "Chạy xếp hạng"}
            </Button>
          </div>
        </div>
      </Card>

      {historyOpen ? (
        <div className="mt-5">
          {runsQuery.loading ? <LoadingState /> : <CandidateRankingRunHistory runs={filteredRuns} selectedRunId={selectedRunId} onSelect={setSelectedRunId} />}
          {runsQuery.error ? <ErrorState message={getRankingErrorMessage(runsQuery.error)} /> : null}
        </div>
      ) : null}

      {runsQuery.loading || runDetailQuery.loading ? <div className="mt-5"><LoadingState /></div> : null}
      {runsQuery.error ? <div className="mt-5"><ErrorState message={getRankingErrorMessage(runsQuery.error)} /></div> : null}
      {runDetailQuery.error ? <div className="mt-5"><ErrorState message={getRankingErrorMessage(runDetailQuery.error)} /></div> : null}

      {!runsQuery.loading && !runDetailQuery.loading && !runsQuery.error && !runDetailQuery.error && !run ? (
        <Card className="mt-5">
          <EmptyState message="Chưa có lượt xếp hạng cho tin tuyển dụng này." />
        </Card>
      ) : null}

      {run ? (
        <div className="mt-5 space-y-5">
          {isProcessing ? (
            <Card>
              <LoadingState message="Đang xếp hạng ứng viên..." />
            </Card>
          ) : null}
          {run.status === "FAILED" ? (
            <Card className="border-red-200 bg-red-50">
              <SectionHeader title={`Lần chạy #${run.id} thất bại`} description={sanitizeErrorMessage(run.errorMessage)} />
            </Card>
          ) : null}
          <CandidateRankingSummary run={run} />
          {run.status === "SUCCESS" && results.length === 0 ? (
            <Card><EmptyState message="Chưa có ứng viên đủ điều kiện hoặc chưa vượt ngưỡng xếp hạng." /></Card>
          ) : null}
          {results.length ? (
            <>
              <RankingTierSection
                title="Phù hợp tổng thể"
                description="Ứng viên có đủ bằng chứng nội dung và kỹ năng để tính Match Score."
                results={primaryResults}
                savedApplicationIds={savedApplicationIds}
                onAnalyze={setAnalysisResult}
                onSave={(result) => void saveCandidate(result)}
              />
              <RankingTierSection
                title="Đối sánh kỹ năng"
                description="Ứng viên được xếp theo mức đáp ứng kỹ năng, không so sánh chéo với nhóm phù hợp tổng thể."
                results={fallbackResults}
                savedApplicationIds={savedApplicationIds}
                onAnalyze={setAnalysisResult}
                onSave={(result) => void saveCandidate(result)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <CandidateRankingAnalysisModal result={analysisResult} run={run} onClose={() => setAnalysisResult(null)} onOpenCv={(result) => void openCv(result)} />
    </PageContainer>
  );
}

function RankingTierSection({
  title,
  description,
  results,
  savedApplicationIds,
  onAnalyze,
  onSave,
}: {
  title: string;
  description: string;
  results: CandidateRankingResult[];
  savedApplicationIds: Set<string>;
  onAnalyze: (result: CandidateRankingResult) => void;
  onSave: (result: CandidateRankingResult) => void;
}) {
  if (!results.length) {
    return (
      <Card>
        <SectionHeader title={`${title} · 0`} description={description} />
        <EmptyState message={title === "Phù hợp tổng thể" ? "Chưa có ứng viên đủ điều kiện để tính độ phù hợp tổng thể." : "Chưa có ứng viên trong nhóm đối sánh kỹ năng."} />
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title={`${title} · ${results.length}`} description={description} />
      <CandidateRankingTable
        results={results}
        savedApplicationIds={savedApplicationIds}
        onAnalyze={onAnalyze}
        onSave={onSave}
      />
    </Card>
  );
}

function compareTierRank(left: CandidateRankingResult, right: CandidateRankingResult) {
  return left.tierRankPosition - right.tierRankPosition;
}

function getRankingErrorMessage(error?: string | null) {
  if (!error) return "Không thể tải dữ liệu xếp hạng ứng viên.";
  if (error.includes("403")) return "Bạn không có quyền truy cập tin tuyển dụng hoặc lượt xếp hạng này.";
  if (error.includes("404")) return "Không tìm thấy tin tuyển dụng hoặc lượt xếp hạng.";
  if (error.includes("409")) return "Tin tuyển dụng này đang có lượt xếp hạng xử lý. Vui lòng đợi hoàn tất rồi thử lại.";
  if (error.includes("500") || error.toLowerCase().includes("internal server error")) {
    return "Không thể tải dữ liệu xếp hạng ứng viên. Vui lòng tải lại trang rồi thử lại.";
  }
  return error;
}

function getCreateRunErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error, "Không thể tạo lượt xếp hạng ứng viên. Vui lòng thử lại.");
  if (message.toLowerCase().includes("internal server error")) {
    return "Không thể tạo lượt xếp hạng ứng viên. Vui lòng tải lại trang rồi thử lại.";
  }
  return sanitizeErrorMessage(message);
}

function jobStatusTone(status: string) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING_APPROVAL" || status === "DRAFT") return "warning" as const;
  if (status === "REJECTED" || status === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}

function jobStatusLabel(status: string) {
  if (status === "ACTIVE") return "Đang tuyển";
  if (status === "PENDING_APPROVAL") return "Chờ duyệt";
  if (status === "DRAFT") return "Bản nháp";
  if (status === "REJECTED") return "Bị từ chối";
  if (status === "EXPIRED") return "Hết hạn";
  if (status === "CLOSED") return "Đã đóng";
  return "Chưa cập nhật";
}
