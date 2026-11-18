import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Building2,
  Calendar,
  Laptop,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../../components/common/PageContainer";
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
import { createAuthenticatedTabUrl } from "../../../services/auth/authService";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const { getApplicationState } = useAppliedJobs();
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const savedJobsQuery = useAsyncData(() => getSavedJobs(page), [page, reloadKey]);
  const result = savedJobsQuery.data;
  const savedJobs = (result?.items ?? []).filter((job) => job.status === "ACTIVE");

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
    { scope: containerRef.current ? containerRef : undefined, dependencies: [savedJobsQuery.loading, savedJobs.length] },
  );

  async function removeSaved(job: SavedJobResponse) {
    try {
      await removeSavedJob(job.jobId);
      showToast({
        type: "success",
        title: "Đã bỏ lưu",
        message: `${job.title} đã được xóa khỏi danh sách việc làm đã lưu.`,
      });
      setReloadKey((current) => current + 1);
    } catch {
      showToast({
        type: "error",
        title: "Không thể bỏ lưu việc làm",
      });
    }
  }

  return (
    <PageContainer>
      <div ref={containerRef} className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="nm-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-teal-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm">
                <Bookmark className="h-3.5 w-3.5 text-emerald-300" />
                <span>VIỆC LÀM ĐÃ LƯU</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Cơ hội việc làm bạn đang theo dõi.
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Lưu trữ và theo dõi các tin tuyển dụng đang mở. Chỉ hiển thị các tin còn đang tuyển (ACTIVE).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/candidate/jobs/saved-searches">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                  icon={<Search className="h-4 w-4" />}
                >
                  Bộ lọc đã lưu
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

        {/* Loading / Error States */}
        {savedJobsQuery.loading ? <LoadingState /> : null}
        {savedJobsQuery.error ? <ErrorState message={savedJobsQuery.error} /> : null}

        {/* Empty State */}
        {!savedJobsQuery.loading && !savedJobsQuery.error && savedJobs.length === 0 ? (
          <Card className="nm-reveal border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
            <EmptyState message="Chưa có việc làm đã lưu đang tuyển." />
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Hãy tìm kiếm và đánh dấu lưu các vị trí bạn quan tâm để dễ dàng theo dõi và ứng tuyển khi đã sẵn sàng.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/candidate/jobs">
                <Button
                  className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
                  icon={<Search size={16} />}
                >
                  Chuyển sang tìm việc
                </Button>
              </Link>
              <Link to="/candidate/jobs/recommended">
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  icon={<Sparkles size={16} />}
                >
                  Chuyển sang việc làm gợi ý
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {/* Content with Saved Jobs */}
        {!savedJobsQuery.loading && !savedJobsQuery.error && savedJobs.length > 0 ? (
          <div className="space-y-4">
            {/* Bento Summary Card */}
            <Card className="nm-reveal border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#134B43]">
                    <BookmarkCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      <span className="font-mono text-base font-black text-[#134B43]">{savedJobs.length}</span> việc làm đã lưu đang tuyển
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Tin bị khóa, đóng, hết hạn hoặc không ACTIVE sẽ không hiển thị ở đây.
                    </p>
                  </div>
                </div>

                <Link
                  to="/candidate/jobs"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#134B43] hover:underline"
                >
                  <span>Tìm kiếm thêm vị trí</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>

            {/* List of Saved Job Cards */}
            <div className="grid gap-4">
              {savedJobs.map((job) => (
                <div key={job.savedJobId} className="nm-reveal">
                  <SavedJobCard
                    job={job}
                    applicationState={getApplicationState(String(job.jobId))}
                    onRemoveSaved={() => void removeSaved(job)}
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex justify-center">
              <Pagination
                page={result?.page ?? page}
                totalPages={result?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

function SavedJobCard({
  job,
  onRemoveSaved,
  applicationState,
}: {
  job: SavedJobResponse;
  onRemoveSaved: () => void;
  applicationState: string;
}) {
  const detailPath = `/candidate/jobs/${job.jobId}`;
  const openDetail = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.open(createAuthenticatedTabUrl(detailPath), "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md rounded-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>Lưu ngày {formatDateTime(job.savedAt)}</span>
            </span>
            <StatusBadge label="Đang tuyển" tone="success" />
            {applicationState && applicationState !== "NONE" ? (
              <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-[#134B43]">
                {applicationState === "ACCEPTED"
                  ? "Đã trúng tuyển"
                  : applicationState === "REVIEWED"
                    ? "Nhà tuyển dụng đã xem"
                    : applicationState === "REJECTED_CAN_REAPPLY"
                      ? "Có thể nộp lại"
                      : "Đã nộp hồ sơ"}
              </span>
            ) : null}
          </div>

          {/* Job Title & Company */}
          <div>
            <Link
              to={detailPath}
              target="_blank"
              rel="noreferrer"
              onClick={openDetail}
              className="group inline-flex items-center gap-1.5 text-lg font-bold text-slate-950 hover:text-[#134B43] transition-colors"
            >
              <span className="group-hover:underline">{job.title}</span>
            </Link>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{job.companyName}</span>
            </div>
          </div>

          {/* Meta Info Pills */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>{job.location || "Chưa cập nhật"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1">
              <BriefcaseBusiness className="h-3.5 w-3.5 text-slate-400" />
              <span>{getJobTypeLabel(job.jobType)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1">
              <Laptop className="h-3.5 w-3.5 text-slate-400" />
              <span>{getWorkingModelLabel(job.workingModel)}</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-3 lg:w-auto lg:border-t-0 lg:pt-0">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            icon={<BookmarkCheck size={15} className="text-[#134B43]" />}
            onClick={onRemoveSaved}
          >
            Bỏ lưu
          </Button>

          <Link to={detailPath} target="_blank" rel="noreferrer" onClick={openDetail}>
            <Button
              variant={applicationState === "REJECTED_CAN_REAPPLY" ? "primary" : "secondary"}
              size="sm"
              className={
                applicationState === "REJECTED_CAN_REAPPLY"
                  ? "rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
                  : "rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              }
            >
              {applicationState === "REJECTED_CAN_REAPPLY" ? "Ứng tuyển lại" : "Xem chi tiết"}
            </Button>
          </Link>
        </div>
      </div>

      {applicationState === "WITHDRAWN_BLOCKED" ? (
        <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs font-medium text-amber-800">
          Đơn đã rút không thể ứng tuyển lại theo chính sách hiện tại.
        </div>
      ) : null}
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
