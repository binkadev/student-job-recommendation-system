import { Activity, Database, ShieldCheck, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useToast } from "../../hooks/useToast";
import { analytics } from "../../mocks";

interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  targetType: string;
  target: string;
  ip: string;
  result: "success" | "failed" | "warning";
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  reason: string;
  userAgent: string;
}

const auditLogs: AuditLog[] = [
  { id: "log-1", timestamp: "2026-07-11T08:30:00", actor: "Admin hệ thống", role: "ADMIN", action: "Duyệt tin tuyển dụng", targetType: "Tin tuyển dụng", target: "job-4", ip: "10.0.0.12", result: "success", beforeData: { status: "pending" }, afterData: { status: "published" }, reason: "Tin đạt yêu cầu kiểm duyệt.", userAgent: "Chrome 126 / Windows" },
  { id: "log-2", timestamp: "2026-07-11T09:10:00", actor: "Admin nội dung", role: "CONTENT_ADMIN", action: "Cập nhật banner", targetType: "Nội dung", target: "banner-home", ip: "10.0.0.23", result: "success", beforeData: { status: "draft", title: "Banner cũ" }, afterData: { status: "published", title: "Banner tuyển dụng tháng 7" }, reason: "Cập nhật chiến dịch nội dung.", userAgent: "Edge 126 / Windows" },
  { id: "log-3", timestamp: "2026-07-11T10:05:00", actor: "Admin an toàn", role: "SECURITY_ADMIN", action: "Khóa tài khoản", targetType: "Người dùng", target: "user-22", ip: "10.0.0.34", result: "warning", beforeData: { status: "active" }, afterData: { status: "inactive" }, reason: "Nghi ngờ spam tin nhắn.", userAgent: "Firefox 127 / Windows" },
  { id: "log-4", timestamp: "2026-07-11T10:45:00", actor: "Hệ thống", role: "SYSTEM", action: "Retry phân tích CV", targetType: "CV", target: "cv-5", ip: "127.0.0.1", result: "success", beforeData: { status: "failed", retryCount: 1 }, afterData: { status: "analyzed", retryCount: 2 }, reason: "Retry theo yêu cầu admin.", userAgent: "System worker" },
  { id: "log-5", timestamp: "2026-07-11T11:20:00", actor: "Admin tuyển dụng", role: "RECRUITMENT_ADMIN", action: "Từ chối doanh nghiệp", targetType: "Công ty", target: "company-8", ip: "10.0.0.45", result: "failed", beforeData: { status: "pending" }, afterData: { status: "rejected" }, reason: "Thiếu tài liệu thuế.", userAgent: "Chrome 126 / Windows" },
  { id: "log-6", timestamp: "2026-07-12T08:15:00", actor: "Admin hệ thống", role: "ADMIN", action: "Gán xử lý báo cáo", targetType: "Báo cáo", target: "report-2", ip: "10.0.0.12", result: "success", beforeData: { handler: null }, afterData: { handler: "Admin an toàn" }, reason: "Báo cáo liên quan công ty chưa xác thực.", userAgent: "Chrome 126 / Windows" },
];

