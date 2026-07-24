import { BarChart3, Bookmark, BookmarkCheck, BriefcaseBusiness, EyeOff, MapPin, RotateCcw, Send, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
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
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { Select } from "../../../components/ui/Select";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useSavedJobs } from "../../../hooks/useSavedJobs";
import { useToast } from "../../../hooks/useToast";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";
import { CandidateApplyFlowModal, type ApplyFlowJob } from "../apply/CandidateApplyFlowModal";
import {
  getRecommendedFilterOptions,
  getRecommendedJobs,
  getRecommendedJobState,
  saveRecommendedJobState,
} from "./recommendedJobsService";
import type { CandidateRecommendedJob, MatchCriterion, RecommendedJobFilters } from "./recommendedJobsTypes";

const pageSize = 6;

const defaultFilters: RecommendedJobFilters = {
  minMatch: 55,
  location: "",
  industry: "",
  salary: "",
  experience: "",
  workMode: "",
};

const salaryOptions = [
  { label: "Tất cả", value: "" },
  { label: "Từ 10 triệu", value: "10" },
  { label: "Từ 15 triệu", value: "15" },
  { label: "Từ 20 triệu", value: "20" },
  { label: "Từ 30 triệu", value: "30" },
];

const experienceOptions = [
  { label: "Tất cả", value: "" },
  { label: "Thực tập", value: "Thực tập" },
  { label: "0-1 năm", value: "0-1" },
  { label: "1-2 năm", value: "1-2" },
  { label: "3+ năm", value: "3+" },
  { label: "5+ năm", value: "5+" },
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
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const { hasApplied } = useAppliedJobs();
  const { showToast } = useToast();

  const jobsQuery = useAsyncData(() => getRecommendedJobs(filters, showHidden ? [] : hiddenIds), [filters, hiddenIds, showHidden]);
  const options = useMemo(() => getRecommendedFilterOptions(jobsQuery.data ?? []), [jobsQuery.data]);

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
      <PageHeader
        title="Việc làm gợi ý"
        description="Danh sách việc làm đang tuyển trong cơ sở dữ liệu, giữ nguyên cách hiển thị gợi ý hiện có."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select
            label="Match score tối thiểu"
            value={String(filters.minMatch)}
            onChange={(event) => updateFilter("minMatch", Number(event.target.value))}
            options={[
              { label: "Từ 55%", value: "55" },
              { label: "Từ 65%", value: "65" },
              { label: "Từ 75%", value: "75" },
              { label: "Từ 85%", value: "85" },
              { label: "Từ 90%", value: "90" },
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
          <Select label="Kinh nghiệm" value={filters.experience} onChange={(event) => updateFilter("experience", event.target.value)} options={experienceOptions} />
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
      ) : pagedJobs.length === 0 ? (
        <EmptyState message={showHidden ? "Chưa có việc làm nào bị ẩn." : "Không có việc làm phù hợp với bộ lọc hiện tại."} />
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
          <p className="text-xs font-semibold uppercase text-emerald-700">Match score</p>
          <p className="mt-2 text-4xl font-bold text-emerald-700">{job.matchScore}%</p>
          <p className="mt-1 text-xs text-emerald-700">Tổng điểm có trọng số</p>
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
                <span className="inline-flex items-center gap-1"><BriefcaseBusiness size={15} />{job.experienceLabel} · {job.workMode}</span>
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
              {job.recommendationReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
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
  const criteria = useMemo<MatchCriterion[]>(() => {
    if (!job) return [];
    return [
      { label: "Kỹ năng", value: job.skillScore, explanation: `Khớp ${job.matchedSkills.length} kỹ năng chính.` },
      { label: "Kinh nghiệm", value: job.experienceScore, explanation: `Yêu cầu ${job.experienceLabel}, suy ra từ thông tin bài tuyển dụng hiện có.` },
      { label: "Học vấn", value: job.educationScore, explanation: "Điểm học vấn sẽ chính xác hơn khi thuật toán gợi ý CV được nối ở phase sau." },
      { label: "Địa điểm", value: job.locationScore, explanation: `Địa điểm: ${job.location}.` },
      { label: "Mức lương", value: job.salaryScore, explanation: `Khoảng lương: ${job.salary}.` },
      { label: "Hình thức làm việc", value: job.workModeScore, explanation: `Hình thức: ${job.workMode}.` },
      { label: "Tổng điểm có trọng số", value: job.matchScore, explanation: "Tạm tính từ job ACTIVE, kỹ năng, địa điểm, lương và hình thức làm việc đang có trong DB." },
    ];
  }, [job]);

  return (
    <Modal open={Boolean(job)} title={`Phân tích độ phù hợp ${job?.matchScore ?? 0}%`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">{job?.title}</p>
          <p className="mt-1 text-sm text-slate-600">{job?.companyName}</p>
        </div>
        {criteria.map((criterion) => (
          <div key={criterion.label} className="rounded-md border border-slate-100 p-3">
            <ProgressBar value={criterion.value} label={criterion.label} />
            <p className="mt-2 text-sm text-slate-600">{criterion.explanation}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
