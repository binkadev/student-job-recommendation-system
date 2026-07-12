import { BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock, FileWarning, Handshake, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockApplicationService, mockInterviewService, mockJobService } from "../../services/mock";
import type { Application, ApplicationStatus, Interview, Job } from "../../types/domain";
import { recruiterTone } from "../../features/recruiter/recruiterLabels";

type RangeFilter = "7" | "30" | "90";

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  submitted: "Mới nhận",
  viewed: "Đã xem",
  reviewing: "Đang xem xét",
  shortlisted: "Qua vòng hồ sơ",
  interview: "Phỏng vấn",
  interviewed: "Đã phỏng vấn",
  offer: "Offer",
  rejected: "Không phù hợp",
  withdrawn: "Đã rút",
};

const applicationOverrides: Record<string, Partial<Application> & { matchScore?: number }> = {
  "app-1": { candidateName: "Nguyễn Văn An", companyName: "Công ty TNHH Công nghệ NovaTech", matchScore: 92 },
  "app-2": { candidateName: "Lê Minh Khang", companyName: "Công ty Cổ phần FinPlus", matchScore: 87 },
  "app-3": { candidateName: "Phạm Thu Hà", companyName: "Công ty Cổ phần DataVision", matchScore: 84 },
  "app-4": { candidateName: "Hoàng Đức Long", companyName: "Công ty TNHH CloudNext", matchScore: 89 },
  "app-5": { candidateName: "Đặng Thùy Linh", companyName: "Công ty Cổ phần EcomHub", matchScore: 78 },
  "app-6": { candidateName: "Mai Phương Anh", companyName: "Công ty TNHH GreenSoft", matchScore: 91 },
  "app-7": { candidateName: "Vũ Ngọc Mai", companyName: "Công ty TNHH Bright Future", matchScore: 73 },
  "app-8": { candidateName: "Trịnh Hoàng Nam", companyName: "Công ty Cổ phần EcomHub", matchScore: 86 },
  "app-9": { candidateName: "Bùi Tuấn Anh", companyName: "Công ty Cổ phần TalentBridge", matchScore: 76 },
  "app-10": { candidateName: "Lý Thanh Tâm", companyName: "Công ty Cổ phần FinPlus", matchScore: 80 },
};

const jobOverrides: Record<string, Partial<Job>> = {
  "job-1": { companyName: "Công ty TNHH Công nghệ NovaTech", location: "Hà Nội", salary: "15-25 triệu", jobType: "Toàn thời gian" },
  "job-2": { companyName: "Công ty Cổ phần FinPlus", location: "TP. Hồ Chí Minh", salary: "18-30 triệu", jobType: "Toàn thời gian" },
  "job-3": { companyName: "Công ty TNHH GreenSoft", location: "Đà Nẵng", salary: "20-35 triệu", jobType: "Toàn thời gian" },
  "job-4": { companyName: "Công ty TNHH Bright Future", location: "Cần Thơ", salary: "12-20 triệu", status: "rejected" },
};

const interviewOverrides: Record<string, Partial<Interview>> = {
  "interview-1": { candidateName: "Hoàng Đức Long", companyName: "Công ty TNHH CloudNext", interviewer: "Nguyễn Kim Oanh", note: "Chuẩn bị trao đổi về Kubernetes." },
  "interview-2": { candidateName: "Trịnh Hoàng Nam", companyName: "Công ty Cổ phần EcomHub", interviewer: "Phan Đức Tài", note: "Kiểm tra kiến thức Flutter." },
  "interview-3": { candidateName: "Lê Minh Khang", companyName: "Công ty Cổ phần FinPlus", interviewer: "Đỗ Quốc Huy", note: "Vòng kỹ thuật Java." },
};

const weeklyDataByRange: Record<RangeFilter, Array<{ label: string; applications: number; views: number }>> = {
  "7": [
    { label: "T2", applications: 12, views: 140 },
    { label: "T3", applications: 18, views: 180 },
    { label: "T4", applications: 15, views: 165 },
    { label: "T5", applications: 22, views: 230 },
    { label: "T6", applications: 28, views: 260 },
    { label: "T7", applications: 16, views: 150 },
    { label: "CN", applications: 9, views: 90 },
  ],
  "30": [
    { label: "Tuần 1", applications: 54, views: 620 },
    { label: "Tuần 2", applications: 68, views: 760 },
    { label: "Tuần 3", applications: 73, views: 820 },
    { label: "Tuần 4", applications: 81, views: 940 },
  ],
  "90": [
    { label: "Tháng 5", applications: 156, views: 1800 },
    { label: "Tháng 6", applications: 213, views: 2440 },
    { label: "Tháng 7", applications: 276, views: 3140 },
  ],
};

