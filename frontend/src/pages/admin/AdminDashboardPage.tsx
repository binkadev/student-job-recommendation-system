import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BriefcaseBusiness, Building2, FileText, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { useAsyncData } from "../../hooks/useAsyncData";
import { applications, companies, cvs, jobs, reports, users } from "../../mocks";
import { mockAdminService } from "../../services/mock";

type TimeRange = "7d" | "30d" | "90d" | "12m";

const rangeLabels: Record<TimeRange, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  "90d": "90 ngày",
  "12m": "12 tháng",
};

export function AdminDashboardPage() {
  const analyticsQuery = useAsyncData(() => mockAdminService.getAnalytics(), []);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const analytics = useMemo(() => {
    const data = analyticsQuery.data ?? [];
    if (timeRange === "7d") return data.slice(-2).map((item, index) => ({ ...item, label: `Ngày ${index + 1}` }));
    if (timeRange === "30d") return data.slice(-3);
    if (timeRange === "90d") return data.slice(-4);
    return data;
  }, [analyticsQuery.data, timeRange]);

  const multiplier = timeRange === "7d" ? 0.35 : timeRange === "30d" ? 1 : timeRange === "90d" ? 1.8 : 3.2;

  if (analyticsQuery.loading) {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  const pendingCompanies = companies.filter((company) => !company.verified || company.status === "pending");
  const pendingJobs = jobs.filter((job) => job.status === "pending");
  const newReports = reports.filter((report) => report.status === "new");
  const failedCvs = cvs.filter((cv) => cv.status === "failed");

  const stats = [
    { label: "Tổng ứng viên", value: scaled(users.filter((u) => u.role === "candidate").length + 15, multiplier), icon: <Users /> },
    { label: "Tổng recruiter", value: scaled(users.filter((u) => u.role === "recruiter").length + 8, multiplier), icon: <Users /> },
    { label: "Tổng doanh nghiệp", value: companies.length, icon: <Building2 /> },
    { label: "Tổng việc làm", value: jobs.length, icon: <BriefcaseBusiness /> },
    { label: "Tổng đơn ứng tuyển", value: scaled(applications.length + 42, multiplier), icon: <FileText /> },
    { label: "CV đã upload", value: scaled(cvs.length + 28, multiplier), icon: <FileText /> },
    { label: "Tin chờ duyệt", value: pendingJobs.length, icon: <AlertTriangle /> },
    { label: "Công ty chờ xác thực", value: pendingCompanies.length, icon: <Building2 /> },
    { label: "Báo cáo chưa xử lý", value: newReports.length, icon: <AlertTriangle /> },
  ];

  const cvAnalysisData = analytics.map((item) => ({
    label: item.label,
    analyzed: Math.round(item.cvs * 0.72),
    failed: Math.max(1, Math.round(item.cvs * 0.08)),
    pending: Math.round(item.cvs * 0.2),
  }));
  const conversionData = analytics.map((item) => ({
    label: item.label,
    viewed: Math.round(item.applications * 1.4),
    applied: item.applications,
    hired: Math.max(1, Math.round(item.applications * 0.08)),
  }));
  const companyGrowthData = analytics.map((item) => ({
    label: item.label,
    companies: Math.round(item.jobs * 0.55),
  }));

  const actionItems = [
    ...pendingCompanies.map((company) => ({ id: `company-${company.id}`, title: company.name, time: "Hôm nay", priority: "Cao", path: `/admin/companies/${company.id}/verification`, type: "Doanh nghiệp chờ xác thực" })),
    ...pendingJobs.map((job) => ({ id: `job-${job.id}`, title: job.title, time: job.postedAt, priority: "Cao", path: `/admin/jobs/${job.id}/review`, type: "Tin chờ duyệt" })),
    ...newReports.map((report) => ({ id: `report-${report.id}`, title: report.type, time: report.createdAt, priority: "Cao", path: `/admin/reports/${report.id}`, type: "Báo cáo mới" })),
    ...failedCvs.map((cv) => ({ id: `cv-${cv.id}`, title: cv.fileName, time: cv.uploadedAt, priority: "Trung bình", path: "/admin/cv-analysis/errors", type: "CV lỗi" })),
    { id: "suspicious-1", title: "Đăng nhập bất thường từ tài khoản recruiter", time: "12/07/2026 08:15", priority: "Cao", path: "/admin/audit-logs", type: "Hoạt động đáng ngờ" },
    { id: "suspicious-2", title: "Nhiều tin tuyển dụng bị report trong 24 giờ", time: "12/07/2026 09:30", priority: "Trung bình", path: "/admin/reports", type: "Hoạt động đáng ngờ" },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Tổng quan quản trị" description="Theo dõi người dùng, doanh nghiệp, việc làm, ứng tuyển, CV và các việc cần xử lý trên toàn hệ thống." />
        <Select
          label="Filter thời gian"
          value={timeRange}
          onChange={(event) => setTimeRange(event.target.value as TimeRange)}
          options={Object.entries(rangeLabels).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-brand-50 p-2 text-brand-700">{stat.icon}</div>
              <div><p className="text-sm text-slate-500">{stat.label}</p><p className="text-2xl font-semibold text-slate-950">{stat.value}</p></div>
            </div>
          </Card>
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <ChartCard title="Tăng trưởng người dùng"><ResponsiveContainer><LineChart data={analytics}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Line dataKey="users" stroke="#2563eb" name="Người dùng" strokeWidth={2} /></LineChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Tăng trưởng việc làm"><ResponsiveContainer><BarChart data={analytics}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="jobs" fill="#2563eb" name="Việc làm" /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Tăng trưởng ứng tuyển"><ResponsiveContainer><LineChart data={analytics}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Line dataKey="applications" stroke="#10b981" name="Ứng tuyển" strokeWidth={2} /></LineChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Tăng trưởng doanh nghiệp"><ResponsiveContainer><BarChart data={companyGrowthData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="companies" fill="#f59e0b" name="Doanh nghiệp" /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Kết quả phân tích CV"><ResponsiveContainer><BarChart data={cvAnalysisData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="analyzed" stackId="cv" fill="#10b981" name="Đã phân tích" /><Bar dataKey="pending" stackId="cv" fill="#f59e0b" name="Đang xử lý" /><Bar dataKey="failed" stackId="cv" fill="#ef4444" name="Lỗi" /></BarChart></ResponsiveContainer></ChartCard>
        <ChartCard title="Conversion từ gợi ý việc làm"><ResponsiveContainer><BarChart data={conversionData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="viewed" fill="#93c5fd" name="Đã xem gợi ý" /><Bar dataKey="applied" fill="#2563eb" name="Đã ứng tuyển" /><Bar dataKey="hired" fill="#10b981" name="Đã tuyển" /></BarChart></ResponsiveContainer></ChartCard>
      </section>

      <section className="mt-5">
        <Card>
          <SectionHeader title="Danh sách cần xử lý" description={`Dữ liệu theo bộ lọc ${rangeLabels[timeRange]}.`} />
          <div className="grid gap-3 xl:grid-cols-2">
            {actionItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <StatusBadge label={item.type} tone={item.priority === "Cao" ? "danger" : "warning"} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.time} • Ưu tiên {item.priority}</p>
                </div>
                <Link to={item.path}><Button variant="secondary" size="sm">Xử lý</Button></Link>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </PageContainer>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return <Card><SectionHeader title={title} /><div className="h-72">{children}</div></Card>;
}

function scaled(value: number, multiplier: number) {
  return Math.max(1, Math.round(value * multiplier));
}
