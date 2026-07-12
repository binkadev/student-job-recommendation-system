import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useToast } from "../../hooks/useToast";

interface ReportRow {
  id: string;
  month: string;
  jobTitle: string;
  department: string;
  recruiter: string;
  source: string;
  applications: number;
  qualified: number;
  interviews: number;
  offers: number;
  hires: number;
  timeToHire: number;
  offerAccepted: number;
}

const reportData: ReportRow[] = [
  { id: "r-1", month: "2026-03", jobTitle: "Frontend Developer", department: "Sản phẩm", recruiter: "Trần Thị Bình", source: "Gợi ý hệ thống", applications: 96, qualified: 52, interviews: 31, offers: 12, hires: 8, timeToHire: 17, offerAccepted: 10 },
  { id: "r-2", month: "2026-03", jobTitle: "Backend Developer", department: "Backend", recruiter: "Đỗ Quốc Huy", source: "LinkedIn", applications: 82, qualified: 39, interviews: 24, offers: 9, hires: 5, timeToHire: 21, offerAccepted: 6 },
  { id: "r-3", month: "2026-04", jobTitle: "Full-stack Developer", department: "Full-stack", recruiter: "Nguyễn Minh Đức", source: "TopCV", applications: 74, qualified: 34, interviews: 22, offers: 8, hires: 4, timeToHire: 24, offerAccepted: 5 },
  { id: "r-4", month: "2026-04", jobTitle: "UI/UX Designer", department: "Design", recruiter: "Trần Thị Bình", source: "VietnamWorks", applications: 58, qualified: 28, interviews: 16, offers: 6, hires: 3, timeToHire: 19, offerAccepted: 4 },
  { id: "r-5", month: "2026-05", jobTitle: "Data Analyst Intern", department: "Dữ liệu", recruiter: "Lê Hoàng Phúc", source: "Gợi ý hệ thống", applications: 110, qualified: 61, interviews: 35, offers: 14, hires: 10, timeToHire: 15, offerAccepted: 12 },
  { id: "r-6", month: "2026-05", jobTitle: "DevOps Engineer", department: "DevOps", recruiter: "Nguyễn Minh Đức", source: "Referral", applications: 46, qualified: 21, interviews: 13, offers: 5, hires: 2, timeToHire: 31, offerAccepted: 3 },
  { id: "r-7", month: "2026-06", jobTitle: "Mobile Developer", department: "Mobile", recruiter: "Lê Hoàng Phúc", source: "LinkedIn", applications: 68, qualified: 33, interviews: 19, offers: 7, hires: 4, timeToHire: 22, offerAccepted: 5 },
  { id: "r-8", month: "2026-06", jobTitle: "QA Engineer", department: "QA", recruiter: "Đỗ Quốc Huy", source: "TopCV", applications: 72, qualified: 37, interviews: 20, offers: 8, hires: 5, timeToHire: 18, offerAccepted: 7 },
  { id: "r-9", month: "2026-07", jobTitle: "Frontend Developer", department: "Sản phẩm", recruiter: "Trần Thị Bình", source: "Gợi ý hệ thống", applications: 88, qualified: 49, interviews: 29, offers: 11, hires: 7, timeToHire: 16, offerAccepted: 9 },
  { id: "r-10", month: "2026-07", jobTitle: "Backend Developer", department: "Backend", recruiter: "Đỗ Quốc Huy", source: "VietnamWorks", applications: 64, qualified: 30, interviews: 18, offers: 6, hires: 3, timeToHire: 25, offerAccepted: 4 },
];

const colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function RecruiterReportsPage() {
  const { showToast } = useToast();
  const [fromMonth, setFromMonth] = useState("2026-03");
  const [toMonth, setToMonth] = useState("2026-07");
  const [jobFilter, setJobFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [recruiterFilter, setRecruiterFilter] = useState("");

  const jobs = useMemo(() => unique(reportData.map((item) => item.jobTitle)), []);
  const departments = useMemo(() => unique(reportData.map((item) => item.department)), []);
  const recruiters = useMemo(() => unique(reportData.map((item) => item.recruiter)), []);

  const filteredData = useMemo(() => reportData.filter((item) => {
    const matchFrom = !fromMonth || item.month >= fromMonth;
    const matchTo = !toMonth || item.month <= toMonth;
    const matchJob = !jobFilter || item.jobTitle === jobFilter;
    const matchDepartment = !departmentFilter || item.department === departmentFilter;
    const matchRecruiter = !recruiterFilter || item.recruiter === recruiterFilter;
    return matchFrom && matchTo && matchJob && matchDepartment && matchRecruiter;
  }), [departmentFilter, fromMonth, jobFilter, recruiterFilter, toMonth]);

  const totals = useMemo(() => summarize(filteredData), [filteredData]);
  const trendData = useMemo(() => groupByMonth(filteredData), [filteredData]);
  const sourceData = useMemo(() => groupSum(filteredData, "source", "applications"), [filteredData]);
  const recruiterPerformance = useMemo(() => groupRecruiterPerformance(filteredData), [filteredData]);
  const jobPerformance = useMemo(() => groupJobPerformance(filteredData), [filteredData]);

  function exportCsv() {
    const rows = [
      ["month", "jobTitle", "department", "recruiter", "source", "applications", "qualified", "interviews", "offers", "hires", "timeToHire", "offerAccepted"],
      ...filteredData.map((item) => [item.month, item.jobTitle, item.department, item.recruiter, item.source, item.applications, item.qualified, item.interviews, item.offers, item.hires, item.timeToHire, item.offerAccepted]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-tuyen-dung-${fromMonth || "all"}-${toMonth || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ type: "success", title: "Đã export CSV", message: "File CSV được tạo từ dữ liệu đang filter." });
  }

  return (
    <PageContainer>
      <PageHeader title="Báo cáo tuyển dụng" description="Theo dõi hiệu quả tuyển dụng theo thời gian, tin đăng, phòng ban, recruiter và nguồn ứng viên." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Từ tháng" type="month" value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} />
          <Input label="Đến tháng" type="month" value={toMonth} onChange={(event) => setToMonth(event.target.value)} />
          <Select label="Tin tuyển dụng" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...jobs.map((value) => ({ label: value, value }))]} />
          <Select label="Phòng ban" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...departments.map((value) => ({ label: value, value }))]} />
          <Select label="Recruiter" value={recruiterFilter} onChange={(event) => setRecruiterFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...recruiters.map((value) => ({ label: value, value }))]} />
          <Button className="self-end" onClick={exportCsv}>Export CSV</Button>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Tổng ứng viên" value={totals.applications} />
        <StatCard label="Ứng viên đạt yêu cầu" value={totals.qualified} />
        <StatCard label="Phỏng vấn" value={totals.interviews} />
        <StatCard label="Offer" value={totals.offers} />
        <StatCard label="Đã tuyển" value={totals.hires} />
        <StatCard label="Time to hire" value={`${totals.timeToHire} ngày`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="Applications trend">
          <ResponsiveContainer>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="applications" stroke="#2563eb" name="Ứng viên" strokeWidth={2} />
              <Line type="monotone" dataKey="qualified" stroke="#10b981" name="Đạt yêu cầu" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Source distribution">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="label" outerRadius={95} label>
                {sourceData.map((item, index) => <Cell key={item.label} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pipeline conversion">
          <ResponsiveContainer>
            <BarChart data={[totals]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" fill="#2563eb" name="Tổng ứng viên" />
              <Bar dataKey="qualified" fill="#10b981" name="Đạt yêu cầu" />
              <Bar dataKey="interviews" fill="#f59e0b" name="Phỏng vấn" />
              <Bar dataKey="offers" fill="#8b5cf6" name="Offer" />
              <Bar dataKey="hires" fill="#ef4444" name="Đã tuyển" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Recruiter performance">
          <ResponsiveContainer>
            <BarChart data={recruiterPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="hires" fill="#10b981" name="Đã tuyển" />
              <Bar dataKey="offers" fill="#2563eb" name="Offer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Job performance">
          <ResponsiveContainer>
            <BarChart data={jobPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="applications" fill="#2563eb" name="Ứng viên" />
              <Bar dataKey="hires" fill="#10b981" name="Đã tuyển" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Offer acceptance">
          <ResponsiveContainer>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="offerAcceptance" stroke="#8b5cf6" name="Tỷ lệ chấp nhận offer" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <ReportTable title="Tin hiệu quả nhất" rows={jobPerformance.slice(0, 5)} columns="job" />
        <ReportTable title="Recruiter hiệu quả nhất" rows={recruiterPerformance.slice(0, 5)} columns="recruiter" />
        <SimpleTable title="Nguồn ứng viên tốt nhất" rows={sourceData.map((item) => ({ id: item.label, label: item.label, value: item.value, badge: `${Math.round((item.value / Math.max(1, totals.applications)) * 100)}%` }))} />
        <SimpleTable title="Vị trí khó tuyển" rows={jobPerformance.filter((item) => item.timeToHire >= 22 || item.hires <= 3).map((item) => ({ id: item.label, label: item.label, value: item.timeToHire, badge: `${item.hires} tuyển` }))} />
      </div>
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return <Card><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></Card>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><SectionHeader title={title} /><div className="h-72">{children}</div></Card>;
}

function ReportTable({ title, rows, columns }: { title: string; rows: Array<Record<string, string | number>>; columns: "job" | "recruiter" }) {
  return (
    <Card>
      <SectionHeader title={title} />
      <Table
        rows={rows}
        getRowKey={(row) => String(row.label)}
        columns={[
          { key: "label", header: columns === "job" ? "Tin tuyển dụng" : "Recruiter", render: (row) => <span className="font-medium text-slate-900">{row.label}</span> },
          { key: "applications", header: "Ứng viên", render: (row) => row.applications },
          { key: "hires", header: "Đã tuyển", render: (row) => row.hires },
          { key: "rate", header: "Tỷ lệ", render: (row) => <StatusBadge label={`${row.conversion}%`} tone={Number(row.conversion) >= 8 ? "success" : "warning"} /> },
        ]}
      />
    </Card>
  );
}

function SimpleTable({ title, rows }: { title: string; rows: Array<{ id: string; label: string; value: number; badge: string }> }) {
  return (
    <Card>
      <SectionHeader title={title} />
      <Table
        rows={rows}
        getRowKey={(row) => row.id}
        columns={[
          { key: "label", header: "Tên", render: (row) => <span className="font-medium text-slate-900">{row.label}</span> },
          { key: "value", header: "Giá trị", render: (row) => row.value },
          { key: "badge", header: "Ghi chú", render: (row) => <StatusBadge label={row.badge} /> },
        ]}
      />
    </Card>
  );
}

function summarize(rows: ReportRow[]) {
  const total = rows.reduce((acc, item) => ({
    label: "Pipeline",
    applications: acc.applications + item.applications,
    qualified: acc.qualified + item.qualified,
    interviews: acc.interviews + item.interviews,
    offers: acc.offers + item.offers,
    hires: acc.hires + item.hires,
    offerAccepted: acc.offerAccepted + item.offerAccepted,
    timeToHireTotal: acc.timeToHireTotal + item.timeToHire * item.hires,
  }), { label: "Pipeline", applications: 0, qualified: 0, interviews: 0, offers: 0, hires: 0, offerAccepted: 0, timeToHireTotal: 0 });
  return {
    ...total,
    timeToHire: total.hires ? Math.round(total.timeToHireTotal / total.hires) : 0,
    offerAcceptance: total.offers ? Math.round((total.offerAccepted / total.offers) * 100) : 0,
  };
}

function groupByMonth(rows: ReportRow[]) {
  return Object.values(rows.reduce<Record<string, ReturnType<typeof summarize>>>((acc, item) => {
    const current = acc[item.month] ? [...rows.filter((row) => row.month === item.month)] : rows.filter((row) => row.month === item.month);
    acc[item.month] = { ...summarize(current), label: item.month };
    return acc;
  }, {})).sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function groupSum(rows: ReportRow[], key: keyof ReportRow, valueKey: keyof ReportRow) {
  return Object.values(rows.reduce<Record<string, { label: string; value: number }>>((acc, item) => {
    const label = String(item[key]);
    acc[label] = { label, value: (acc[label]?.value ?? 0) + Number(item[valueKey]) };
    return acc;
  }, {})).sort((a, b) => b.value - a.value);
}

function groupRecruiterPerformance(rows: ReportRow[]) {
  return groupPerformance(rows, "recruiter");
}

function groupJobPerformance(rows: ReportRow[]) {
  return groupPerformance(rows, "jobTitle");
}

function groupPerformance(rows: ReportRow[], key: "recruiter" | "jobTitle") {
  return Object.values(rows.reduce<Record<string, ReportRow[]>>((acc, item) => {
    acc[item[key]] = [...(acc[item[key]] ?? []), item];
    return acc;
  }, {})).map((items) => {
    const total = summarize(items);
    return {
      label: String(items[0][key]),
      applications: total.applications,
      offers: total.offers,
      hires: total.hires,
      timeToHire: total.timeToHire,
      conversion: total.applications ? Math.round((total.hires / total.applications) * 100) : 0,
    };
  }).sort((a, b) => b.hires - a.hires);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
