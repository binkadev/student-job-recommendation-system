import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  FolderKanban,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { WithdrawApplicationButton } from "../../features/candidate/apply/WithdrawApplicationButton";
import { MessageLauncher } from "../../features/messaging/MessageLauncher";
import { appliedJobsChangedEvent, applicationStorageEvent } from "../../features/public/jobs/useAppliedJobs";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useAuth } from "../../hooks/useAuth";
import { httpClient } from "../../services/api/httpClient";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface ApplicationResponse {
  id: number;
  status: ApplicationStatus;
  coverLetter: string | null;
  studentId: number;
  studentName: string;
  studentEmail: string;
  jobId: number;
  jobTitle: string;
  companyId: number;
  companyName: string;
  cvFileId: number | null;
  cvFileName: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

const pageSize = 5;

const statusOptions: Array<{ label: string; value: "" | ApplicationStatus }> = [
  { label: "Tất cả", value: "" },
  { label: "Đang chờ", value: "PENDING" },
  { label: "Đã xem", value: "REVIEWED" },
  { label: "Đã chấp nhận", value: "ACCEPTED" },
  { label: "Bị từ chối", value: "REJECTED" },
  { label: "Đã rút", value: "WITHDRAWN" },
];

export function CandidateApplicationsPage({ mode = "list" }: { mode?: "list" | "detail" | "status" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const userId = currentUser?.role === "candidate" ? currentUser.id : null;
  const { applicationId } = useParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const detailMode = mode === "detail" || mode === "status";

  const applicationsQuery = useAsyncData(
    async () => ({ userId, items: !detailMode && userId ? await getMyApplications() : [] }),
    [detailMode, reloadKey, userId],
  );
  const applicationDetailQuery = useAsyncData(
    async () => ({
      userId,
      item: detailMode && applicationId && userId ? await getMyApplicationDetail(applicationId) : null,
    }),
    [applicationId, detailMode, reloadKey, userId],
  );

  const applications = useMemo(
    () => (applicationsQuery.data?.userId === userId ? applicationsQuery.data?.items ?? [] : []),
    [applicationsQuery.data, userId],
  );
  const selectedApplication = detailMode
    ? applicationDetailQuery.data?.userId === userId && String(applicationDetailQuery.data.item?.id) === applicationId
      ? applicationDetailQuery.data.item
      : null
    : applications[0];

  const confirmed =
    userId &&
    (detailMode ? applicationDetailQuery.data?.userId === userId && selectedApplication : applicationsQuery.data?.userId === userId);
  const loading = applicationsQuery.loading || applicationDetailQuery.loading;
  const loadError = applicationsQuery.error ?? applicationDetailQuery.error;
  const reload = () => setReloadKey((key) => key + 1);

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
    { scope: containerRef.current ? containerRef : undefined, dependencies: [loading, applications.length, mode] },
  );

  useEffect(() => {
    function changed(event: Event) {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId === userId) setReloadKey((key) => key + 1);
    }
    function focus() {
      setReloadKey((key) => key + 1);
    }
    function storage(event: StorageEvent) {
      if (event.key !== applicationStorageEvent || !event.newValue) return;
      try {
        if (JSON.parse(event.newValue).userId === userId) setReloadKey((key) => key + 1);
      } catch {
        /* Ignore malformed invalidations. */
      }
    }
    window.addEventListener(appliedJobsChangedEvent, changed);
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(appliedJobsChangedEvent, changed);
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
    };
  }, [userId]);

  function changed(application: ApplicationResponse) {
    applicationsQuery.setData((previous) =>
      previous?.userId === userId
        ? { ...previous, items: previous.items.map((item) => (item.id === application.id ? application : item)) }
        : previous,
    );
    applicationDetailQuery.setData((previous) =>
      previous?.userId === userId
        ? { ...previous, item: previous.item?.id === application.id ? application : previous.item }
        : previous,
    );
  }

  const feedback = (
    <div className="nm-reveal mb-5 space-y-3">
      {loading && confirmed ? <p role="status" className="text-xs text-slate-500 font-medium">Đang cập nhật. Dữ liệu bên dưới là lần xác nhận gần nhất.</p> : null}
      {loadError ? <ErrorState message={loadError} /> : null}
      <Button variant="secondary" size="sm" className="rounded-xl border-slate-200" disabled={loading} onClick={reload}>
        Tải lại
      </Button>
    </div>
  );

  const dateRangeError = dateFrom && dateTo && dateFrom > dateTo ? "Từ ngày phải nhỏ hơn hoặc bằng đến ngày." : "";

  const filteredApplications = useMemo(() => {
    if (dateRangeError) return [];
    return applications
      .filter((application) => {
        const appliedDate = application.appliedAt.slice(0, 10);
        const matchQuery =
          !query || `${application.jobTitle} ${application.companyName}`.toLowerCase().includes(query.toLowerCase());
        const matchStatus = !status || application.status === status;
        const matchFrom = !dateFrom || appliedDate >= dateFrom;
        const matchTo = !dateTo || appliedDate <= dateTo;
        return matchQuery && matchStatus && matchFrom && matchTo;
      })
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt) || b.id - a.id);
  }, [applications, dateFrom, dateRangeError, dateTo, query, status]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const pagedApplications = filteredApplications.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
  }

  if (loading && !confirmed) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (loadError && !confirmed) {
    return (
      <PageContainer>
        {feedback}
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "status") && !selectedApplication) {
    return (
      <PageContainer>
        <PageHeader
          title="Không tìm thấy đơn ứng tuyển"
          description="Mã ứng tuyển không tồn tại hoặc bạn không có quyền xem."
        />
        <Card className="border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
          <EmptyState message="Không tìm thấy đơn ứng tuyển." />
          <div className="mt-4 flex justify-center">
            <Link to="/candidate/applications">
              <Button className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]">
                Quay lại lịch sử ứng tuyển
              </Button>
            </Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "status") && selectedApplication) {
    return (
      <PageContainer>
        <div ref={containerRef} className="space-y-6">
          {feedback}
          <ApplicationDetail
            application={selectedApplication}
            actions={
              <WithdrawApplicationButton
                application={selectedApplication}
                userId={userId!}
                disabled={loading || Boolean(loadError)}
                onChanged={changed}
              />
            }
          />
        </div>
      </PageContainer>
    );
  }

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;
  const reviewedCount = applications.filter((a) => a.status === "REVIEWED").length;
  const acceptedCount = applications.filter((a) => a.status === "ACCEPTED").length;

  return (
    <PageContainer>
      <div ref={containerRef} className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="nm-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <FolderKanban className="h-3.5 w-3.5 text-teal-300" />
                <span>LỊCH SỬ ỨNG TUYỂN</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Theo dõi tiến độ đơn ứng tuyển
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Theo dõi trạng thái phản hồi và lịch sử xử lý hồ sơ từ nhà tuyển dụng cho từng vị trí bạn đã nộp.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/candidate/jobs">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  Tìm việc
                </Button>
              </Link>
              <Link to="/candidate/jobs/recommended">
                <Button
                  className="rounded-xl bg-[#D4F933] font-semibold text-[#0C111C] shadow-sm hover:bg-[#C2E82E]"
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Xem việc làm gợi ý
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {feedback}

        {/* Bento KPI Counter Bar */}
        {applications.length > 0 ? (
          <div className="nm-reveal grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="border border-slate-200/80 bg-white p-4 shadow-sm rounded-2xl">
              <p className="text-xs font-medium text-slate-500">Tổng số đơn</p>
              <p className="mt-1 font-mono text-2xl font-black text-slate-950">{applications.length}</p>
            </Card>
            <Card className="border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm rounded-2xl">
              <p className="text-xs font-medium text-amber-700">Đang chờ</p>
              <p className="mt-1 font-mono text-2xl font-black text-amber-900">{pendingCount}</p>
            </Card>
            <Card className="border border-teal-200/80 bg-teal-50/40 p-4 shadow-sm rounded-2xl">
              <p className="text-xs font-medium text-[#134B43]">Đã xem</p>
              <p className="mt-1 font-mono text-2xl font-black text-[#134B43]">{reviewedCount}</p>
            </Card>
            <Card className="border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm rounded-2xl">
              <p className="text-xs font-medium text-emerald-700">Đã chấp nhận</p>
              <p className="mt-1 font-mono text-2xl font-black text-emerald-900">{acceptedCount}</p>
            </Card>
          </div>
        ) : null}

        {/* Filter Card */}
        <Card className="nm-reveal border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5" />
            <span>Bộ lọc đơn ứng tuyển</span>
          </div>
          <div className="mt-3 grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Từ khóa"
              value={query}
              onChange={(event) => updateFilter(() => setQuery(event.target.value))}
              placeholder="Tên việc làm, công ty..."
            />
            <Select
              label="Trạng thái"
              value={status}
              onChange={(event) => updateFilter(() => setStatus(event.target.value as ApplicationStatus | ""))}
              options={statusOptions}
            />
            <Input
              label="Từ ngày"
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              error={dateRangeError}
              onChange={(event) => updateFilter(() => setDateFrom(event.target.value))}
            />
            <Input
              label="Đến ngày"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => updateFilter(() => setDateTo(event.target.value))}
            />
          </div>
        </Card>

        {/* Empty States */}
        {dateRangeError ? (
          <Card className="nm-reveal border border-rose-200 bg-rose-50/60 p-6 shadow-sm rounded-2xl">
            <EmptyState message={dateRangeError} />
          </Card>
        ) : pagedApplications.length === 0 && !loading && !loadError ? (
          <Card className="nm-reveal border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
            <EmptyState
              message={
                applications.length
                  ? "Không có đơn ứng tuyển khớp với bộ lọc. Hãy thử đổi từ khóa, trạng thái hoặc khoảng ngày."
                  : "Bạn chưa gửi đơn ứng tuyển nào. Khám phá việc làm để bắt đầu."
              }
            />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/candidate/jobs">
                <Button className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]">
                  Tìm việc
                </Button>
              </Link>
              <Link to="/candidate/jobs/recommended">
                <Button variant="secondary" className="rounded-xl">
                  Xem việc làm gợi ý
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Paged Applications List */}
            <div className="grid gap-4">
              {pagedApplications.map((application) => (
                <div key={application.id} className="nm-reveal">
                  <ApplicationCard
                    application={application}
                    actions={
                      <WithdrawApplicationButton
                        application={application}
                        userId={userId!}
                        disabled={loading || Boolean(loadError)}
                        onChanged={changed}
                      />
                    }
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex justify-center">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function ApplicationCard({
  application,
  actions,
}: {
  application: ApplicationResponse;
  actions: React.ReactNode;
}) {
  const status = getStatusMeta(application.status);

  return (
    <Card className="border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md rounded-2xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={status.label} tone={status.tone} />
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-700">
              Mã {application.id}
            </span>
          </div>

          {/* Job Title & Company */}
          <div>
            <h2 className="text-lg font-bold text-slate-950 hover:text-[#134B43] transition-colors">
              {application.jobTitle}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{application.companyName}</span>
            </div>
          </div>

          {/* Meta Info Grid */}
          <div className="grid gap-2.5 pt-1 text-xs text-slate-600 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <span className="block text-[11px] text-slate-400">Ngày ứng tuyển</span>
              <strong className="mt-0.5 block font-semibold text-slate-800">{formatDateTime(application.appliedAt)}</strong>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <span className="block text-[11px] text-slate-400">CV đã dùng</span>
              <strong className="mt-0.5 block truncate font-semibold text-slate-800" title={application.cvFileName || "Không chọn CV"}>
                {application.cvFileName || "Không chọn CV"}
              </strong>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <span className="block text-[11px] text-slate-400">Cập nhật cuối</span>
              <strong className="mt-0.5 block font-semibold text-slate-800">{formatDateTime(application.updatedAt)}</strong>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <span className="block text-[11px] text-slate-400">Ngày xem xét</span>
              <strong className="mt-0.5 block font-semibold text-slate-800">
                {application.reviewedAt ? formatDateTime(application.reviewedAt) : "Chưa có"}
              </strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 lg:w-auto lg:border-t-0 lg:pt-0">
          {actions}
          <MessageLauncher applicationId={application.id} role="candidate" />
          <Link to={`/candidate/applications/${application.id}`}>
            <Button variant="secondary" size="sm" className="rounded-xl border-slate-200">
              Xem chi tiết
            </Button>
          </Link>
          <Link to={`/candidate/applications/${application.id}/status`}>
            <Button variant="secondary" size="sm" className="rounded-xl border-slate-200">
              Xem trạng thái
            </Button>
          </Link>
          <Link to={`/candidate/jobs/${application.jobId}`}>
            <Button variant="secondary" size="sm" className="rounded-xl border-slate-200">
              Xem việc làm
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function ApplicationDetail({
  application,
  actions,
}: {
  application: ApplicationResponse;
  actions: React.ReactNode;
}) {
  const status = getStatusMeta(application.status);

  return (
    <div className="space-y-6">
      {/* Header Bento Card */}
      <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Link
              to="/candidate/applications"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#134B43] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Quay lại lịch sử ứng tuyển</span>
            </Link>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              {application.jobTitle}
            </h1>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
              <span>{application.companyName}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <StatusBadge label={status.label} tone={status.tone} />
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-700">
                Mã {application.id}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>Ứng tuyển {formatDateTime(application.appliedAt)}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            {actions}
            <MessageLauncher applicationId={application.id} role="candidate" />
            <Link to={`/candidate/jobs/${application.jobId}`}>
              <Button variant="secondary" className="rounded-xl border-slate-200">
                Xem việc làm
              </Button>
            </Link>
            {application.cvFileId ? (
              <Link to={`/candidate/cvs/${application.cvFileId}`}>
                <Button variant="secondary" className="rounded-xl border-slate-200" icon={<FileText className="h-4 w-4" />}>
                  Xem CV
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Visual Timeline Stepper */}
      <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
        <SectionHeader
          title="Tiến trình ứng tuyển"
          description="Các mốc thời gian quan trọng từ khi gửi hồ sơ đến kết quả cuối cùng."
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Step 1 */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">1. Đã gửi hồ sơ</p>
              <p className="mt-0.5 text-[11px] text-emerald-700">{formatDateTime(application.appliedAt)}</p>
              <p className="mt-1 text-xs text-slate-600">CV: {application.cvFileName || "Không chọn CV"}</p>
            </div>
          </div>

          {/* Step 2 */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              application.reviewedAt || application.status !== "PENDING"
                ? "border-teal-200 bg-teal-50/50"
                : "border-slate-200 bg-slate-50/50 opacity-70"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                application.reviewedAt || application.status !== "PENDING"
                  ? "bg-[#134B43] text-white"
                  : "bg-slate-300 text-slate-600"
              }`}
            >
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">2. Nhà tuyển dụng xem xét</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {application.reviewedAt ? formatDateTime(application.reviewedAt) : "Đang chờ xem xét"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {application.reviewedAt ? "Hồ sơ đã được mở xem" : "Chờ NTD mở hồ sơ"}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              application.status === "ACCEPTED"
                ? "border-emerald-200 bg-emerald-50/60"
                : application.status === "REJECTED"
                  ? "border-rose-200 bg-rose-50/60"
                  : application.status === "WITHDRAWN"
                    ? "border-slate-300 bg-slate-100"
                    : "border-slate-200 bg-slate-50/50 opacity-70"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                application.status === "ACCEPTED"
                  ? "bg-emerald-600 text-white"
                  : application.status === "REJECTED"
                    ? "bg-rose-600 text-white"
                    : application.status === "WITHDRAWN"
                      ? "bg-slate-500 text-white"
                      : "bg-slate-300 text-slate-600"
              }`}
            >
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">3. Kết quả tuyển dụng</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-700">{status.label}</p>
              <p className="mt-1 text-xs text-slate-600">{getNextStep(application.status)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2-Column Content */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
            <SectionHeader title="Thông tin đơn ứng tuyển" />
            <div className="mt-4 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
              <SummaryItem label="Ứng viên" value={application.studentName} />
              <SummaryItem label="Email" value={application.studentEmail} />
              <SummaryItem label="Công việc" value={application.jobTitle} />
              <SummaryItem label="Công ty" value={application.companyName} />
              <SummaryItem label="CV" value={application.cvFileName || "Không chọn CV"} />
              <SummaryItem label="Trạng thái" value={status.label} />
              <SummaryItem label="Ngày ứng tuyển" value={formatDateTime(application.appliedAt)} />
              <SummaryItem label="Cập nhật cuối" value={formatDateTime(application.updatedAt)} />
            </div>
          </Card>

          <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
            <SectionHeader title="Thư giới thiệu" />
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {application.coverLetter || "Không có thư giới thiệu."}
              </p>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="nm-reveal border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
            <SectionHeader title="Trạng thái" />
            <div className="mt-4 space-y-4 text-sm text-slate-700">
              <SummaryItem label="Hiện tại" value={status.label} />
              <SummaryItem
                label="Ngày review"
                value={application.reviewedAt ? formatDateTime(application.reviewedAt) : "Chưa có"}
              />
              <SummaryItem label="Bước tiếp theo" value={getNextStep(application.status)} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

async function getMyApplications() {
  const response = await httpClient.get<ApiResponse<ApplicationResponse[]>>("/students/me/applications");
  return response.data.data;
}

async function getMyApplicationDetail(applicationId: string) {
  const response = await httpClient.get<ApiResponse<ApplicationResponse>>(`/students/me/applications/${applicationId}`);
  return response.data.data;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getStatusMeta(status: ApplicationStatus): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  if (status === "PENDING") return { label: "Đang chờ", tone: "warning" };
  if (status === "REVIEWED") return { label: "Đã xem", tone: "neutral" };
  if (status === "ACCEPTED") return { label: "Đã chấp nhận", tone: "success" };
  if (status === "REJECTED") return { label: "Bị từ chối", tone: "danger" };
  return { label: "Đã rút", tone: "neutral" };
}

function getNextStep(status: ApplicationStatus) {
  if (status === "PENDING") return "Chờ nhà tuyển dụng xem hồ sơ";
  if (status === "REVIEWED") return "Chờ kết quả từ nhà tuyển dụng";
  if (status === "ACCEPTED") return "Nhà tuyển dụng đã chấp nhận hồ sơ";
  if (status === "REJECTED") return "Đơn ứng tuyển đã bị từ chối";
  return "Hồ sơ đã được rút";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
