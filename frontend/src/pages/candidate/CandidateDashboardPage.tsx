import { BriefcaseBusiness, CalendarDays, CheckCircle2, Eye, FileText, Send, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { CandidateDashboardSkeleton } from "../../features/candidate/dashboard/CandidateDashboardSkeleton";
import { getCandidateDashboardData } from "../../features/candidate/dashboard/candidateDashboardService";
import type { CandidateDashboardApplication, CandidateDashboardInterview } from "../../features/candidate/dashboard/candidateDashboardTypes";
import { PublicJobListCard } from "../../features/public/jobs/PublicJobListCard";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useToast } from "../../hooks/useToast";

const applicationLabels: Record<CandidateDashboardApplication["status"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  submitted: { label: "Đã nộp", tone: "neutral" },
  reviewing: { label: "Đang xem xét", tone: "warning" },
  interview: { label: "Mời phỏng vấn", tone: "success" },
  offer: { label: "Có offer", tone: "success" },
  rejected: { label: "Từ chối", tone: "danger" },
};

const interviewLabels: Record<CandidateDashboardInterview["status"], string> = {
  confirmed: "Đã xác nhận",
  pending: "Chờ xác nhận",
};

export function CandidateDashboardPage() {
  const { showToast } = useToast();
  const { isSaved, toggleSavedJob, savedJobIds } = useSavedJobs();
  const dashboardQuery = useAsyncData(() => getCandidateDashboardData(), []);
  const data = dashboardQuery.data;

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

  const unreadNotifications = data.notifications.filter((notification) => !notification.read).length;
  const savedJobsCount = Math.max(savedJobIds.length, data.stats.savedJobs);

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Xin chào, {data.profile.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.profile.title} tại {data.profile.location}. Theo dõi hồ sơ, CV, việc làm gợi ý và hoạt động ứng tuyển mới nhất.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/candidate/profile/edit"><Button>Hoàn thiện hồ sơ</Button></Link>
          <Link to="/candidate/cvs/upload"><Button variant="secondary">Upload CV</Button></Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatLink icon={<Star size={20} />} label="Việc làm gợi ý" value={`${data.stats.matchedJobs} việc`} to="/candidate/jobs/recommended" />
        <StatLink icon={<BriefcaseBusiness size={20} />} label="Việc đã lưu" value={`${savedJobsCount} việc`} to="/candidate/jobs/saved" />
        <StatLink icon={<Send size={20} />} label="Đơn ứng tuyển" value={`${data.stats.applications} đơn`} to="/candidate/applications" />
        <StatLink icon={<CalendarDays size={20} />} label="Lịch phỏng vấn" value={`${data.stats.interviews} lịch`} to="/candidate/interviews" />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Việc làm gợi ý mới nhất" description="Các công việc có match score cao dựa trên CV và hồ sơ cá nhân của bạn." action={<Link to="/candidate/jobs/recommended" className="text-sm font-medium text-brand-700">Xem tất cả</Link>} />
            {data.recommendedJobs.length ? (
              <div className="grid gap-4">
                {data.recommendedJobs.slice(0, 4).map((job) => (
                  <PublicJobListCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSave={toggleSavedJob} />
                ))}
              </div>
            ) : (
              <EmptyState message="Chưa có việc làm gợi ý phù hợp." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Ứng tuyển gần đây" description="5 đơn ứng tuyển mới nhất và trạng thái xử lý hiện tại." action={<Link to="/candidate/applications" className="text-sm font-medium text-brand-700">Xem tất cả</Link>} />
            {data.applications.length ? (
              <div className="grid gap-3">
                {data.applications.slice(0, 5).map((application) => (
                  <Link key={application.id} to={`/candidate/applications/${application.id}`} className="rounded-lg border border-slate-200 p-4 hover:border-brand-200 hover:bg-brand-50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{application.jobTitle}</p>
                        <p className="mt-1 text-sm text-slate-600">{application.companyName} · Ngày ứng tuyển: {application.appliedAt}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={applicationLabels[application.status].label} tone={applicationLabels[application.status].tone} />
                        <Button variant="secondary" size="sm">Xem chi tiết</Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message="Bạn chưa ứng tuyển công việc nào." />
            )}
          </Card>
        </main>

        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Tiến độ hoàn thiện hồ sơ" description="Hồ sơ đầy đủ giúp hệ thống gợi ý việc làm chính xác hơn." />
            <ProgressBar value={data.profile.profileCompletion} label={`${data.profile.profileCompletion}% hoàn thiện`} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
              <span className="inline-flex items-center gap-2"><Eye size={16} /> Lượt xem hồ sơ</span>
              <strong>{data.profile.profileViews}</strong>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Hồ sơ chưa hoàn thiện" />
            <div className="grid gap-2">
              {data.missingProfileItems.map((item) => (
                <Link key={item.id} to={item.path} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-brand-200 hover:bg-brand-50">
                  <span>{item.label}</span>
                  <span className="text-brand-700">Cập nhật</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="CV mặc định" />
            {data.cv ? (
              <div>
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 text-brand-600" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-950">{data.cv.fileName}</p>
                    <p className="mt-1 text-sm text-slate-600">Cập nhật: {data.cv.updatedAt}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ProgressBar value={data.cv.score} label={`Điểm CV ${data.cv.score}/100`} />
                </div>
                <div className="mt-3">
                  <StatusBadge label={data.cv.isPublic ? "Đang công khai" : "Riêng tư"} tone={data.cv.isPublic ? "success" : "neutral"} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/candidate/cvs/${data.cv.id}`}><Button size="sm" variant="secondary">Xem</Button></Link>
                  <Button size="sm" variant="secondary" onClick={() => showToast({ type: "success", title: "Đã mở chức năng đổi CV mặc định mock" })}>Đổi CV mặc định</Button>
                </div>
              </div>
            ) : (
              <EmptyState message="Bạn chưa có CV mặc định." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Lịch phỏng vấn sắp tới" />
            {data.interviews.length ? (
              <div className="space-y-3">
                {data.interviews.map((interview) => {
                  const soon = isWithin24Hours(interview.startsAt);
                  return (
                    <Link key={interview.id} to={`/candidate/interviews/${interview.id}`} className={`block rounded-lg border p-3 hover:border-brand-200 ${soon ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-950">{interview.jobTitle}</p>
                          <p className="mt-1 text-xs text-slate-600">{interview.companyName}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateTime(interview.startsAt)} · {interview.mode} · {interview.locationOrLink}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {soon ? <StatusBadge label="Sắp diễn ra" tone="warning" /> : null}
                          <StatusBadge label={interviewLabels[interview.status]} tone={interview.status === "confirmed" ? "success" : "warning"} />
                        </div>
                      </div>
                      <div className="mt-3"><Button size="sm" variant="secondary">Xem chi tiết</Button></div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="Bạn chưa có lịch phỏng vấn sắp tới." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Thông báo gần đây" description={`${unreadNotifications} thông báo chưa đọc`} />
            <div className="space-y-3">
              {data.notifications.map((notification) => (
                <Link key={notification.id} to={notification.targetPath} className="block rounded-md border border-slate-200 p-3 hover:border-brand-200 hover:bg-brand-50">
                  <div className="flex items-start gap-2">
                    {!notification.read ? <span className="mt-1 h-2 w-2 rounded-full bg-brand-600" /> : <CheckCircle2 className="mt-0.5 text-slate-400" size={14} />}
                    <div>
                      <p className="text-sm font-medium text-slate-950">{notification.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{notification.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{notification.createdAt}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </section>
    </PageContainer>
  );
}

function StatLink({ icon, label, value, to }: { icon: ReactNode; label: string; value: string; to: string }) {
  return (
    <Link to={to} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</span>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </Link>
  );
}

function isWithin24Hours(value: string) {
  const now = new Date("2026-07-11T08:00:00+07:00").getTime();
  const startsAt = new Date(value).getTime();
  return startsAt >= now && startsAt - now <= 24 * 60 * 60 * 1000;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
