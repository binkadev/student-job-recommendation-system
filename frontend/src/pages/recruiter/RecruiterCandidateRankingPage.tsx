import { AlertTriangle, ArrowLeft, History, RefreshCw, RotateCcw } from "lucide-react";
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
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import {
  createCandidateRankingRun,
  getCandidateRankingJob,
  getCandidateRankingRun,
  getCandidateRankingRuns,
  openCandidateRankingCv,
  saveRankingCandidate,
  updateRankingApplicationStatus,
} from "../../features/recruiter/candidate-ranking/candidateRankingApi";
import { sanitizeErrorMessage } from "../../features/recruiter/candidate-ranking/candidateRankingMappers";
import { CandidateRankingAnalysisModal } from "../../features/recruiter/candidate-ranking/CandidateRankingAnalysisModal";
import { CandidateRankingRunHistory } from "../../features/recruiter/candidate-ranking/CandidateRankingRunHistory";
import { CandidateRankingSummary } from "../../features/recruiter/candidate-ranking/CandidateRankingSummary";
import { CandidateRankingTable } from "../../features/recruiter/candidate-ranking/CandidateRankingTable";
import type { CandidateRankingResult } from "../../features/recruiter/candidate-ranking/candidateRankingTypes";
import { getApiErrorMessage } from "../../utils/apiErrors";

export function RecruiterCandidateRankingPage() {
  const { jobId = "" } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [threshold, setThreshold] = useState("0.3");
  const [limit, setLimit] = useState("50");
  const [creating, setCreating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [analysisResult, setAnalysisResult] = useState<CandidateRankingResult | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");
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
  const results = runDetail?.results ?? [];
  const isProcessing = run?.status === "PROCESSING" || run?.status === "PENDING";
  const canCreateRun = !creating && !isProcessing && Boolean(jobId);
  const skipTotal = (run?.skippedNoCv ?? 0) + (run?.skippedNotReady ?? 0) + (run?.skippedTerminalStatus ?? 0);
  const showingHistoricalRun = Boolean(selectedRunId && selectedRunId !== latestRunId);

  useEffect(() => {
    if (!isProcessing || selectedRunId) return;
    const timer = window.setTimeout(() => setReloadKey((current) => current + 1), 5000);
    return () => window.clearTimeout(timer);
  }, [isProcessing, selectedRunId, reloadKey]);

  const filteredRuns = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);

  async function createRun() {
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

    setCreating(true);
    try {
      const detail = await createCandidateRankingRun(jobId, { threshold: thresholdValue, limit: limitValue });
      setSelectedRunId(detail.run.id);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã chạy xếp hạng ứng viên", message: `Run #${detail.run.id}` });
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

  async function updateStatus(result: CandidateRankingResult, status: string) {
    if (!status) return;
    setUpdatingApplicationId(result.applicationId);
    try {
      await updateRankingApplicationStatus(result.applicationId, status);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật trạng thái ứng tuyển" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getApiErrorMessage(error) });
    } finally {
      setUpdatingApplicationId("");
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
      <Card className="mb-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>Điểm phù hợp chỉ hỗ trợ sàng lọc ban đầu, không thay thế quyết định tuyển dụng của nhà tuyển dụng.</p>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">{jobQuery.data.title}</h2>
              <StatusBadge label={jobQuery.data.status} tone={jobStatusTone(jobQuery.data.status)} />
            </div>
            <p className="mt-2 text-sm text-slate-600">{jobQuery.data.location} · {jobQuery.data.jobType} · {jobQuery.data.workingModel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/recruiter/jobs/${jobId}`}><Button variant="secondary" icon={<ArrowLeft size={16} />}>Quay lại việc làm</Button></Link>
            <Button variant="secondary" icon={<History size={16} />} onClick={() => setHistoryOpen((current) => !current)}>Xem lịch sử</Button>
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tải lại</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[160px_160px_auto]">
          <Input label="Threshold" type="number" min="0" max="1" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          <Input label="Limit" type="number" min="1" max="100" step="1" value={limit} onChange={(event) => setLimit(event.target.value)} />
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
          <EmptyState message="Chưa có run xếp hạng cho tin tuyển dụng này. Bấm Chạy xếp hạng để Backend tạo ranking run." />
        </Card>
      ) : null}

      {run ? (
        <div className="mt-5 space-y-5">
          {showingHistoricalRun ? (
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800">Đang hiển thị kết quả lịch sử từ run #{run.id}. Kết quả này không phải run mới nhất.</p>
            </Card>
          ) : null}
          {isProcessing ? (
            <Card>
              <LoadingState message="Backend đang xếp hạng ứng viên. Trang sẽ tự tải lại sau vài giây." />
            </Card>
          ) : null}
          {run.status === "FAILED" ? (
            <Card className="border-red-200 bg-red-50">
              <SectionHeader title={`Run #${run.id} thất bại`} description={sanitizeErrorMessage(run.errorMessage)} />
            </Card>
          ) : null}
          <CandidateRankingSummary run={run} />
          <Card>
            <SectionHeader title="Thống kê bỏ qua" description={`Không có CV: ${run.skippedNoCv} · CV chưa sẵn sàng: ${run.skippedNotReady} · Trạng thái kết thúc: ${run.skippedTerminalStatus} · Tổng bỏ qua: ${skipTotal}`} />
          </Card>
          {run.status === "SUCCESS" && results.length === 0 ? (
            <Card><EmptyState message="Không có ứng viên vượt threshold hoặc chưa có application đủ điều kiện cho tin tuyển dụng này." /></Card>
          ) : null}
          {results.length ? (
            <Card>
              <SectionHeader title="Top ứng viên" description={`${results.length} kết quả, giữ nguyên rankPosition từ Backend.`} />
              <CandidateRankingTable
                results={results}
                savedApplicationIds={savedApplicationIds}
                updatingId={updatingApplicationId}
                onAnalyze={setAnalysisResult}
                onOpenCv={(result) => void openCv(result)}
                onSave={(result) => void saveCandidate(result)}
                onUpdateStatus={(result, status) => void updateStatus(result, status)}
              />
            </Card>
          ) : null}
        </div>
      ) : null}

      <CandidateRankingAnalysisModal result={analysisResult} run={run} onClose={() => setAnalysisResult(null)} onOpenCv={(result) => void openCv(result)} />
    </PageContainer>
  );
}

