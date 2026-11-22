import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  MapPin,
  Send,
  Sparkles,
  Star,
  Upload,
  Wallet,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { CandidateDashboardSkeleton } from "../../features/candidate/dashboard/CandidateDashboardSkeleton";
import {
  getCandidateDashboardData,
  getCandidateDashboardRecommendations,
} from "../../features/candidate/dashboard/candidateDashboardService";
import type {
  CandidateDashboardApplicationStatus,
  CandidateDashboardRecommendation,
} from "../../features/candidate/dashboard/candidateDashboardTypes";
import { formatNormalizedScore } from "../../features/shared/ranking/rankingScoreTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";
import { createAuthenticatedTabUrl } from "../../services/auth/authService";
import type { Job } from "../../types/domain";
import { getApiErrorMessage } from "../../utils/apiErrors";

gsap.registerPlugin(useGSAP);

const applicationLabels: Record<
  CandidateDashboardApplicationStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  PENDING: { label: "Đang chờ", tone: "warning" },
  REVIEWED: { label: "Đã xem", tone: "neutral" },
  ACCEPTED: { label: "Đã chấp nhận", tone: "success" },
  REJECTED: { label: "Bị từ chối", tone: "danger" },
  WITHDRAWN: { label: "Đã rút", tone: "neutral" },
};

function openCandidateDetailInTab(event: MouseEvent<HTMLAnchorElement>, path: string) {
  event.preventDefault();
  window.open(createAuthenticatedTabUrl(path), "_blank", "noopener,noreferrer");
}

function getInitials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "DN";
}