export function AdminAnalyticsPage({ mode = "analytics" }: { mode?: "analytics" | "audit" }) {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [result, setResult] = useState("");
  const [page, setPage] = useState(1);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const filteredLogs = useMemo(() => auditLogs.filter((log) => {
    const searchable = `${log.actor} ${log.action} ${log.targetType} ${log.target} ${log.reason}`.toLowerCase();
    const matchQuery = !query || searchable.includes(query.toLowerCase());
    const matchActor = !actor || log.actor === actor;
    const matchAction = !action || log.action === action;
    const matchTarget = !targetType || log.targetType === targetType;
    const logDate = log.timestamp.slice(0, 10);
    const matchFrom = !dateFrom || logDate >= dateFrom;
    const matchTo = !dateTo || logDate <= dateTo;
    const matchResult = !result || log.result === result;
    return matchQuery && matchActor && matchAction && matchTarget && matchFrom && matchTo && matchResult;
  }), [action, actor, dateFrom, dateTo, query, result, targetType]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / 5));
  const pagedLogs = filteredLogs.slice((page - 1) * 5, page * 5);

  if (mode === "audit") {
    return (
      <PageContainer>
        <PageHeader title="Audit logs" description="Nhật ký quản trị chỉ đọc: lọc, phân trang, xem chi tiết before/after và export CSV mock." />
        <Card className="mb-5">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Input label="Search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Admin, action, target..." />
            <Select label="Admin" value={actor} onChange={(event) => { setActor(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...unique(auditLogs.map((log) => log.actor)).map((value) => ({ label: value, value }))]} />
            <Select label="Action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...unique(auditLogs.map((log) => log.action)).map((value) => ({ label: value, value }))]} />
            <Select label="Target type" value={targetType} onChange={(event) => { setTargetType(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...unique(auditLogs.map((log) => log.targetType)).map((value) => ({ label: value, value }))]} />
            <Input label="Từ ngày" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
            <Input label="Đến ngày" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
            <Select label="Result" value={result} onChange={(event) => { setResult(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, { label: "Success", value: "success" }, { label: "Failed", value: "failed" }, { label: "Warning", value: "warning" }]} />
          </div>
        </Card>
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" onClick={() => showToast({ type: "success", title: `Đã export CSV mock ${filteredLogs.length} dòng` })}>Export CSV mock</Button>
        </div>
        <Table rows={pagedLogs} getRowKey={(log) => log.id} columns={[
          { key: "time", header: "Thời gian", render: (log) => <TimeCell log={log} /> },
          { key: "actor", header: "Admin", render: (log) => <AdminCell log={log} /> },
          { key: "action", header: "Hành động & đối tượng", render: (log) => <ActionTargetCell log={log} /> },
          { key: "result", header: "Kết quả", render: (log) => <ResultBadge result={log.result} /> },
          { key: "actions", header: "Chi tiết", render: (log) => <Button size="sm" variant="secondary" onClick={() => setDetailLog(log)}>Xem</Button> },
        ]} />
        <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
        <AuditDetailDrawer log={detailLog} onClose={() => setDetailLog(null)} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Thống kê hệ thống" description="Tổng hợp tăng trưởng người dùng, tin tuyển dụng, đơn ứng tuyển và CV được phân tích." />
      <div className="mb-5 flex justify-end">
        <Button variant="secondary" onClick={() => showToast({ type: "success", title: "Đã làm mới thống kê mock" })}>Làm mới</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<UserCog size={20} />} label="Người dùng mới" value="1.284" />
        <Metric icon={<Database size={20} />} label="Tin tuyển dụng" value="426" />
        <Metric icon={<Activity size={20} />} label="Đơn ứng tuyển" value="3.912" />
        <Metric icon={<ShieldCheck size={20} />} label="Tỷ lệ duyệt hợp lệ" value="94%" />
      </div>
      <Card className="mt-5 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={analytics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="users" name="Người dùng" stroke="#2563eb" fill="#bfdbfe" />
            <Area type="monotone" dataKey="jobs" name="Tin tuyển dụng" stroke="#059669" fill="#bbf7d0" />
            <Area type="monotone" dataKey="applications" name="Đơn ứng tuyển" stroke="#ea580c" fill="#fed7aa" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </PageContainer>
  );
}

function TimeCell({ log }: { log: AuditLog }) {
  return (
    <div className="min-w-[130px] text-sm">
      <p className="font-medium text-slate-900">{formatDateTime(log.timestamp)}</p>
      <p className="mt-1 text-xs text-slate-500">{log.ip}</p>
    </div>
  );
}

function AdminCell({ log }: { log: AuditLog }) {
  return (
    <div className="min-w-[150px]">
      <p className="font-medium text-slate-900">{log.actor}</p>
      <p className="mt-1 text-xs text-slate-500">{log.role} • {log.id}</p>
    </div>
  );
}

function ActionTargetCell({ log }: { log: AuditLog }) {
  return (
    <div className="min-w-[240px]">
      <p className="font-medium text-slate-900">{log.action}</p>
      <p className="mt-1 text-xs text-slate-500">{log.targetType}: {log.target}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{log.reason}</p>
    </div>
  );
}

function ResultBadge({ result }: { result: AuditLog["result"] }) {
  const labels = { success: "Thành công", failed: "Thất bại", warning: "Cảnh báo" };
  const tones = { success: "success", failed: "danger", warning: "warning" } as const;
  return <StatusBadge label={labels[result]} tone={tones[result]} />;
}

function AuditDetailDrawer({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(log)} title="Chi tiết audit log" onClose={onClose} size="xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3 text-sm text-slate-700">
          <Info label="Full timestamp" value={log ? formatDateTime(log.timestamp) : ""} />
          <Info label="Actor" value={log?.actor ?? ""} />
          <Info label="Role" value={log?.role ?? ""} />
          <Info label="Action" value={log?.action ?? ""} />
          <Info label="Target" value={log ? `${log.targetType}: ${log.target}` : ""} />
          <Info label="Reason" value={log?.reason ?? ""} />
          <Info label="IP" value={log?.ip ?? ""} />
          <Info label="User agent mock" value={log?.userAgent ?? ""} />
          <div><span className="font-medium text-slate-500">Result:</span> {log ? <ResultBadge result={log.result} /> : null}</div>
        </div>
        <div className="grid gap-4">
          <JsonBlock title="Before data" data={log?.beforeData ?? {}} />
          <JsonBlock title="After data" data={log?.afterData ?? {}} />
        </div>
      </div>
      <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={onClose}>Đóng</Button></div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function JsonBlock({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </Card>
  );
}