function getRankingErrorMessage(error?: string | null) {
  if (!error) return "Không thể tải dữ liệu xếp hạng ứng viên.";
  if (error.includes("403")) return "Bạn không có quyền truy cập tin tuyển dụng hoặc ranking run này.";
  if (error.includes("404")) return "Không tìm thấy tin tuyển dụng hoặc ranking run.";
  if (error.includes("409")) return "Tin tuyển dụng này đang có ranking run xử lý. Vui lòng đợi hoàn tất rồi thử lại.";
  if (error.includes("500") || error.toLowerCase().includes("internal server error")) {
    return "Backend đang lỗi khi tải dữ liệu xếp hạng ứng viên. Vui lòng kiểm tra log BE, version container và schema Candidate Ranking.";
  }
  return error;
}

function getCreateRunErrorMessage(error: unknown) {
  const message = getApiErrorMessage(error, "Không thể tạo lượt xếp hạng ứng viên. Vui lòng thử lại.");
  if (message.toLowerCase().includes("internal server error")) {
    return "Backend đang lỗi khi tạo lượt xếp hạng ứng viên. Vui lòng kiểm tra log BE, version container và schema Candidate Ranking.";
  }
  return message;
}

function jobStatusTone(status: string) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING_APPROVAL" || status === "DRAFT") return "warning" as const;
  if (status === "REJECTED" || status === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}
