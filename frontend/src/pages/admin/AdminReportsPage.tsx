import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { Timeline } from "../../components/ui/Timeline";
import { adminTone } from "../../features/admin/adminLabels";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockAdminService } from "../../services/mock";
import type { Report } from "../../types/domain";

type ReportAction = "assign" | "accept" | "processing" | "resolve" | "reject" | "lock" | "hide" | "note" | null;
type Priority = "Thấp" | "Trung bình" | "Cao" | "Khẩn cấp";

interface ManagedReport extends Report {
  reportCategory: string;
  priority: Priority;
  evidence: string[];
  relatedEntity: string;
  previousReports: number;
  internalNotes: string[];
  timeline: Array<{ label: string; at: string; note: string }>;
}

interface AuditItem {
  id: string;
  label: string;
  at: string;
  note: string;
}

const reportTypes = ["Tin giả", "Công ty lừa đảo", "Quấy rối", "Spam", "Thông tin sai", "Vi phạm riêng tư", "Khác"];
const admins = ["Quản trị viên", "Admin nội dung", "Admin an toàn", "Admin tuyển dụng"];
const priorities: Priority[] = ["Thấp", "Trung bình", "Cao", "Khẩn cấp"];

export function AdminReportsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { reportId } = useParams();
  const { showToast } = useToast();
  const reportsQuery = useAsyncData(() => mockAdminService.getReports({ pageSize: 100 }), []);
  const [reports, setReports] = useState<ManagedReport[]>([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [date, setDate] = useState("");
  const [handler, setHandler] = useState("");
  const [actionType, setActionType] = useState<ReportAction>(null);
  const [actionTarget, setActionTarget] = useState<ManagedReport | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [assignAdmin, setAssignAdmin] = useState(admins[0]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  useEffect(() => {
    if (reportsQuery.data?.items) setReports(reportsQuery.data.items.map(enrichReport));
  }, [reportsQuery.data?.items]);

  const selectedReport = reports.find((report) => report.id === reportId) ?? reports[0];
  const filteredReports = useMemo(() => reports.filter((report) => {
    const matchType = !type || report.reportCategory === type;
    const matchStatus = !status || report.status === status;
    const matchPriority = !priority || report.priority === priority;
    const matchDate = !date || report.createdAt.startsWith(date);
    const matchHandler = !handler || (report.handler ?? "Chưa có") === handler;
    return matchType && matchStatus && matchPriority && matchDate && matchHandler;
  }), [date, handler, priority, reports, status, type]);

  function openAction(action: ReportAction, report: ManagedReport) {
    setActionType(action);
    setActionTarget(report);
    setActionReason("");
    setAssignAdmin(report.handler ?? admins[0]);
  }

  async function updateReport(id: string, statusValue: Report["status"], note: string, nextHandler?: string) {
    const timelineItem = { label: reportStatusLabel(statusValue), at: new Date().toISOString(), note };
    setReports((current) => current.map((report) => report.id === id ? { ...report, status: statusValue, handler: nextHandler ?? report.handler ?? "Quản trị viên", timeline: [timelineItem, ...report.timeline] } : report));
    await mockAdminService.updateReport(id, { status: statusValue, handler: nextHandler ?? "Quản trị viên" });
    addAudit(reportStatusLabel(statusValue), note);
    showToast({ type: "success", title: "Đã cập nhật báo cáo" });
  }

  async function confirmAction() {
    if (!actionTarget || !actionType) return;
    if ((actionType === "resolve" || actionType === "reject" || actionType === "lock" || actionType === "hide" || actionType === "note") && !actionReason.trim()) {
      showToast({ type: "error", title: actionType === "resolve" ? "Vui lòng nhập kết quả xử lý" : actionType === "reject" ? "Vui lòng nhập lý do từ chối" : "Vui lòng nhập nội dung" });
      return;
    }
    if (actionType === "assign") await updateReport(actionTarget.id, actionTarget.status, `Gán admin phụ trách: ${assignAdmin}`, assignAdmin);
    if (actionType === "accept") await updateReport(actionTarget.id, "processing", "Admin tiếp nhận báo cáo.", actionTarget.handler ?? "Quản trị viên");
    if (actionType === "processing") await updateReport(actionTarget.id, "processing", "Báo cáo đang được xử lý.", actionTarget.handler ?? "Quản trị viên");
    if (actionType === "resolve") await updateReport(actionTarget.id, "resolved", actionReason, actionTarget.handler ?? "Quản trị viên");
    if (actionType === "reject") await updateReport(actionTarget.id, "rejected", actionReason, actionTarget.handler ?? "Quản trị viên");
    if (actionType === "lock") {
      await updateReport(actionTarget.id, "resolved", `Khóa đối tượng ${actionTarget.target}. ${actionReason}`, actionTarget.handler ?? "Quản trị viên");
    }
    if (actionType === "hide") {
      await updateReport(actionTarget.id, "resolved", `Ẩn tin/đối tượng liên quan ${actionTarget.target}. ${actionReason}`, actionTarget.handler ?? "Quản trị viên");
    }
    if (actionType === "note") {
      setReports((current) => current.map((report) => report.id === actionTarget.id ? { ...report, internalNotes: [actionReason, ...report.internalNotes] } : report));
      addAudit("Thêm note nội bộ", `${actionTarget.id}: ${actionReason}`);
      showToast({ type: "success", title: "Đã thêm note" });
    }
    setActionType(null);
    setActionTarget(null);
    setActionReason("");
  }

  function addAudit(label: string, note: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}`, label, note, at: new Date().toISOString() }, ...current]);
  }

  if (mode === "detail" && selectedReport) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết báo cáo vi phạm" description="Xem nội dung, bằng chứng, đối tượng liên quan, timeline xử lý và ghi chú nội bộ." />
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">{selectedReport.id}</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedReport.reportCategory}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{selectedReport.content}</p>
                </div>
                <StatusBadge label={reportStatusLabel(selectedReport.status)} tone={adminTone(selectedReport.status)} />
              </div>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <Info label="Người báo cáo" value={selectedReport.reporter} />
                <Info label="Đối tượng bị báo cáo" value={selectedReport.target} />
                <Info label="Ngày gửi" value={formatDateTime(selectedReport.createdAt)} />
                <Info label="Mức ưu tiên" value={selectedReport.priority} />
                <Info label="Admin phụ trách" value={selectedReport.handler ?? "Chưa có"} />
                <Info label="Liên quan" value={selectedReport.relatedEntity} />
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Bằng chứng placeholder</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {selectedReport.evidence.map((item) => <div key={item} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{item}</div>)}
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Job, company hoặc user liên quan</h3>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <Info label="Target" value={selectedReport.target} />
                <Info label="Entity" value={selectedReport.relatedEntity} />
                <Info label="Báo cáo trước" value={`${selectedReport.previousReports} báo cáo`} />
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Internal notes</h3>
              <div className="mt-4 space-y-2">
                {(selectedReport.internalNotes.length ? selectedReport.internalNotes : ["Chưa có ghi chú nội bộ."]).map((note) => <p key={note} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{note}</p>)}
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Actions</h3>
              <div className="mt-4 grid gap-2">
                <Button onClick={() => openAction("assign", selectedReport)}>Gán admin xử lý</Button>
                <Button variant="secondary" onClick={() => openAction("accept", selectedReport)}>Tiếp nhận</Button>
                <Button variant="secondary" onClick={() => openAction("processing", selectedReport)}>Đang xử lý</Button>
                <Button onClick={() => openAction("resolve", selectedReport)}>Giải quyết</Button>
                <Button variant="danger" onClick={() => openAction("reject", selectedReport)}>Từ chối báo cáo</Button>
                <Button variant="secondary" onClick={() => openAction("lock", selectedReport)}>Khóa đối tượng</Button>
                <Button variant="secondary" onClick={() => openAction("hide", selectedReport)}>Ẩn tin</Button>
                <Button variant="secondary" onClick={() => openAction("note", selectedReport)}>Thêm note</Button>
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Timeline xử lý</h3>
              <div className="mt-4"><Timeline items={selectedReport.timeline} /></div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Audit log</h3>
              <div className="mt-4"><Timeline items={(auditLogs.length ? auditLogs : [{ id: "init", label: "Mở báo cáo", at: selectedReport.createdAt, note: "Báo cáo được ghi nhận trong hệ thống." }]).map((item) => ({ label: item.label, at: item.at, note: item.note }))} /></div>
            </Card>
          </aside>
        </div>
        <ReportActionModal actionType={actionType} target={actionTarget} reason={actionReason} assignAdmin={assignAdmin} setReason={setActionReason} setAssignAdmin={setAssignAdmin} onClose={() => setActionType(null)} onConfirm={() => void confirmAction()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Báo cáo vi phạm" description="Quản lý báo cáo vi phạm, lọc theo loại, trạng thái, ưu tiên, ngày gửi và admin phụ trách." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Select label="Loại" value={type} onChange={(event) => setType(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...reportTypes.map((value) => ({ label: value, value }))]} />
          <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Mới", value: "new" }, { label: "Đang xử lý", value: "processing" }, { label: "Đã giải quyết", value: "resolved" }, { label: "Từ chối", value: "rejected" }]} />
          <Select label="Priority" value={priority} onChange={(event) => setPriority(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...priorities.map((value) => ({ label: value, value }))]} />
          <Input label="Ngày gửi" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Select label="Admin phụ trách" value={handler} onChange={(event) => setHandler(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Chưa có", value: "Chưa có" }, ...admins.map((value) => ({ label: value, value }))]} />
        </div>
      </Card>

      <Table
        rows={filteredReports}
        getRowKey={(report) => report.id}
        columns={[
          { key: "id", header: "Report ID", render: (report) => <Link className="font-medium text-brand-700" to={`/admin/reports/${report.id}`}>{report.id}</Link> },
          { key: "type", header: "Loại", render: (report) => <ReportTypeCell report={report} /> },
          { key: "reporter", header: "Người báo cáo", render: (report) => report.reporter },
          { key: "target", header: "Đối tượng", render: (report) => report.target },
          { key: "date", header: "Ngày gửi", render: (report) => formatDateTime(report.createdAt) },
          { key: "priority", header: "Mức ưu tiên", render: (report) => <PriorityBadge priority={report.priority} /> },
          { key: "status", header: "Trạng thái", render: (report) => <StatusBadge label={reportStatusLabel(report.status)} tone={adminTone(report.status)} /> },
          { key: "handler", header: "Admin phụ trách", render: (report) => report.handler ?? "Chưa có" },
          { key: "actions", header: "Thao tác", render: (report) => <ReportActions report={report} onOpen={openAction} /> },
        ]}
      />
      <ReportActionModal actionType={actionType} target={actionTarget} reason={actionReason} assignAdmin={assignAdmin} setReason={setActionReason} setAssignAdmin={setAssignAdmin} onClose={() => setActionType(null)} onConfirm={() => void confirmAction()} />
    </PageContainer>
  );
}

function ReportTypeCell({ report }: { report: ManagedReport }) {
  return (
    <div className="min-w-[170px]">
      <p className="font-medium text-slate-900">{report.reportCategory}</p>
      <p className="mt-1 text-xs text-slate-500">{report.type}</p>
    </div>
  );
}

function ReportActions({ report, onOpen }: { report: ManagedReport; onOpen: (action: ReportAction, report: ManagedReport) => void }) {
  return (
    <div className="grid w-[104px] gap-2">
      <Link to={`/admin/reports/${report.id}`}><Button className="w-full" size="sm" variant="secondary">Chi tiết</Button></Link>
      <Button className="w-full" size="sm" onClick={() => onOpen("accept", report)}>Tiếp nhận</Button>
      <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("lock", report)}>Khóa</Button>
    </div>
  );
}

function ReportActionModal({ actionType, target, reason, assignAdmin, setReason, setAssignAdmin, onClose, onConfirm }: { actionType: ReportAction; target: ManagedReport | null; reason: string; assignAdmin: string; setReason: (value: string) => void; setAssignAdmin: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  const needsReason = actionType === "resolve" || actionType === "reject" || actionType === "lock" || actionType === "hide" || actionType === "note";
  const isSensitive = actionType === "lock" || actionType === "hide";
  return (
    <Modal open={Boolean(actionType && target)} title={getActionTitle(actionType)} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700"><strong>{target?.id}</strong> - {target?.reportCategory}</p>
        {actionType === "assign" ? <Select label="Admin phụ trách" value={assignAdmin} onChange={(event) => setAssignAdmin(event.target.value)} options={admins.map((admin) => ({ label: admin, value: admin }))} /> : null}
        {isSensitive ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Action nhạy cảm, vui lòng xác nhận và nhập lý do trước khi thực hiện.</p> : null}
        {needsReason ? <Textarea label={actionType === "resolve" ? "Kết quả xử lý" : actionType === "reject" ? "Lý do từ chối" : "Nội dung"} value={reason} onChange={(event) => setReason(event.target.value)} /> : <p className="text-sm text-slate-600">Xác nhận cập nhật trạng thái báo cáo.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant={actionType === "reject" || isSensitive ? "danger" : "primary"} onClick={onConfirm}>Xác nhận</Button>
        </div>
      </div>
    </Modal>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const tone = priority === "Khẩn cấp" || priority === "Cao" ? "danger" : priority === "Trung bình" ? "warning" : "neutral";
  return <StatusBadge label={priority} tone={tone} />;
}

function Info({ label, value }: { label: string; value: string }) {
  return <p className="text-slate-700"><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function enrichReport(report: Report): ManagedReport {
  const category = getReportCategory(report);
  const priority = getPriority(report);
  return {
    ...report,
    reportCategory: category,
    priority,
    evidence: [`Ảnh chụp màn hình ${report.id}.png`, `Log trao đổi ${report.id}.txt`, "Liên kết đối tượng liên quan"],
    relatedEntity: report.target.startsWith("job") ? "Tin tuyển dụng" : report.target.startsWith("company") ? "Công ty" : report.target.startsWith("conversation") ? "Tin nhắn" : "Người dùng",
    previousReports: report.status === "new" ? 1 : report.status === "processing" ? 3 : 2,
    internalNotes: report.handler ? [`${report.handler} đã tiếp nhận báo cáo.`] : [],
    timeline: [
      { label: "Gửi báo cáo", at: report.createdAt, note: report.content },
      ...(report.handler ? [{ label: "Tiếp nhận", at: "2026-07-09T09:00:00", note: `${report.handler} tiếp nhận xử lý.` }] : []),
    ],
  };
}

function getReportCategory(report: Report) {
  const text = `${report.type} ${report.content}`.toLowerCase();
  if (text.includes("lương") || text.includes("tin tuyển dụng")) return "Tin giả";
  if (text.includes("công ty")) return "Công ty lừa đảo";
  if (text.includes("làm phiền") || text.includes("quấy")) return "Quấy rối";
  if (text.includes("spam")) return "Spam";
  if (text.includes("riêng tư")) return "Vi phạm riêng tư";
  if (text.includes("sai")) return "Thông tin sai";
  return "Khác";
}

function getPriority(report: Report): Priority {
  if (report.status === "new") return "Cao";
  if (report.type.toLowerCase().includes("lừa đảo")) return "Khẩn cấp";
  if (report.status === "processing") return "Trung bình";
  return "Thấp";
}

function reportStatusLabel(status: Report["status"]) {
  const labels = { new: "Mới", processing: "Đang xử lý", resolved: "Đã giải quyết", rejected: "Từ chối" };
  return labels[status];
}

function getActionTitle(actionType: ReportAction) {
  if (actionType === "assign") return "Gán admin xử lý";
  if (actionType === "accept") return "Tiếp nhận báo cáo";
  if (actionType === "processing") return "Chuyển đang xử lý";
  if (actionType === "resolve") return "Giải quyết báo cáo";
  if (actionType === "reject") return "Từ chối báo cáo";
  if (actionType === "lock") return "Khóa đối tượng";
  if (actionType === "hide") return "Ẩn tin";
  if (actionType === "note") return "Thêm note";
  return "Thao tác báo cáo";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