export function CandidateDashboardPage() {
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => new Set());
  const [savingJobId, setSavingJobId] = useState<string | null>(null);

  const dashboardQuery = useAsyncData(() => getCandidateDashboardData(), []);
  const recommendationsQuery = useAsyncData(() => getCandidateDashboardRecommendations(3).catch(() => []), []);
  const data = dashboardQuery.data;
  const recommendations = recommendationsQuery.data ?? [];

  useGSAP(
    () => {
      if (!data || !containerRef.current) return;
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".nova-dash-reveal", {
          y: 12,
          opacity: 0,
          duration: 0.38,
          stagger: 0.06,
          ease: "power2.out",
          clearProps: "transform,opacity",
        });
        gsap.from(".nova-kpi-item", {
          y: 10,
          opacity: 0,
          duration: 0.34,
          stagger: 0.05,
          ease: "power2.out",
          clearProps: "transform,opacity",
        });
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [Boolean(data)] },
  );

  async function toggleSaveJob(jobId: string) {
    if (savingJobId === jobId) return;
    const isCurrentlySaved = savedJobIds.has(jobId);
    setSavingJobId(jobId);
    try {
      if (isCurrentlySaved) {
        await httpClient.delete(`/students/me/saved-jobs/${jobId}`);
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        showToast({ type: "success", title: "Đã bỏ lưu việc làm" });
      } else {
        await httpClient.post(`/students/me/saved-jobs/${jobId}`);
        setSavedJobIds((prev) => new Set(prev).add(jobId));
        showToast({ type: "success", title: "Đã lưu việc làm" });
      }
    } catch (error) {
      showToast({
        type: "error",
        title: "Không thể cập nhật việc làm đã lưu",
        message: getApiErrorMessage(error, "Vui lòng thử lại sau."),
      });
    } finally {
      setSavingJobId(null);
    }
  }

  if (dashboardQuery.loading) {
    return (
      <PageContainer>
        <CandidateDashboardSkeleton />
      </PageContainer>
    );
  }

  if (dashboardQuery.error || !data) {
    return (
      <PageContainer>
        <ErrorState message={dashboardQuery.error ?? "Không thể tải dữ liệu dashboard ứng viên."} />
      </PageContainer>
    );
  }

  const completionValue = Math.min(100, Math.max(0, data.profile.profileCompletion));

  return (
    <PageContainer>
      <div ref={containerRef} className="space-y-6">
        {/* Greeting & Top Actions */}
        <header className="nova-dash-reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#237D70]/25 bg-[#F0FAF8] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#134B43]">
              <Sparkles size={13} aria-hidden="true" />
              <span>Không gian ứng viên<span className="hidden sm:inline"> · {data.profile.location}</span></span>
            </div>
            <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-[#0C111C] sm:text-3xl">
              Xin chào, {data.profile.name}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#4B5C73]">
              {data.profile.title}. Quản lý CV chuẩn hóa, theo dõi gợi ý việc làm từ dữ liệu thực và tiến độ ứng tuyển của bạn.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/candidate/profile/edit"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#D5DCE6] bg-white px-4 py-2 text-sm font-semibold text-[#0C111C] shadow-sm transition-colors hover:border-[#237D70]/50 hover:bg-[#F0FAF8]"
            >
              Hoàn thiện hồ sơ
            </Link>
            <Link
              to="/candidate/cvs/upload"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#1A6359] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#134B43]"
            >
              <Upload size={16} aria-hidden="true" />
              <span>Tải CV mới</span>
            </Link>
          </div>
        </header>

        {/* NOVA MOTION Command Hero */}
        <section
          aria-label="Trung tâm đối sánh CV và cơ hội việc làm"
          className="nova-hero nova-dash-reveal !rounded-[24px] !p-6 sm:!p-8"
        >
          <div className="grid items-center gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="min-w-0">
              <div className="nova-eyebrow">
                <span className="nova-eyebrow-badge" />
                <span>BƯỚC TIẾP THEO CỦA BẠN</span>
              </div>
              <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
                Một CV chuẩn hóa.{" "}
                <span className="nova-text-gradient">Những cơ hội có cơ sở.</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#B4C5DA]">
                Chọn CV đã phân tích sẵn sàng để khám phá việc làm gợi ý phù hợp từ CV tiếng Anh, xem rõ kỹ năng khớp và kỹ năng còn thiếu trước khi nộp hồ sơ.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/candidate/jobs/recommended" className="nova-btn-primary">
                  <span>Xem gợi ý việc làm</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link to="/candidate/cvs" className="nova-btn-secondary">
                  <FileText size={16} className="text-[#78D2C3]" aria-hidden="true" />
                  <span>Quản lý CV</span>
                </Link>
              </div>
            </div>

            {/* Readiness Glass Summary */}
            <div className="min-w-0 rounded-2xl border border-white/12 bg-[#1B2533]/85 p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#D6F2EC]">
                  Mức độ sẵn sàng
                </h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D5F36A]/35 bg-[#D5F36A]/15 px-2.5 py-0.5 text-xs font-bold text-[#D5F36A] tabular-nums">
                  {completionValue}% hồ sơ
                </span>
              </div>

              <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#237D70] to-[#D5F36A] transition-[width] duration-300"
                  style={{ width: `${completionValue}%` }}
                />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#0C111C]/70 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9BB0C9]">
                  CV đang dùng
                </p>
                {data.cv ? (
                  <div className="mt-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-white">{data.cv.fileName}</p>
                      <p className="mt-0.5 text-xs text-[#B4C5DA] tabular-nums">
                        {data.cv.fileSize} · {data.cv.uploadedAt}
                      </p>
                    </div>
                    <FileCheck2 size={18} className="mt-0.5 shrink-0 text-[#D5F36A]" aria-hidden="true" />
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-[#B4C5DA]">
                    Chưa có CV đang dùng. Hãy tải lên và chọn CV chính.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Bento KPI Grid */}
        <section aria-label="Chỉ số tổng quan ứng viên" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BentoKpiLink
            to="/candidate/jobs"
            icon={<Star size={20} aria-hidden="true" />}
            iconSurface="bg-[#237D70]/12 text-[#134B43]"
            label="Việc đang tuyển"
            value={data.stats.activeJobs}
            helper="tin tuyển dụng đang mở"
          />
          <BentoKpiLink
            to="/candidate/jobs/saved"
            icon={<BriefcaseBusiness size={20} aria-hidden="true" />}
            iconSurface="bg-[#D5F36A]/35 text-[#0C111C]"
            label="Việc đã lưu"
            value={data.stats.savedJobs}
            helper="việc làm đang theo dõi"
          />
          <BentoKpiLink
            to="/candidate/applications"
            icon={<Send size={20} aria-hidden="true" />}
            iconSurface="bg-[#FF7956]/15 text-[#9A3412]"
            label="Đơn ứng tuyển"
            value={data.stats.applications}
            helper="hồ sơ đã nộp"
          />
          <BentoKpiLink
            to="/candidate/cvs"
            icon={<FileText size={20} aria-hidden="true" />}
            iconSurface="bg-[#0C111C] text-[#D5F36A]"
            label="Tổng CV"
            value={data.stats.cvs}
            helper={data.cv ? "1 CV đang kích hoạt" : "Chưa chọn CV đang dùng"}
          />
        </section>

        {/* Main Bento Workspace + Right Rail */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {/* Recommendations Preview */}
            <Card className="nova-dash-reveal">
              <SectionHeader
                title="Gợi ý việc làm từ CV"
                description="Kết quả đối sánh mới nhất từ CV đã phân tích, tách bạch tầng phù hợp tổng thể và đối sánh kỹ năng."
                action={
                  <Link
                    to="/candidate/jobs/recommended"
                   className="inline-flex min-h-[44px] shrink-0 whitespace-nowrap items-center gap-1.5 text-sm font-semibold text-[#134B43] hover:text-[#237D70]"
                  >
                    <span>Xem tất cả gợi ý</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                }
              />

              {recommendations.length ? (
                <div className="grid gap-3.5">
                  {recommendations.map((rec) => (
                    <RecommendationPreviewCard key={rec.id} recommendation={rec} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F7F8F6] p-5 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-[#0C111C]">Khám phá cơ hội tương thích từ CV của bạn</h3>
                    <p className="mt-1 text-sm leading-6 text-[#4B5C73]">
                      Chưa có lượt gợi ý gần đây. Chọn CV ở trạng thái sẵn sàng để chạy đối sánh và xem giải thích kỹ năng khớp/thiếu.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      to="/candidate/jobs/recommended"
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#1A6359] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#134B43]"
                    >
                      <span>Tạo gợi ý</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <Link
                      to="/candidate/cvs"
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#D5DCE6] bg-white px-4 py-2 text-sm font-semibold text-[#0C111C] transition-colors hover:border-[#237D70]/50 hover:bg-[#F0FAF8]"
                    >
                      Kiểm tra CV
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            {/* Active Jobs */}
            <Card className="nova-dash-reveal">
              <SectionHeader
                title="Việc làm đang tuyển"
                description="Tin tuyển dụng mới nhất. Lưu lại để theo dõi hoặc mở xem chi tiết yêu cầu."
                action={
                  <Link
                    to="/candidate/jobs"
                   className="inline-flex min-h-[44px] shrink-0 whitespace-nowrap items-center gap-1.5 text-sm font-semibold text-[#134B43] hover:text-[#237D70]"
                  >
                    <span>Xem tất cả</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                }
              />

              {data.jobs.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.jobs.map((job) => (
                    <DashboardJobCard
                      key={job.id}
                      job={job}
                      saved={savedJobIds.has(job.id)}
                      saving={savingJobId === job.id}
                      onToggleSave={() => void toggleSaveJob(job.id)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState message="Chưa có việc làm đang tuyển." />
              )}
            </Card>

            {/* Recent Applications */}
            <Card className="nova-dash-reveal">
              <SectionHeader
                title="Ứng tuyển gần đây"
                description="Các hồ sơ bạn đã gửi trong thời gian gần đây."
                action={
                  <Link
                    to="/candidate/applications"
                   className="inline-flex min-h-[44px] shrink-0 whitespace-nowrap items-center gap-1.5 text-sm font-semibold text-[#134B43] hover:text-[#237D70]"
                  >
                    <span>Xem tất cả</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                }
              />

              {data.applications.length ? (
                <div className="grid gap-3">
                  {data.applications.map((application) => (
                    <Link
                      key={application.id}
                      to={`/candidate/applications/${application.id}`}
                      className="group flex min-h-[44px] flex-col justify-between gap-3 rounded-2xl border border-[#E2E8EE] bg-white p-4 transition-all hover:border-[#237D70]/45 hover:bg-[#F0FAF8]/60 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="nova-company-logo h-11 w-11 shrink-0 text-xs text-[#134B43]">
                          {getInitials(application.companyName)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-bold text-[#0C111C] group-hover:text-[#134B43]">
                            {application.jobTitle}
                          </h3>
                          <p className="mt-0.5 break-words text-xs text-[#4B5C73] tabular-nums">
                            {application.companyName} · Ứng tuyển: {application.appliedAt}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                        <StatusBadge
                          label={applicationLabels[application.status].label}
                          tone={applicationLabels[application.status].tone}
                        />
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#134B43]">
                          Xem chi tiết
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState message="Bạn chưa ứng tuyển công việc nào." />
              )}
            </Card>
          </div>

          {/* Right Rail */}
          <aside aria-label="Hồ sơ và thông báo" className="min-w-0 space-y-6">
            {/* Profile Completion & Missing Items */}
            <Card className="nova-dash-reveal">
              <SectionHeader
                title="Tiến độ hoàn thiện hồ sơ"
                description="Hoàn thiện thêm thông tin để nhà tuyển dụng đánh giá dễ hơn."
              />
              <ProgressBar value={completionValue} label={`${completionValue}% hoàn thiện`} />

              <div className="mt-5 border-t border-[#E2E8EE] pt-4">
                <h3 className="text-sm font-bold text-[#0C111C]">Hồ sơ chưa hoàn thiện</h3>
                {data.missingProfileItems.length ? (
                  <div className="mt-3 grid gap-2">
                    {data.missingProfileItems.map((item) => (
                      <Link
                        key={item.id}
                        to={item.path}
                        className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-[#E2E8EE] bg-[#F7F8F6] px-3.5 py-2 text-sm font-medium text-[#0C111C] transition-colors hover:border-[#237D70]/45 hover:bg-[#F0FAF8]"
                      >
                        <span className="min-w-0 break-words">{item.label}</span>
                        <span className="shrink-0 text-xs font-bold text-[#134B43]">Cập nhật</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#237D70]/25 bg-[#F0FAF8] px-3.5 py-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[#134B43]">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>Hồ sơ đã đủ các trường chính.</span>
                    </span>
                    <Link
                      to="/candidate/profile"
                      className="inline-flex min-h-[44px] shrink-0 items-center text-xs font-bold text-[#134B43] underline underline-offset-4"
                    >
                      Xem hồ sơ
                    </Link>
                  </div>
                )}
              </div>
            </Card>

            {/* Active CV Card */}
            <Card className="nova-dash-reveal">
              <SectionHeader title="CV đang dùng" />
              {data.cv ? (
                <div>
                  <div className="rounded-2xl border border-[#E2E8EE] bg-[#F7F8F6] p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0C111C] text-[#D5F36A]">
                        <FileText size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-bold text-[#0C111C]">{data.cv.fileName}</h3>
                        <p className="mt-1 text-xs text-[#4B5C73] tabular-nums">
                          Ngày tải lên: {data.cv.uploadedAt}
                        </p>
                        <p className="mt-0.5 text-xs text-[#4B5C73] tabular-nums">
                          Dung lượng: {data.cv.fileSize}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <StatusBadge
                        label={data.cv.active ? "Đang dùng" : "Chưa dùng"}
                        tone={data.cv.active ? "success" : "neutral"}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <Link
                      to={`/candidate/cvs/${data.cv.id}`}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#D5DCE6] bg-white px-3.5 py-2 text-sm font-semibold text-[#0C111C] transition-colors hover:border-[#237D70]/45 hover:bg-[#F0FAF8]"
                    >
                      Xem CV
                    </Link>
                    <Link
                      to="/candidate/cvs/upload"
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#1A6359] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#134B43]"
                    >
                      Tải CV mới
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <EmptyState message="Bạn chưa có CV đang dùng." />
                  <Link
                    to="/candidate/cvs/upload"
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#1A6359] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#134B43]"
                  >
                    <Upload size={16} aria-hidden="true" />
                    <span>Tải lên CV đầu tiên</span>
                  </Link>
                </div>
              )}
            </Card>

            {/* Recent Notifications */}
            <Card className="nova-dash-reveal">
              <SectionHeader
                title="Thông báo gần đây"
                description={`${data.unreadNotifications} thông báo chưa đọc`}
                action={
                  <Link
                    to="/candidate/notifications"
                    className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-[#134B43] hover:text-[#237D70]"
                  >
                    <span>Tất cả</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                }
              />
              {data.notifications.length ? (
                <div className="space-y-2.5">
                  {data.notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      to={notification.targetPath}
                      className={`block min-h-[44px] rounded-2xl border p-3.5 transition-colors ${
                        !notification.read
                          ? "border-[#237D70]/30 bg-[#F0FAF8]/75 hover:border-[#237D70]/55"
                          : "border-[#E2E8EE] bg-white hover:border-[#237D70]/35 hover:bg-[#F7F8F6]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {!notification.read ? (
                          <span
                            aria-label="Chưa đọc"
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#1A6359]"
                          />
                        ) : (
                          <Bell size={15} className="mt-0.5 shrink-0 text-[#4B5C73]" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-sm font-semibold text-[#0C111C]">
                            {notification.title}
                          </h3>
                          <p className="mt-1 break-words text-xs leading-5 text-[#4B5C73]">{notification.body}</p>
                          <p className="mt-1.5 text-[11px] font-medium text-[#4B5C73] tabular-nums">
                            {notification.createdAt}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState message="Chưa có thông báo." />
              )}
            </Card>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}

function BentoKpiLink({
  to,
  icon,
  iconSurface,
  label,
  value,
  helper,
}: {
  to: string;
  icon: ReactNode;
  iconSurface: string;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <Link
      to={to}
      className="nova-metric-card nova-kpi-item group block min-h-[44px] min-w-0 !p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconSurface}`}>
            {icon}
          </span>
          <span className="truncate text-sm font-semibold text-[#1B2533]">{label}</span>
        </div>
        <ArrowUpRight
          size={16}
          className="shrink-0 text-[#4B5C73] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#0C111C]"
          aria-hidden="true"
        />
      </div>
      <p className="mt-3.5 text-3xl font-extrabold tracking-tight text-[#0C111C] tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#4B5C73]">{helper}</p>
    </Link>
  );
}

function RecommendationPreviewCard({
  recommendation,
}: {
  recommendation: CandidateDashboardRecommendation;
}) {
  const detailPath = `/candidate/jobs/${recommendation.jobId}`;
  const isPrimary = recommendation.rankingTier === "PRIMARY";
  const scoreFormatted = formatNormalizedScore(recommendation.displayScore);

  return (
    <article className="nova-job-card !p-4 sm:!p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0C111C] text-xs font-extrabold text-[#D5F36A] tabular-nums"
            aria-label={recommendation.rankPosition ? `Hạng ${recommendation.rankPosition}` : "Gợi ý"}
          >
            {recommendation.rankPosition ? `#${recommendation.rankPosition}` : "V3"}
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-base font-bold leading-snug text-[#0C111C]">
              <Link
                to={detailPath}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => openCandidateDetailInTab(event, detailPath)}
                className="transition-colors hover:text-[#1A6359]"
              >
                {recommendation.jobTitle}
              </Link>
            </h3>
            <p className="mt-0.5 break-words text-sm font-medium text-[#4B5C73]">
              {recommendation.companyName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tabular-nums ${
              isPrimary
                ? "border-[#237D70]/35 bg-[#F0FAF8] text-[#134B43]"
                : "border-[#CBD5E1] bg-[#F7F8F6] text-[#1B2533]"
            }`}
          >
            <span>{recommendation.displayTierLabel}</span>
            <span aria-hidden="true">·</span>
            <span>
              {recommendation.displayScoreLabel} {scoreFormatted}
            </span>
          </span>
        </div>
      </div>

      {recommendation.reason ? (
        <p className="mt-3 break-words text-sm leading-6 text-[#4B5C73]">{recommendation.reason}</p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8EE]/70 pt-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {recommendation.matchedSkills.slice(0, 3).map((skill) => (
            <span key={`matched-${skill}`} className="nova-tag nova-tag-skill">
              {skill}
            </span>
          ))}
          {recommendation.missingSkills.slice(0, 2).map((skill) => (
            <span
              key={`missing-${skill}`}
              className="nova-tag border-[#FF7956]/40 bg-[#FFF1EC] text-[#9A3412]"
            >
              Thiếu: {skill}
            </span>
          ))}
        </div>

        <Link
          to={detailPath}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => openCandidateDetailInTab(event, detailPath)}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-xs font-bold text-[#134B43] hover:text-[#237D70]"
        >
          <span>Xem chi tiết</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function DashboardJobCard({
  job,
  saved,
  saving,
  onToggleSave,
}: {
  job: Job;
  saved: boolean;
  saving: boolean;
  onToggleSave: () => void;
}) {
  const detailPath = `/candidate/jobs/${job.id}`;

  return (
    <article className="nova-job-card flex flex-col justify-between !p-5">
      <div>
        <div className="flex items-start justify-between gap-2.5">
          <Link
            to={detailPath}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => openCandidateDetailInTab(event, detailPath)}
            className="group flex min-w-0 flex-1 items-start gap-3"
          >
            <div className="nova-company-logo shrink-0 text-sm text-[#134B43]">
              {getInitials(job.companyName)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-base font-bold leading-snug text-[#0C111C] transition-colors group-hover:text-[#1A6359]">
                {job.title}
              </h3>
              <p className="mt-0.5 break-words text-sm font-medium text-[#4B5C73]">{job.companyName}</p>
            </div>
          </Link>

          <button
            type="button"
            disabled={saving}
            aria-label={saved ? "Bỏ lưu việc làm" : "Lưu việc làm"}
            aria-pressed={saved}
            onClick={onToggleSave}
            className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-transparent text-[#4B5C73] transition-colors hover:border-[#237D70]/30 hover:bg-[#F0FAF8] hover:text-[#134B43] disabled:opacity-60"
          >
            {saved ? (
              <BookmarkCheck size={20} className="text-[#1A6359]" aria-hidden="true" />
            ) : (
              <Bookmark size={20} aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-[#4B5C73]">
          <span className="inline-flex items-center gap-1.5 text-[#0C111C]">
            <Wallet size={14} className="text-[#1A6359]" aria-hidden="true" />
            <span>{job.salary}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} className="text-[#4B5C73]" aria-hidden="true" />
            <span>{job.location}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusiness size={14} className="text-[#4B5C73]" aria-hidden="true" />
            <span>{job.workMode}</span>
          </span>
        </div>

        {job.skills.length ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {job.skills.slice(0, 4).map((skill) => (
              <span key={skill} className="nova-tag nova-tag-skill">
                {skill}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8EE]/70 pt-3.5">
        <p className="inline-flex items-center gap-1.5 text-xs text-[#4B5C73] tabular-nums">
          <CalendarDays size={14} className="text-[#4B5C73]" aria-hidden="true" />
          <span>Hạn: {job.deadline}</span>
        </p>
        <Link
          to={detailPath}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => openCandidateDetailInTab(event, detailPath)}
          className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-[#134B43] hover:text-[#237D70]"
        >
          <span>Xem chi tiết</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
