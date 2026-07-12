import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Checkbox } from "../../components/ui/Checkbox";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { Timeline } from "../../components/ui/Timeline";
import { adminTone, moderationJobStatusLabels } from "../../features/admin/adminLabels";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockJobService } from "../../services/mock";
import type { Job, JobStatus } from "../../types/domain";

type JobAction = "approve" | "reject" | "request" | "hide" | "restore" | "note" | "bulkApprove" | "bulkHide" | null;

interface JobAuditItem {
  id: string;
  jobId: string;
  admin: string;
  action: string;
  at: string;
  note: string;
}

const moderationOptions = [
  { label: "Chờ duyệt", value: "pending" },
  { label: "Đã duyệt", value: "published" },
  { label: "Bị từ chối", value: "rejected" },
  { label: "Đã ẩn", value: "closed" },
];

const companyVerified: Record<string, boolean> = {
  "company-1": true,
  "company-2": true,
  "company-3": true,
  "company-4": true,
  "company-5": false,
  "company-6": true,
  "company-7": true,
  "company-8": false,
};

const rejectionCounts: Record<string, number> = {
  "job-4": 1,
  "job-11": 2,
};

const companyMeta: Record<string, { taxCode: string; activeJobs: number; violations: string[] }> = {
  "company-1": { taxCode: "0109988123", activeJobs: 5, violations: [] },
  "company-2": { taxCode: "0314455667", activeJobs: 4, violations: [] },
  "company-3": { taxCode: "0402233445", activeJobs: 3, violations: [] },
  "company-4": { taxCode: "0105566778", activeJobs: 6, violations: ["Một lần yêu cầu bổ sung quyền lợi rõ ràng"] },
  "company-5": { taxCode: "1803344556", activeJobs: 2, violations: ["Công ty chưa xác thực", "Một tin từng bị từ chối do thiếu thông tin pháp lý"] },
  "company-6": { taxCode: "0319988776", activeJobs: 8, violations: [] },
  "company-7": { taxCode: "0001122334", activeJobs: 3, violations: ["Cần kiểm chứng chính sách remote và phụ cấp thiết bị"] },
  "company-8": { taxCode: "0206677889", activeJobs: 4, violations: ["Công ty chưa xác thực", "Hai lần chỉnh sửa nội dung tuyển dụng"] },
};

const screeningQuestions: Record<string, string[]> = {
  "job-4": ["Bạn có portfolio UI/UX đã triển khai thực tế không?", "Bạn có thể làm việc onsite tại Cần Thơ không?"],
  "job-9": ["Bạn đã vận hành Kubernetes production bao lâu?", "Bạn có chứng chỉ cloud nào không?"],
};

