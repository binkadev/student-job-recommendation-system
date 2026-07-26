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
import { Select } from "../../../components/ui/Select";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useSavedJobs } from "../../../hooks/useSavedJobs";
import { useToast } from "../../../hooks/useToast";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";
import { CandidateApplyFlowModal, type ApplyFlowJob } from "../apply/CandidateApplyFlowModal";
import {
  generateRecommendations,
  getCandidateCvOptions,
  getRecommendationRuns,
  getRecommendedFilterOptions,
  getRecommendedJobs,
  getRecommendedJobState,
  saveRecommendedJobState,
} from "./recommendedJobsService";
import type { CandidateRecommendedJob, RecommendedJobFilters } from "./recommendedJobsTypes";

const pageSize = 6;

const defaultFilters: RecommendedJobFilters = {
  minMatch: 0,
  location: "",
  industry: "",
  salary: "",
  experience: "",
  workMode: "",
};

const salaryOptions = [
  { label: "Tat ca", value: "" },
  { label: "Tu 10 trieu", value: "10" },
  { label: "Tu 15 trieu", value: "15" },
  { label: "Tu 20 trieu", value: "20" },
  { label: "Tu 30 trieu", value: "30" },
];

const experienceOptions = [
  { label: "Tat ca", value: "" },
  { label: "Thuc tap", value: "Thuc tap" },
  { label: "0-1 nam", value: "0-1" },
  { label: "1-2 nam", value: "1-2" },
  { label: "3+ nam", value: "3+" },
  { label: "5+ nam", value: "5+" },
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
  const [reloadKey, setReloadKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const { hasApplied } = useAppliedJobs();
  const { showToast } = useToast();

  const cvsQuery = useAsyncData(() => getCandidateCvOptions(), [reloadKey]);
  const runsQuery = useAsyncData(() => getRecommendationRuns(), [reloadKey]);
  const jobsQuery = useAsyncData(() => getRecommendedJobs(filters, showHidden ? [] : hiddenIds), [filters, hiddenIds, showHidden, reloadKey]);
  const options = useMemo(() => getRecommendedFilterOptions(jobsQuery.data ?? []), [jobsQuery.data]);
  const latestRun = runsQuery.data?.[0];

  useEffect(() => {
    if (selectedCvId || !cvsQuery.data?.length) return;
    const activeCv = cvsQuery.data.find((cv) => cv.active) ?? cvsQuery.data[0];
    setSelectedCvId(activeCv.id);
  }, [cvsQuery.data, selectedCvId]);

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
    showToast({ type: "success", title: "Da an viec lam", message: `${job.title} se khong con xuat hien trong danh sach goi y.` });
  }

  function restoreJob(job: CandidateRecommendedJob) {
    persistHiddenJobs(hiddenIds.filter((id) => id !== job.id));
    showToast({ type: "success", title: "Da khoi phuc", message: `${job.title} da tro lai danh sach goi y.` });
  }

  async function toggleSave(job: CandidateRecommendedJob) {
    try {
      await toggleSavedJob(job.id);
    } catch {
      showToast({ type: "error", title: "Khong the cap nhat luu viec", message: "Vui long thu lai sau." });
    }
  }

  async function refreshRecommendations() {
    setGenerating(true);
    try {
      await generateRecommendations(selectedCvId || undefined);
      showToast({ type: "success", title: "Da gui yeu cau cap nhat goi y", message: "Danh sach se duoc tai lai tu backend." });
      setReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Khong the cap nhat goi y", message: getErrorMessage(error) });
    } finally {
      setGenerating(false);
    }
  }

  function openApply(job: CandidateRecommendedJob) {
    if (hasApplied(job.id)) {
      showToast({ type: "error", title: "Khong the ung tuyen trung", message: "Ban da ung tuyen viec lam nay truoc do." });
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
      <PageHeader title="Viec lam goi y" description="Ket qua goi y lay tu recommendation API cua backend." />

      <Card className="mb-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <Select
            label="CV dung de goi y"
            value={selectedCvId}
            onChange={(event) => setSelectedCvId(event.target.value)}
            options={[
              { label: cvsQuery.loading ? "Dang tai CV..." : "Dung CV active/backend", value: "" },
              ...((cvsQuery.data ?? []).map((cv) => ({ label: `${cv.name}${cv.active ? " (active)" : ""}`, value: cv.id }))),
            ]}
          />
          <Button className="mt-6 w-full" loading={generating} disabled={generating} onClick={() => void refreshRecommendations()} icon={<RefreshCw size={16} />}>
            Cap nhat goi y
          </Button>
          <Button className="mt-6 w-full" variant="secondary" disabled={jobsQuery.loading || runsQuery.loading} onClick={() => setReloadKey((current) => current + 1)}>
            Tai lai
          </Button>
        </div>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700 md:grid-cols-4">
          <InfoPill label="Run moi nhat" value={latestRun ? `#${latestRun.id}` : "Chua co"} />
          <InfoPill label="Trang thai" value={latestRun?.status ?? "Chua co"} />
          <InfoPill label="So viec da goi y" value={String(latestRun?.totalRecommended ?? (jobsQuery.data?.length ?? 0))} />
          <InfoPill label="Thoi gian" value={latestRun?.createdAt ?? "Chua cap nhat"} />
        </div>
      </Card>

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Select
            label="Match score toi thieu"
            value={String(filters.minMatch)}
            onChange={(event) => updateFilter("minMatch", Number(event.target.value))}
            options={[
              { label: "Tat ca", value: "0" },
              { label: "Tu 50%", value: "50" },
              { label: "Tu 65%", value: "65" },
              { label: "Tu 75%", value: "75" },
              { label: "Tu 85%", value: "85" },
            ]}
          />
          <Select
            label="Dia diem"
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
            options={[{ label: "Tat ca", value: "" }, ...options.locations.map((value) => ({ label: value, value }))]}
          />
          <Select
            label="Vi tri"
            value={filters.industry}
            onChange={(event) => updateFilter("industry", event.target.value)}
            options={[{ label: "Tat ca", value: "" }, ...options.industries.map((value) => ({ label: value, value }))]}
          />
          <Select label="Muc luong" value={filters.salary} onChange={(event) => updateFilter("salary", event.target.value)} options={salaryOptions} />
          <Select label="Kinh nghiem" value={filters.experience} onChange={(event) => updateFilter("experience", event.target.value)} options={experienceOptions} />
          <Select
            label="Hinh thuc lam viec"
            value={filters.workMode}
            onChange={(event) => updateFilter("workMode", event.target.value)}
            options={[{ label: "Tat ca", value: "" }, ...options.workModes.map((value) => ({ label: value, value }))]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-600">
            {showHidden ? `${filteredJobs.length} viec lam dang bi an` : `${filteredJobs.length} viec lam phu hop`}
          </p>
          <Button variant="secondary" size="sm" onClick={() => { setShowHidden((current) => !current); setPage(1); }} icon={showHidden ? <BriefcaseBusiness size={16} /> : <EyeOff size={16} />}>
            {showHidden ? "Quay lai goi y" : `Xem viec da an (${hiddenIds.length})`}
          </Button>
        </div>
      </Card>

      {jobsQuery.loading ? (
        <LoadingState />
      ) : jobsQuery.error ? (
        <EmptyState message={jobsQuery.error} />
      ) : pagedJobs.length === 0 ? (
        <EmptyState message={showHidden ? "Chua co viec lam nao bi an." : "Backend chua tra ve ket qua goi y phu hop voi bo loc hien tai."} />
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
          <p className="mt-1 text-xs text-emerald-700">{job.rankPosition ? `Hang #${job.rankPosition}` : "Diem backend"}</p>
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
                <span className="inline-flex items-center gap-1"><BriefcaseBusiness size={15} />{job.experienceLabel} - {job.workMode}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {hidden ? <StatusBadge label="Da an" tone="warning" /> : null}
              <StatusBadge label={job.industry} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <SkillGroup title="Keyword phu hop" skills={job.matchedSkills} tone="success" />
            <SkillGroup title="Keyword con thieu" skills={job.missingSkills} tone="warning" />
          </div>

          <div className="mt-4 rounded-md bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Ly do duoc goi y</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {job.recommendationReasons.length ? job.recommendationReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              )) : <li>Backend chua tra ve ly do goi y cho ket qua nay.</li>}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" icon={<BarChart3 size={16} />} onClick={onOpenAnalysis}>Xem phan tich</Button>
            <Button variant={saved ? "primary" : "secondary"} size="sm" icon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} onClick={onToggleSave}>
              {saved ? "Bo luu" : "Luu"}
            </Button>
            <Button size="sm" icon={<Send size={16} />} onClick={onApply} disabled={applied}>{applied ? "Da ung tuyen" : "Ung tuyen"}</Button>
            <Link to={`/candidate/jobs/${job.id}`}>
              <Button variant="secondary" size="sm">Xem chi tiet</Button>
            </Link>
            {hidden ? (
              <Button variant="secondary" size="sm" icon={<RotateCcw size={16} />} onClick={onRestore}>Khoi phuc</Button>
            ) : (
              <Button variant="secondary" size="sm" icon={<EyeOff size={16} />} onClick={onHide}>An</Button>
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
        {skills.length ? skills.map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />) : <StatusBadge label="Chua cap nhat" />}
      </div>
    </div>
  );
}

function HideJobModal({ job, onClose, onConfirm }: { job: CandidateRecommendedJob | null; onClose: () => void; onConfirm: (job: CandidateRecommendedJob) => void }) {
  return (
    <Modal open={Boolean(job)} title="An viec lam goi y" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Ban co muon an tin <strong>{job?.title}</strong> khoi danh sach viec lam goi y khong?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Huy</Button>
          <Button variant="danger" onClick={() => job && onConfirm(job)}>Co, an tin</Button>
        </div>
      </div>
    </Modal>
  );
}

function MatchAnalysisModal({ job, onClose }: { job: CandidateRecommendedJob | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(job)} title={`Phan tich do phu hop ${job?.matchScore ?? 0}%`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-950">{job?.title}</p>
          <p className="mt-1 text-sm text-slate-600">{job?.companyName}</p>
        </div>
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <InfoPill label="Hang goi y" value={job?.rankPosition ? `#${job.rankPosition}` : "Chua cap nhat"} />
          <InfoPill label="Diem backend" value={`${job?.matchScore ?? 0}%`} />
          <InfoPill label="Ngay tao ket qua" value={job?.postedAt ?? "Chua cap nhat"} />
          <InfoPill label="So keyword khop" value={String(job?.matchedSkills.length ?? 0)} />
        </div>
        <div className="rounded-md border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">Keyword khop</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(job?.matchedSkills.length ? job.matchedSkills : ["Chua cap nhat"]).map((skill) => <StatusBadge key={skill} label={skill} tone={job?.matchedSkills.length ? "success" : undefined} />)}
          </div>
        </div>
        <div className="rounded-md border border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-800">Ly do tu backend</p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {job?.recommendationReasons.length ? job.recommendationReasons.map((reason) => <p key={reason}>{reason}</p>) : <p>Backend chua tra ve reason/explanation.</p>}
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

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui long thu lai sau.";
  }
  return "Vui long thu lai sau.";
}
