import { BookmarkCheck, BriefcaseBusiness, MapPin, Search, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../../components/common/PageContainer";
import { PageHeader } from "../../../components/common/PageHeader";
import { Pagination } from "../../../components/common/Pagination";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useToast } from "../../../hooks/useToast";
import { httpClient } from "../../../services/api/httpClient";

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

interface SavedJobResponse {
  savedJobId: number;
  jobId: number;
  title: string;
  companyName: string;
  location: string | null;
  jobType: JobType | null;
  workingModel: WorkingModel | null;
  status: JobStatus;
  savedAt: string;
}

type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type WorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

const pageSize = 10;

export function CandidateSavedJobsPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const savedJobsQuery = useAsyncData(() => getSavedJobs(page), [page, reloadKey]);
  const result = savedJobsQuery.data;
  const savedJobs = result?.items ?? [];

  async function removeSaved(job: SavedJobResponse) {
    await removeSavedJob(job.jobId);
    showToast({ type: "success", title: "Đã bỏ lưu", message: `${job.title} đã được xóa khỏi danh sách việc làm đã lưu.` });
    setReloadKey((current) => current + 1);
  }

  return (
    <PageContainer>
      <PageHeader title="Việc làm đã lưu" description="Danh sách việc làm đã lưu từ API backend." />

      {savedJobsQuery.loading ? <LoadingState /> : null}
      {savedJobsQuery.error ? <ErrorState message={savedJobsQuery.error} /> : null}

      {!savedJobsQuery.loading && !savedJobsQuery.error && savedJobs.length === 0 ? (
        <Card>
          <EmptyState message="Chưa có việc làm đã lưu." />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/candidate/jobs">
              <Button icon={<Search size={16} />}>Chuyển sang tìm việc</Button>
            </Link>
            <Link to="/candidate/jobs/recommended">
              <Button variant="secondary" icon={<Sparkles size={16} />}>Chuyển sang việc làm gợi ý</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {!savedJobsQuery.loading && !savedJobsQuery.error && savedJobs.length ? (
        <>
          <Card className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{result?.totalItems ?? savedJobs.length} việc làm đã lưu</p>
                <p className="mt-1 text-sm text-slate-600">Dữ liệu được lấy từ bảng saved_jobs qua API ứng viên.</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            {savedJobs.map((job) => (
              <SavedJobCard key={job.savedJobId} job={job} onRemoveSaved={() => void removeSaved(job)} />
            ))}
          </div>

          <div className="mt-5">
            <Pagination page={result?.page ?? page} totalPages={result?.totalPages ?? 1} onPageChange={setPage} />
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}

function SavedJobCard({ job, onRemoveSaved }: { job: SavedJobResponse; onRemoveSaved: () => void }) {
  const status = getStatusMeta(job.status);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={`Lưu ngày ${formatDateTime(job.savedAt)}`} />
            <StatusBadge label={status.label} tone={status.tone} />
          </div>

          <Link to={`/candidate/jobs/${job.jobId}`} className="mt-3 block text-lg font-semibold text-slate-950 hover:text-brand-700">
            {job.title}
          </Link>
          <p className="mt-1 text-sm font-medium text-slate-700">{job.companyName}</p>

          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <span className="inline-flex items-center gap-2"><MapPin size={16} />{job.location || "Chưa cập nhật"}</span>
            <span className="inline-flex items-center gap-2"><BriefcaseBusiness size={16} />{getJobTypeLabel(job.jobType)}</span>
            <span>{getWorkingModelLabel(job.workingModel)}</span>
          </div>
        </div>

        <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto">
          <Button variant="secondary" size="sm" icon={<BookmarkCheck size={16} />} onClick={onRemoveSaved}>Bỏ lưu</Button>
          <Link to={`/candidate/jobs/${job.jobId}`}>
            <Button variant="secondary" size="sm">Xem chi tiết</Button>
          </Link>
          <Button variant="danger" size="sm" icon={<Trash2 size={16} />} onClick={onRemoveSaved}>Xóa</Button>
        </div>
      </div>
    </Card>
  );
}

async function getSavedJobs(page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<SavedJobResponse>>>("/students/me/saved-jobs", {
    params: { page, size: pageSize },
  });
  return response.data.data;
}

async function removeSavedJob(jobId: number) {
  await httpClient.delete<ApiResponse<null>>(`/students/me/saved-jobs/${jobId}`);
}

function getStatusMeta(status: JobStatus): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (status === "ACTIVE") return { label: "Đang tuyển", tone: "success" };
  if (status === "PENDING_APPROVAL") return { label: "Chờ duyệt", tone: "warning" };
  if (status === "DRAFT") return { label: "Nháp", tone: "neutral" };
  if (status === "CLOSED") return { label: "Đã đóng", tone: "neutral" };
  if (status === "REJECTED") return { label: "Bị từ chối", tone: "danger" };
  return { label: "Hết hạn", tone: "danger" };
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