export function AdminJobsPage({ mode = "list" }: { mode?: "list" | "pending" | "detail" | "review" }) {
  const { jobId } = useParams();
  const { showToast } = useToast();
  const jobsQuery = useAsyncData(() => mockJobService.getJobs({ pageSize: 100 }), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [moderationStatus, setModerationStatus] = useState(mode === "pending" ? "pending" : "");
  const [postedDate, setPostedDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionType, setActionType] = useState<JobAction>(null);
  const [actionTarget, setActionTarget] = useState<Job | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionTemplate, setActionTemplate] = useState("");
  const [notifyRecruiter, setNotifyRecruiter] = useState(true);
  const [auditLogs, setAuditLogs] = useState<JobAuditItem[]>([]);

  useEffect(() => {
    if (jobsQuery.data?.items) setJobs(jobsQuery.data.items);
  }, [jobsQuery.data?.items]);

  useEffect(() => {
    setModerationStatus(mode === "pending" ? "pending" : "");
    setPage(1);
  }, [mode]);

  const selectedJob = jobs.find((job) => job.id === jobId) ?? jobs[0];
  const companies = useMemo(() => unique(jobs.map((job) => job.companyName)), [jobs]);
  const industries = useMemo(() => unique(jobs.map((job) => job.industry)), [jobs]);

  const filteredJobs = useMemo(() => {
    const result = jobs.filter((job) => {
      const searchable = `${job.title} ${job.companyName} ${job.industry} ${job.skills.join(" ")}`.toLowerCase();
      const matchQuery = !query || searchable.includes(query.toLowerCase());
      const matchCompany = !company || job.companyName === company;
      const matchIndustry = !industry || job.industry === industry;
      const matchModeration = !moderationStatus || job.status === moderationStatus;
      const matchDate = !postedDate || job.postedAt === postedDate;
      return matchQuery && matchCompany && matchIndustry && matchModeration && matchDate;
    });
    if (mode === "pending") return [...result].sort((a, b) => getWaitingDays(b) - getWaitingDays(a));
    return result;
  }, [company, industry, jobs, mode, moderationStatus, postedDate, query]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / 8));
  const pagedJobs = filteredJobs.slice((page - 1) * 8, page * 8);
  const allPageSelected = pagedJobs.length > 0 && pagedJobs.every((job) => selectedIds.includes(job.id));

  function openAction(action: JobAction, job: Job | null = null) {
    setActionType(action);
    setActionTarget(job);
    setActionReason("");
    setActionTemplate("");
    setNotifyRecruiter(true);
  }

  async function updateStatus(id: string, statusValue: JobStatus, message: string, note = "") {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, status: statusValue } : job));
    await mockJobService.updateJob(id, { status: statusValue });
    addAudit(id, message, note);
    showToast({ type: "success", title: message });
  }

  function addAudit(id: string, action: string, note: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}-${id}`, jobId: id, admin: "Admin hệ thống", action, note, at: new Date().toISOString() }, ...current]);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleSelectPage() {
    setSelectedIds((current) => allPageSelected ? current.filter((id) => !pagedJobs.some((job) => job.id === id)) : unique([...current, ...pagedJobs.map((job) => job.id)]));
  }

  async function confirmAction() {
    if ((actionType === "reject" || actionType === "request" || actionType === "hide") && !actionTemplate) {
      showToast({ type: "error", title: "Vui lòng chọn reason template" });
      return;
    }
    if (actionType === "reject" && !actionReason.trim()) {
      showToast({ type: "error", title: "Vui lòng nhập lý do từ chối" });
      return;
    }
    if ((actionType === "request" || actionType === "hide" || actionType === "note" || actionType === "bulkHide") && !actionReason.trim()) {
      showToast({ type: "error", title: actionType === "request" ? "Vui lòng nhập nội dung yêu cầu chỉnh sửa" : actionType === "note" ? "Vui lòng nhập ghi chú nội bộ" : "Vui lòng nhập lý do ẩn tin" });
      return;
    }

    if (actionType === "bulkApprove") {
      await Promise.all(selectedIds.map((id) => updateStatus(id, "published", "Đã duyệt nhiều tin", "Bulk action: duyệt nhiều tin tuyển dụng.")));
      setSelectedIds([]);
    }
    if (actionType === "bulkHide") {
      await Promise.all(selectedIds.map((id) => updateStatus(id, "closed", "Đã ẩn nhiều tin", actionReason)));
      setSelectedIds([]);
    }
    if (actionTarget && actionType === "approve") await updateStatus(actionTarget.id, "published", "Đã duyệt tin tuyển dụng", buildActionNote(actionReason || "Tin đạt yêu cầu kiểm duyệt.", actionTemplate, notifyRecruiter));
    if (actionTarget && actionType === "reject") await updateStatus(actionTarget.id, "rejected", "Đã từ chối tin", buildActionNote(actionReason, actionTemplate, notifyRecruiter));
    if (actionTarget && actionType === "request") await updateStatus(actionTarget.id, "pending", "Đã yêu cầu chỉnh sửa tin", buildActionNote(actionReason, actionTemplate, notifyRecruiter));
    if (actionTarget && actionType === "hide") await updateStatus(actionTarget.id, "closed", "Đã ẩn tin", buildActionNote(actionReason, actionTemplate, notifyRecruiter));
    if (actionTarget && actionType === "note") {
      addAudit(actionTarget.id, "Thêm ghi chú nội bộ", actionReason);
      showToast({ type: "success", title: "Đã thêm ghi chú nội bộ" });
    }
    if (actionTarget && actionType === "restore") await updateStatus(actionTarget.id, "published", "Đã khôi phục tin", "Tin được khôi phục hiển thị.");

    setActionType(null);
    setActionTarget(null);
    setActionReason("");
    setActionTemplate("");
    setNotifyRecruiter(true);
  }

  if (jobsQuery.loading) return <PageContainer><LoadingState /></PageContainer>;

  if ((mode === "detail" || mode === "review") && selectedJob) {
    const logs = getJobAuditLogs(selectedJob, auditLogs);
    const meta = getCompanyMeta(selectedJob);
    return (
      <PageContainer>
        <PageHeader title={mode === "review" ? "Duyệt tin tuyển dụng" : "Chi tiết tin tuyển dụng"} description="Kiểm tra nội dung tin, thông tin công ty, cảnh báo và lịch sử kiểm duyệt." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card>
              <h2 className="text-xl font-semibold text-slate-950">{selectedJob.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{selectedJob.companyName} • {selectedJob.location} • {selectedJob.salary}</p>
              <div className="mt-4 flex flex-wrap gap-2">{selectedJob.skills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{selectedJob.description}</p>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <Info label="Tên vị trí" value={selectedJob.title} />
                <Info label="Công ty" value={selectedJob.companyName} />
                <Info label="Lương" value={selectedJob.salary} />
                <Info label="Địa điểm" value={selectedJob.location} />
                <Info label="Kinh nghiệm" value={selectedJob.experience} />
                <Info label="Loại hình" value={selectedJob.jobType} />
                <Info label="Ngành nghề" value={selectedJob.industry} />
                <Info label="Hạn tuyển" value={formatDate(selectedJob.deadline)} />
                <Info label="Số ứng viên" value={`${selectedJob.applicants} ứng viên`} />
              </div>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Yêu cầu</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{selectedJob.requirements.map((item) => <li key={item}>• {item}</li>)}</ul>
              <h3 className="mt-5 text-base font-semibold text-slate-950">Quyền lợi</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{selectedJob.benefits.map((item) => <li key={item}>• {item}</li>)}</ul>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Câu hỏi sàng lọc</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{getScreeningQuestions(selectedJob).map((item) => <li key={item}>• {item}</li>)}</ul>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Cảnh báo mock</h3>
              <WarningBox job={selectedJob} />
            </Card>
          </div>
          <aside className="space-y-4">
            <Card>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={moderationJobStatusLabels[selectedJob.status]} tone={adminTone(selectedJob.status)} />
                <StatusBadge label={isCompanyVerified(selectedJob) ? "Công ty đã xác thực" : "Công ty chưa xác thực"} tone={isCompanyVerified(selectedJob) ? "success" : "warning"} />
              </div>
              <div className="mt-4"><Timeline items={logs.map((item) => ({ label: `${item.admin} - ${item.action}`, at: item.at, note: item.note }))} /></div>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Thông tin công ty</h3>
              <div className="mt-4 space-y-3 text-sm">
                <Info label="Trạng thái xác thực" value={isCompanyVerified(selectedJob) ? "Đã xác thực" : "Chưa xác thực"} />
                <Info label="Mã số thuế" value={meta.taxCode} />
                <Info label="Số tin đang hoạt động" value={`${meta.activeJobs} tin`} />
                <div>
                  <p className="font-medium text-slate-500">Lịch sử vi phạm:</p>
                  <ul className="mt-2 space-y-1 text-slate-700">{meta.violations.length ? meta.violations.map((item) => <li key={item}>• {item}</li>) : <li>Không có vi phạm</li>}</ul>
                </div>
              </div>
            </Card>
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Thao tác</h3>
              <JobActions job={selectedJob} onOpen={openAction} full />
            </Card>
          </aside>
        </div>
        <JobActionModal actionType={actionType} target={actionTarget} selectedCount={selectedIds.length} reason={actionReason} template={actionTemplate} notifyRecruiter={notifyRecruiter} setReason={setActionReason} setTemplate={setActionTemplate} setNotifyRecruiter={setNotifyRecruiter} onClose={() => setActionType(null)} onConfirm={() => void confirmAction()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={mode === "pending" ? "Tin chờ duyệt" : "Quản lý tin tuyển dụng"} description="Danh sách tin tuyển dụng, bộ lọc kiểm duyệt, pending queue, bulk actions và audit log thao tác." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Input label="Search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên tin, công ty, kỹ năng..." />
          <Select label="Công ty" value={company} onChange={(event) => { setCompany(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...companies.map((value) => ({ label: value, value }))]} />
          <Select label="Ngành nghề" value={industry} onChange={(event) => { setIndustry(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...industries.map((value) => ({ label: value, value }))]} />
          <Select label="Trạng thái" value={moderationStatus} onChange={(event) => { setModerationStatus(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...moderationOptions]} />
          <Input label="Ngày gửi" type="date" value={postedDate} onChange={(event) => { setPostedDate(event.target.value); setPage(1); }} />
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox label="Chọn trang này" checked={allPageSelected} onChange={toggleSelectPage} />
          <span className="text-sm text-slate-500">Đã chọn {selectedIds.length} tin</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={selectedIds.length === 0} onClick={() => openAction("bulkApprove")}>Duyệt nhiều tin</Button>
          <Button size="sm" variant="secondary" disabled={selectedIds.length === 0} onClick={() => openAction("bulkHide")}>Ẩn nhiều tin</Button>
        </div>
      </div>

      <Table
        rows={pagedJobs}
        getRowKey={(job) => job.id}
        columns={[
          { key: "select", header: "", render: (job) => <Checkbox aria-label={`Chọn ${job.title}`} label="" checked={selectedIds.includes(job.id)} onChange={() => toggleSelected(job.id)} /> },
          { key: "job", header: "Tin tuyển dụng", render: (job) => <JobSummary job={job} showPending={mode === "pending"} /> },
          { key: "timeline", header: "Thời gian", render: (job) => <JobTimelineSummary job={job} /> },
          { key: "metrics", header: "Ứng viên", render: (job) => <JobMetricSummary job={job} /> },
          { key: "status", header: "Trạng thái", render: (job) => <JobStatusSummary job={job} /> },
          { key: "actions", header: "Thao tác", render: (job) => <JobActions job={job} onOpen={openAction} /> },
        ]}
      />
      <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      <JobActionModal actionType={actionType} target={actionTarget} selectedCount={selectedIds.length} reason={actionReason} template={actionTemplate} notifyRecruiter={notifyRecruiter} setReason={setActionReason} setTemplate={setActionTemplate} setNotifyRecruiter={setNotifyRecruiter} onClose={() => setActionType(null)} onConfirm={() => void confirmAction()} />
    </PageContainer>
  );
}

function JobSummary({ job, showPending }: { job: Job; showPending: boolean }) {
  const verified = isCompanyVerified(job);
  return (
    <div className="min-w-[260px]">
      <p className="font-medium text-slate-900">{job.title}</p>
      <p className="mt-1 text-xs text-slate-500">{job.companyName}</p>
      <p className="mt-1 text-xs text-slate-500">{job.industry} • {job.location} • {job.salary}</p>
      <p className={`mt-1 text-xs ${verified ? "text-emerald-600" : "text-amber-700"}`}>{verified ? "Công ty đã xác thực" : "Công ty chưa xác thực"}</p>
      {showPending ? <p className="mt-1 text-xs text-amber-700">Chờ {getWaitingDays(job)} ngày • Từ chối {getRejectCount(job)} lần</p> : null}
      {showPending ? <p className="mt-1 text-xs text-red-600">{getWarnings(job).join("; ")}</p> : null}
    </div>
  );
}

function JobTimelineSummary({ job }: { job: Job }) {
  return (
    <div className="min-w-[120px] space-y-1 text-xs text-slate-600">
      <p><span className="text-slate-500">Gửi:</span> {formatDate(job.postedAt)}</p>
      <p><span className="text-slate-500">Hạn:</span> {formatDate(job.deadline)}</p>
      {job.status === "pending" ? <p className="text-amber-700">Chờ {getWaitingDays(job)} ngày</p> : null}
    </div>
  );
}

function JobMetricSummary({ job }: { job: Job }) {
  return (
    <div className="min-w-[90px]">
      <p className="text-sm text-slate-700"><strong>{job.applicants}</strong> ứng viên</p>
    </div>
  );
}

function JobStatusSummary({ job }: { job: Job }) {
  return (
    <div className="flex min-w-[140px] flex-wrap gap-2">
      <StatusBadge label={job.status === "published" ? "Đang hoạt động" : moderationJobStatusLabels[job.status]} tone={adminTone(job.status)} />
    </div>
  );
}

function JobActions({ job, onOpen, full = false }: { job: Job; onOpen: (action: JobAction, job: Job) => void; full?: boolean }) {
  return (
    <div className={full ? "grid gap-2" : "grid w-[96px] gap-2"}>
      <Link to={`/admin/jobs/${job.id}${job.status === "pending" ? "/review" : ""}`}><Button className="w-full" size="sm" variant="secondary">Xem</Button></Link>
      {job.status === "pending" && <Button className="w-full" size="sm" onClick={() => onOpen("approve", job)}>Duyệt</Button>}
      {job.status === "pending" && <Button className="w-full" size="sm" variant="danger" onClick={() => onOpen("reject", job)}>Từ chối</Button>}
      {full && job.status !== "closed" && <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("request", job)}>Yêu cầu sửa</Button>}
      {full && <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("note", job)}>Ghi chú</Button>}
      {job.status !== "closed" ? <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("hide", job)}>Ẩn</Button> : <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("restore", job)}>Khôi phục</Button>}
    </div>
  );
}

function JobActionModal({
  actionType,
  target,
  selectedCount,
  reason,
  template,
  notifyRecruiter,
  setReason,
  setTemplate,
  setNotifyRecruiter,
  onClose,
  onConfirm,
}: {
  actionType: JobAction;
  target: Job | null;
  selectedCount: number;
  reason: string;
  template: string;
  notifyRecruiter: boolean;
  setReason: (value: string) => void;
  setTemplate: (value: string) => void;
  setNotifyRecruiter: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = getActionTitle(actionType);
  const needsReason = actionType === "reject" || actionType === "request" || actionType === "hide" || actionType === "bulkHide";
  const needsTemplate = actionType === "reject" || actionType === "request" || actionType === "hide";
  const isInternalNote = actionType === "note";
  return (
    <Modal open={Boolean(actionType)} title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{target ? <strong>{target.title}</strong> : <strong>{selectedCount} tin đã chọn</strong>}</p>
        {needsTemplate ? <Select label="Reason template" value={template} onChange={(event) => setTemplate(event.target.value)} options={[{ label: "Chọn mẫu lý do", value: "" }, ...getReasonTemplates(actionType).map((value) => ({ label: value, value }))]} /> : null}
        {needsReason || isInternalNote ? <Textarea label={isInternalNote ? "Ghi chú nội bộ" : actionType === "request" ? "Nội dung chi tiết" : actionType === "reject" ? "Nội dung chi tiết" : "Nội dung chi tiết"} value={reason} onChange={(event) => setReason(event.target.value)} /> : <p className="text-sm text-slate-600">Xác nhận thực hiện thao tác này và ghi audit log.</p>}
        {target && !isInternalNote ? <Checkbox label="Gửi thông báo cho recruiter" checked={notifyRecruiter} onChange={(event) => setNotifyRecruiter(event.target.checked)} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant={actionType === "reject" || actionType === "hide" || actionType === "bulkHide" ? "danger" : "primary"} onClick={onConfirm}>Xác nhận</Button>
        </div>
      </div>
    </Modal>
  );
}

function WarningBox({ job }: { job: Job }) {
  const warnings = getWarnings(job);
  return (
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-medium">Cảnh báo</p>
      <ul className="mt-2 space-y-1">{warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p className="text-slate-700"><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getWarnings(job: Job) {
  const warnings: string[] = [];
  if (job.salary.includes("thỏa thuận") || job.salary.includes("45")) warnings.push("Mức lương không rõ ràng hoặc cần kiểm chứng");
  if (/(09|03|08)\d{8}/.test(job.description)) warnings.push("Có số điện thoại cá nhân");
  if (/cam kết|đặt cọc|giữ giấy tờ/i.test(job.description)) warnings.push("Có từ khóa nhạy cảm");
  if (!isCompanyVerified(job)) warnings.push("Công ty chưa xác thực");
  if (/nam giới|nữ giới|ngoại hình|độ tuổi/i.test(`${job.description} ${job.requirements.join(" ")}`)) warnings.push("Nội dung có nguy cơ phân biệt đối xử");
  if (job.benefits.length < 3 || job.benefits.some((benefit) => benefit.length < 8)) warnings.push("Quyền lợi không cụ thể");
  return warnings.length ? warnings : ["Không có cảnh báo nghiêm trọng"];
}

function getScreeningQuestions(job: Job) {
  return screeningQuestions[job.id] ?? [
    `Bạn có kinh nghiệm phù hợp với vị trí ${job.title} không?`,
    `Bạn có thể làm việc theo hình thức ${job.workMode} tại ${job.location} không?`,
  ];
}

function getCompanyMeta(job: Job) {
  return companyMeta[job.companyId] ?? { taxCode: "0000000000", activeJobs: 1, violations: [] };
}

function getReasonTemplates(actionType: JobAction) {
  if (actionType === "reject") return ["Nội dung vi phạm chính sách", "Công ty chưa đủ điều kiện đăng tin", "Thông tin tuyển dụng không xác thực"];
  if (actionType === "request") return ["Bổ sung mô tả công việc", "Làm rõ mức lương và quyền lợi", "Bổ sung yêu cầu ứng viên"];
  if (actionType === "hide") return ["Ẩn do có báo cáo vi phạm", "Ẩn để kiểm tra lại nội dung", "Ẩn theo yêu cầu quản trị"];
  return [];
}

function buildActionNote(reason: string, template: string, notifyRecruiter: boolean) {
  const parts = [];
  if (template) parts.push(`Mẫu lý do: ${template}`);
  parts.push(`Nội dung: ${reason}`);
  parts.push(notifyRecruiter ? "Đã gửi thông báo cho recruiter." : "Không gửi thông báo cho recruiter.");
  return parts.join(" ");
}

function isCompanyVerified(job: Job) {
  return companyVerified[job.companyId] ?? true;
}

function getRejectCount(job: Job) {
  return rejectionCounts[job.id] ?? 0;
}

function getWaitingDays(job: Job) {
  const current = new Date("2026-07-12T00:00:00");
  const posted = new Date(`${job.postedAt}T00:00:00`);
  return Math.max(0, Math.ceil((current.getTime() - posted.getTime()) / 86_400_000));
}

function getJobAuditLogs(job: Job, auditLogs: JobAuditItem[]) {
  const currentLogs = auditLogs.filter((item) => item.jobId === job.id);
  if (currentLogs.length) return currentLogs;
  return [
    { id: `${job.id}-audit-1`, jobId: job.id, admin: "Hệ thống", action: "Nhận tin tuyển dụng", at: job.postedAt, note: "Tin được gửi lên hệ thống." },
    { id: `${job.id}-audit-2`, jobId: job.id, admin: "Admin hệ thống", action: "Mở kiểm duyệt", at: "2026-07-10T09:30:00", note: "Admin kiểm tra nội dung, công ty và cảnh báo rủi ro." },
  ];
}

function getActionTitle(actionType: JobAction) {
  if (actionType === "approve" || actionType === "bulkApprove") return "Duyệt tin tuyển dụng";
  if (actionType === "reject") return "Từ chối tin tuyển dụng";
  if (actionType === "request") return "Yêu cầu chỉnh sửa";
  if (actionType === "hide" || actionType === "bulkHide") return "Ẩn tin tuyển dụng";
  if (actionType === "restore") return "Khôi phục tin tuyển dụng";
  if (actionType === "note") return "Thêm ghi chú nội bộ";
  return "Thao tác tin tuyển dụng";
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
