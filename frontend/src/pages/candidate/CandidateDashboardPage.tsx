import { BriefcaseBusiness, CheckCircle2, FileText, Send, Star } from "lucide-react";
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
import type { CandidateDashboardApplicationStatus } from "../../features/candidate/dashboard/candidateDashboardTypes";
import { JobCard } from "../../features/public/components/JobCard";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

const applicationLabels: Record<CandidateDashboardApplicationStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  PENDING: { label: "Đang chờ", tone: "warning" },
  REVIEWED: { label: "Đã xem", tone: "neutral" },
  ACCEPTED: { label: "Đã chấp nhận", tone: "success" },
  REJECTED: { label: "Bị từ chối", tone: "danger" },
  WITHDRAWN: { label: "Đã rút", tone: "neutral" },
};

export function CandidateDashboardPage() {
  const { showToast } = useToast();
  const dashboardQuery = useAsyncData(() => getCandidateDashboardData(), []);
  const data = dashboardQuery.data;

  async function saveJob(jobId: string) {
    await httpClient.post(`/students/me/saved-jobs/${jobId}`);
    showToast({ type: "success", title: "Đã lưu việc làm" });
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

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Xin chào, {data.profile.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {data.profile.title} tại {data.profile.location}. Dữ liệu tổng quan được lấy từ API backend hiện có.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/candidate/profile/edit"><Button>Hoàn thiện hồ sơ</Button></Link>
          <Link to="/candidate/cvs/upload"><Button variant="secondary">Upload CV</Button></Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatLink icon={<Star size={20} />} label="Việc đang tuyển" value={`${data.stats.activeJobs} việc`} to="/candidate/jobs" />
        <StatLink icon={<BriefcaseBusiness size={20} />} label="Việc đã lưu" value={`${data.stats.savedJobs} việc`} to="/candidate/jobs/saved" />
        <StatLink icon={<Send size={20} />} label="Đơn ứng tuyển" value={`${data.stats.applications} đơn`} to="/candidate/applications" />
        <StatLink icon={<FileText size={20} />} label="Tổng CV" value={`${data.stats.cvs} CV`} to="/candidate/cvs" />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <Card>
            <SectionHeader title="Việc làm đang tuyển" description="Danh sách việc làm ACTIVE mới nhất từ API jobs." action={<Link to="/candidate/jobs" className="text-sm font-medium text-brand-700">Xem tất cả</Link>} />
            {data.jobs.length ? (
              <div className="grid gap-4">
                {data.jobs.map((job) => (
                  <JobCard key={job.id} job={job} detailPath={`/candidate/jobs/${job.id}`} onToggleSave={() => void saveJob(job.id)} />
                ))}
              </div>
            ) : (
              <EmptyState message="Chưa có việc làm đang tuyển." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Ứng tuyển gần đây" description="Các đơn ứng tuyển mới nhất từ API applications." action={<Link to="/candidate/applications" className="text-sm font-medium text-brand-700">Xem tất cả</Link>} />
            {data.applications.length ? (
              <div className="grid gap-3">
                {data.applications.map((application) => (
                  <Link key={application.id} to={`/candidate/applications/${application.id}`} className="rounded-lg border border-slate-200 p-4 hover:border-brand-200 hover:bg-brand-50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">{application.jobTitle}</p>
                        <p className="mt-1 text-sm text-slate-600">{application.companyName} • Ứng tuyển: {application.appliedAt}</p>
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
            <SectionHeader title="Tiến độ hoàn thiện hồ sơ" description="Tính theo các trường student_profiles backend đang có." />
            <ProgressBar value={data.profile.profileCompletion} label={`${data.profile.profileCompletion}% hoàn thiện`} />
          </Card>

          <Card>
            <SectionHeader title="Hồ sơ chưa hoàn thiện" />
            {data.missingProfileItems.length ? (
              <div className="grid gap-2">
                {data.missingProfileItems.map((item) => (
                  <Link key={item.id} to={item.path} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:border-brand-200 hover:bg-brand-50">
                    <span>{item.label}</span>
                    <span className="text-brand-700">Cập nhật</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState message="Hồ sơ đã đủ các trường chính." />
            )}
          </Card>

          <Card>
            <SectionHeader title="CV active" />
            {data.cv ? (
              <div>
                <div className="flex items-start gap-3">
                  <FileText className="mt-1 text-brand-600" size={22} />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-950">{data.cv.fileName}</p>
                    <p className="mt-1 text-sm text-slate-600">Upload: {data.cv.uploadedAt}</p>
                    <p className="mt-1 text-sm text-slate-600">Dung lượng: {data.cv.fileSize}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <StatusBadge label={data.cv.active ? "Active" : "Inactive"} tone={data.cv.active ? "success" : "neutral"} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/candidate/cvs/${data.cv.id}`}><Button size="sm" variant="secondary">Xem</Button></Link>
                  <Link to="/candidate/cvs/upload"><Button size="sm" variant="secondary">Upload CV mới</Button></Link>
                </div>
              </div>
            ) : (
              <EmptyState message="Bạn chưa có CV active." />
            )}
          </Card>

          <Card>
            <SectionHeader title="Phỏng vấn" />
            <EmptyState message="Backend hiện chưa có API lịch phỏng vấn." />
          </Card>

          <Card>
            <SectionHeader title="Thông báo gần đây" description={`${data.unreadNotifications} thông báo chưa đọc`} />
            {data.notifications.length ? (
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
            ) : (
              <EmptyState message="Chưa có thông báo." />
            )}
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