const sourceData = [
  { name: "Tìm kiếm", value: 35 },
  { name: "Gợi ý", value: 28 },
  { name: "Lời mời", value: 22 },
  { name: "Khác", value: 15 },
];

const pipelineData = [
  { label: "Mới nhận", value: 100 },
  { label: "Đang xem xét", value: 72 },
  { label: "Qua CV", value: 48 },
  { label: "Phỏng vấn", value: 31 },
  { label: "Offer", value: 14 },
  { label: "Đã tuyển", value: 8 },
];

export function RecruiterDashboardPage() {
  const { showToast } = useToast();
  const [range, setRange] = useState<RangeFilter>("30");
  const jobsQuery = useAsyncData(() => mockJobService.getJobs({ pageSize: 100 }), []);
  const applicationsQuery = useAsyncData(() => mockApplicationService.getApplications({ pageSize: 100 }), []);
  const interviewsQuery = useAsyncData(() => mockInterviewService.getInterviews({ pageSize: 100 }), []);
  const [quickStatuses, setQuickStatuses] = useState<Record<string, ApplicationStatus>>({});
  const [extendedJobs, setExtendedJobs] = useState<string[]>([]);

  const jobs = useMemo(() => (jobsQuery.data?.items ?? []).map(normalizeJob), [jobsQuery.data?.items]);
  const applications = useMemo(() => (applicationsQuery.data?.items ?? []).map(normalizeApplication).map((application) => ({ ...application, status: quickStatuses[application.id] ?? application.status })), [applicationsQuery.data?.items, quickStatuses]);
  const interviews = useMemo(() => (interviewsQuery.data?.items ?? []).map(normalizeInterview), [interviewsQuery.data?.items]);

  if (jobsQuery.loading || applicationsQuery.loading || interviewsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const pendingApplications = applications.filter((app) => ["submitted", "viewed", "reviewing"].includes(app.status));
  const upcomingInterviews = interviews.filter((interview) => !["completed", "declined"].includes(interview.status)).slice(0, 4);
  const expiringJobs = jobs.filter((job) => daysUntil(job.deadline) <= 14 && job.status === "published").slice(0, 4);
  const rejectedJobs = jobs.filter((job) => job.status === "rejected");
  const offers = applications.filter((app) => app.status === "offer");
  const hiredThisMonth = applications.filter((app) => app.status === "offer" && app.appliedAt.startsWith("2026-07")).length;

  async function changeApplicationStatus(application: Application, nextStatus: ApplicationStatus) {
    setQuickStatuses((current) => ({ ...current, [application.id]: nextStatus }));
    await mockApplicationService.updateApplication(application.id, { status: nextStatus });
    showToast({ type: "success", title: "Đã chuyển trạng thái ứng viên", message: `${application.candidateName}: ${applicationStatusLabels[nextStatus]}` });
  }

  function extendJob(job: Job) {
    setExtendedJobs((current) => (current.includes(job.id) ? current : [...current, job.id]));
    showToast({ type: "success", title: "Đã gia hạn tin mock", message: `${job.title} đã được đánh dấu gia hạn trong giao diện.` });
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Tổng quan nhà tuyển dụng</h1>
          <p className="mt-1 text-sm text-slate-600">Theo dõi tin tuyển dụng, ứng viên mới, phỏng vấn sắp tới và hiệu quả tuyển dụng.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            label="Khoảng thời gian"
            value={range}
            onChange={(event) => setRange(event.target.value as RangeFilter)}
            options={[
              { label: "7 ngày", value: "7" },
              { label: "30 ngày", value: "30" },
              { label: "90 ngày", value: "90" },
            ]}
          />
          <Link className="self-end" to="/recruiter/applications"><Button>Việc cần xử lý hôm nay</Button></Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatLink icon={<BriefcaseBusiness size={20} />} label="Tin đang tuyển" value={String(jobs.filter((job) => job.status === "published").length)} to="/recruiter/jobs" />
        <StatLink icon={<Users size={20} />} label="Ứng viên mới" value={String(applications.filter((app) => app.status === "submitted").length)} to="/recruiter/candidates" />
        <StatLink icon={<BarChart3 size={20} />} label="Ứng viên chờ xử lý" value={String(pendingApplications.length)} to="/recruiter/applications" />
        <StatLink icon={<CalendarDays size={20} />} label="Phỏng vấn sắp tới" value={String(upcomingInterviews.length)} to="/recruiter/interviews" />
        <StatLink icon={<Handshake size={20} />} label="Offer đang chờ" value={String(offers.length)} to="/recruiter/applications" />
        <StatLink icon={<CheckCircle2 size={20} />} label="Đã tuyển tháng này" value={String(hiredThisMonth)} to="/recruiter/reports" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Ứng viên theo tuần" />
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={weeklyDataByRange[range]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="applications" name="Ứng viên" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Nguồn ứng viên" />
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" outerRadius={95} label>
                  {sourceData.map((_, index) => <Cell key={index} fill={["#2563eb", "#10b981", "#f59e0b", "#64748b"][index]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Tỷ lệ qua pipeline" />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" name="Tỷ lệ" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Hiệu quả tin tuyển dụng" />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={jobs.slice(0, 5).map((job) => ({ title: job.title, views: job.views, applicants: job.applicants }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="title" hide />
                <YAxis />
                <Tooltip />
                <Bar dataKey="views" fill="#2563eb" name="Lượt xem" />
                <Bar dataKey="applicants" fill="#f59e0b" name="Ứng viên" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
        <Card>
          <SectionHeader title="Việc cần xử lý" />
          <div className="space-y-3">
            <TodoItem icon={<Users size={18} />} label={`${pendingApplications.length} ứng viên chưa xem hoặc chờ xử lý`} to="/recruiter/applications" />
            <TodoItem icon={<CalendarDays size={18} />} label={`${interviews.filter((item) => item.status === "pending").length} lịch phỏng vấn cần xác nhận`} to="/recruiter/interviews" />
            <TodoItem icon={<Clock size={18} />} label={`${expiringJobs.length} tin sắp hết hạn`} to="/recruiter/jobs" />
            <TodoItem icon={<FileWarning size={18} />} label={`${rejectedJobs.length} tin bị yêu cầu chỉnh sửa`} to="/recruiter/jobs" />
          </div>
        </Card>

        <Card>
          <SectionHeader title="Ứng viên mới nhất" />
          <div className="space-y-3">
            {applications.slice(0, 5).map((application) => (
              <div key={application.id} className="grid gap-3 rounded-lg border border-slate-100 p-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium text-slate-900">{application.candidateName}</p>
                  <p className="text-sm text-slate-500">{application.jobTitle} · {formatDate(application.appliedAt)} · Match {getMatchScore(application)}%</p>
                  <div className="mt-2"><StatusBadge label={applicationStatusLabels[application.status]} tone={recruiterTone(application.status)} /></div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link to={`/recruiter/applications/${application.id}`}><Button variant="secondary" size="sm">Xem</Button></Link>
                  <Button size="sm" onClick={() => void changeApplicationStatus(application, "reviewing")}>Đang xem xét</Button>
                  <Button variant="secondary" size="sm" onClick={() => void changeApplicationStatus(application, "interview")}>Tạo lịch phỏng vấn</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Phỏng vấn sắp tới" />
          <div className="space-y-3">
            {upcomingInterviews.map((interview) => (
              <div key={interview.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-900">{interview.candidateName}</p>
                  <p className="text-sm text-slate-500">{interview.jobTitle} · {formatDateTime(interview.startsAt)}</p>
                  <p className="text-sm text-slate-500">Người phỏng vấn: {interview.interviewer}</p>
                </div>
                <Link to={`/recruiter/interviews/${interview.id}`}><Button variant="secondary" size="sm">Mở lịch</Button></Link>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Tin sắp hết hạn" />
          <div className="space-y-3">
            {expiringJobs.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-900">{job.title}</p>
                  <p className="text-sm text-slate-500">Hạn tuyển {formatDate(job.deadline)} · {job.applicants} ứng viên</p>
                  {extendedJobs.includes(job.id) ? <StatusBadge label="Đã gia hạn mock" tone="success" /> : null}
                </div>
                <div className="flex gap-2">
                  <Link to={`/recruiter/jobs/${job.id}`}><Button variant="secondary" size="sm">Mở tin</Button></Link>
                  <Button size="sm" onClick={() => extendJob(job)}>Gia hạn mock</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}

function StatLink({ icon, label, value, to }: { icon: ReactNode; label: string; value: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="h-full transition hover:border-brand-200 hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</div>
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-2xl font-semibold text-slate-950">{value}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function TodoItem({ icon, label, to }: { icon: ReactNode; label: string; to: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 text-sm text-slate-700 hover:border-brand-200 hover:bg-brand-50">
      <span className="text-brand-700">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function normalizeApplication(application: Application): Application {
  return { ...application, ...applicationOverrides[application.id] };
}

function normalizeJob(job: Job): Job {
  return { ...job, ...jobOverrides[job.id] };
}

function normalizeInterview(interview: Interview): Interview {
  return { ...interview, ...interviewOverrides[interview.id] };
}

function getMatchScore(application: Application) {
  return (applicationOverrides[application.id]?.matchScore ?? 75).toString();
}

function daysUntil(value: string) {
  const target = new Date(value).getTime();
  const today = new Date("2026-07-11").getTime();
  return Math.ceil((target - today) / 86400000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
