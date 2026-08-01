import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
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
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import {
  getCandidateRankingApplications,
  getCandidateRankingJob,
  openCandidateRankingCv,
  saveRankingCandidate,
  updateRankingApplicationStatus,
} from "../../features/recruiter/candidate-ranking/candidateRankingApi";
import { CandidateRankingAnalysisModal } from "../../features/recruiter/candidate-ranking/CandidateRankingAnalysisModal";
import { CandidateRankingSummary } from "../../features/recruiter/candidate-ranking/CandidateRankingSummary";
import { CandidateRankingTable } from "../../features/recruiter/candidate-ranking/CandidateRankingTable";
import type { CandidateRankingResult } from "../../features/recruiter/candidate-ranking/candidateRankingTypes";
import { getApiErrorMessage } from "../../utils/apiErrors";

export function RecruiterCandidateRankingPage() {
  const { jobId = "" } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<CandidateRankingResult | null>(null);
  const [updatingApplicationId, setUpdatingApplicationId] = useState("");

  const jobQuery = useAsyncData(() => getCandidateRankingJob(jobId), [jobId]);
  const applicationsQuery = useAsyncData(() => getCandidateRankingApplications(jobId), [jobId, reloadKey]);
  const run = applicationsQuery.data?.run ?? null;
  const results = applicationsQuery.data?.results ?? [];
  const skipTotal = (run?.skippedNoCv ?? 0) + (run?.skippedNotReady ?? 0) + (run?.skippedTerminalStatus ?? 0);

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
      setReloadKey((current) => current + 1);
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
      <PageHeader title="Ứng viên phù hợp" description="Hiển thị danh sách ứng viên đã ứng tuyển theo tin tuyển dụng từ dữ liệu Backend hiện có." />
      <Card className="mb-5 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <p>BE hiện có API danh sách ứng viên theo tin tuyển dụng. API xếp hạng AI cho recruiter chưa có controller REST, nên FE không gọi endpoint ranking run để tránh lỗi 404.</p>
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
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tải lại</Button>
          </div>
        </div>
      </Card>

      {applicationsQuery.loading ? <div className="mt-5"><LoadingState /></div> : null}
      {applicationsQuery.error ? <div className="mt-5"><ErrorState message={getRankingErrorMessage(applicationsQuery.error)} /></div> : null}

      {!applicationsQuery.loading && !applicationsQuery.error && run ? (
        <div className="mt-5 space-y-5">
          <CandidateRankingSummary run={run} />
          <Card>
            <SectionHeader title="Thống kê hồ sơ" description={`Không có CV: ${run.skippedNoCv} · Trạng thái kết thúc: ${run.skippedTerminalStatus} · Tổng bỏ qua: ${skipTotal}`} />
          </Card>
          {results.length === 0 ? (
            <Card>
              <EmptyState message="Chưa có ứng viên ứng tuyển vào tin tuyển dụng này." />
            </Card>
          ) : (
            <Card>
              <SectionHeader title="Ứng viên đã ứng tuyển" description={`${results.length} hồ sơ lấy từ API /companies/me/jobs/${jobId}/applications.`} />
              <CandidateRankingTable
                results={results}
                updatingId={updatingApplicationId}
                onAnalyze={setAnalysisResult}
                onOpenCv={(result) => void openCv(result)}
                onSave={(result) => void saveCandidate(result)}
                onUpdateStatus={(result, status) => void updateStatus(result, status)}
              />
            </Card>
          )}
        </div>
      ) : null}

      <CandidateRankingAnalysisModal result={analysisResult} run={run} onClose={() => setAnalysisResult(null)} onOpenCv={(result) => void openCv(result)} />
    </PageContainer>
  );
}

function getRankingErrorMessage(error?: string | null) {
  if (!error) return "Không thể tải dữ liệu ứng viên.";
  if (error.includes("403")) return "Bạn không có quyền truy cập tin tuyển dụng này.";
  if (error.includes("404")) return "Không tìm thấy tin tuyển dụng hoặc danh sách ứng viên.";
  return error;
}

function jobStatusTone(status: string) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING_APPROVAL" || status === "DRAFT") return "warning" as const;
  if (status === "REJECTED" || status === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}
