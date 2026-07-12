import { useMemo, useState } from "react";
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
import { useToast } from "../../hooks/useToast";
import { candidates, cvs, jobs } from "../../mocks";
import type { Candidate, Cv, CvStatus, Job } from "../../types/domain";

type AdminCvStatus = CvStatus | "retrying" | "resolved";
type ErrorType = "Unsupported layout" | "Corrupted file" | "Timeout" | "Missing text layer" | "Skill parsing error" | "Unknown encoding";
type ErrorStatus = "open" | "retrying" | "resolved" | "failed";
type WeightKey = "skill" | "experience" | "education" | "location" | "salary" | "jobType" | "workMode" | "behavior";
type RecommendationWeights = Record<WeightKey, number>;

interface CvAnalysisRow extends Omit<Cv, "status"> {
  status: AdminCvStatus;
  candidateName: string;
  fileType: string;
  processingTime: number;
  errorType?: ErrorType;
  errorMessage?: string;
  retryCount: number;
  errorStatus?: ErrorStatus;
}

interface AuditItem {
  id: string;
  label: string;
  at: string;
  note: string;
}

interface VersionItem {
  id: string;
  version: string;
  updatedBy: string;
  updatedAt: string;
  notes: string;
  weights: RecommendationWeights;
}

const errorTypes: ErrorType[] = ["Unsupported layout", "Corrupted file", "Timeout", "Missing text layer", "Skill parsing error", "Unknown encoding"];
const defaultWeights: RecommendationWeights = { skill: 30, experience: 15, education: 10, location: 10, salary: 10, jobType: 10, workMode: 10, behavior: 5 };
const weightDescriptions: Record<WeightKey, { label: string; description: string }> = {
  skill: { label: "Kỹ năng", description: "Mức độ trùng khớp kỹ năng CV với kỹ năng trong tin tuyển dụng." },
  experience: { label: "Kinh nghiệm", description: "Số năm kinh nghiệm và cấp độ hiện tại của ứng viên." },
  education: { label: "Học vấn", description: "Độ phù hợp về ngành học, trường học và bằng cấp." },
  location: { label: "Địa điểm", description: "Mức độ phù hợp giữa nơi làm việc và mong muốn địa điểm." },
  salary: { label: "Mức lương", description: "So khớp kỳ vọng lương với khoảng lương tuyển dụng." },
  jobType: { label: "Loại hình làm việc", description: "Toàn thời gian, thực tập, bán thời gian hoặc hợp đồng." },
  workMode: { label: "Hình thức làm việc", description: "Onsite, hybrid hoặc remote." },
  behavior: { label: "Hành vi người dùng", description: "Tín hiệu lưu việc, xem chi tiết, ứng tuyển và phản hồi." },
};

export function AdminCvRecommendationPage({ mode = "cv" }: { mode?: "cv" | "errors" | "recommendation" | "configuration" }) {
  const { showToast } = useToast();
  const [weights, setWeights] = useState<RecommendationWeights>(defaultWeights);
  const [selectedCandidateId, setSelectedCandidateId] = useState(candidates[0]?.id ?? "");
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? "");
  const [versionNote, setVersionNote] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<VersionItem | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([
    { id: "v-3", version: "v1.3", updatedBy: "Admin hệ thống", updatedAt: "2026-07-11T10:00:00", notes: "Tăng trọng số kỹ năng cho nhóm IT.", weights: defaultWeights },
    { id: "v-2", version: "v1.2", updatedBy: "Admin hệ thống", updatedAt: "2026-07-08T14:30:00", notes: "Cân bằng thêm địa điểm và hình thức làm việc.", weights: { skill: 28, experience: 17, education: 10, location: 12, salary: 10, jobType: 8, workMode: 10, behavior: 5 } },
  ]);
  const [rows, setRows] = useState<CvAnalysisRow[]>(() => cvs.map(enrichCv));
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [fileType, setFileType] = useState("");
  const [errorType, setErrorType] = useState("");
  const [detailTarget, setDetailTarget] = useState<CvAnalysisRow | null>(null);
  const [noteTarget, setNoteTarget] = useState<CvAnalysisRow | null>(null);
  const [note, setNote] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? candidates[0];
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const previewRows = selectedCandidate && selectedJob ? buildPreviewRows(selectedCandidate, selectedJob, weights) : [];
  const matchScore = Math.round(previewRows.reduce((sum, row) => sum + row.weightedScore, 0));

  const filteredRows = useMemo(() => rows.filter((cv) => {
    const searchable = `${cv.id} ${cv.fileName} ${cv.candidateName} ${cv.errorType ?? ""}`.toLowerCase();
    const matchQuery = !query || searchable.includes(query.toLowerCase());
    const matchStatus = !status || cv.status === status || cv.errorStatus === status;
    const matchFileType = !fileType || cv.fileType === fileType;
    const matchErrorType = !errorType || cv.errorType === errorType;
    return matchQuery && matchStatus && matchFileType && matchErrorType;
  }), [errorType, fileType, query, rows, status]);

  const errorRows = useMemo(() => filteredRows.filter((cv) => cv.status === "failed" || cv.errorType), [filteredRows]);

  async function retryCv(cv: CvAnalysisRow) {
    setRows((current) => current.map((item) => item.id === cv.id ? { ...item, status: "retrying", errorStatus: "retrying", retryCount: item.retryCount + 1 } : item));
    addAudit("Retry CV", `${cv.fileName} chuyển sang retrying.`);
    showToast({ type: "success", title: "Đã bắt đầu retry mock" });
    window.setTimeout(() => {
      setRows((current) => current.map((item) => item.id === cv.id ? finishRetry(item) : item));
      addAudit("Hoàn tất retry CV", `${cv.fileName} đã cập nhật kết quả retry.`);
    }, 800);
  }

  function markResolved(cv: CvAnalysisRow) {
    setRows((current) => current.map((item) => item.id === cv.id ? { ...item, errorStatus: "resolved", status: item.status === "failed" ? "resolved" : item.status } : item));
    addAudit("Mark resolved", `${cv.fileName} được đánh dấu đã xử lý.`);
    showToast({ type: "success", title: "Đã đánh dấu resolved" });
  }

  function saveNote() {
    if (!noteTarget || !note.trim()) {
      showToast({ type: "error", title: "Vui lòng nhập note" });
      return;
    }
    addAudit("Thêm note", `${noteTarget.fileName}: ${note}`);
    setNoteTarget(null);
    setNote("");
    showToast({ type: "success", title: "Đã thêm note" });
  }

  function addAudit(label: string, noteText: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}`, label, note: noteText, at: new Date().toISOString() }, ...current]);
  }

  if (mode === "configuration") {
    function updateWeight(key: WeightKey, value: number) {
      const nextValue = Math.max(0, Math.min(100, value));
      setWeights((current) => ({ ...current, [key]: nextValue }));
    }

    function saveConfiguration() {
      if (total !== 100) {
        showToast({ type: "error", title: "Tổng trọng số phải bằng 100%" });
        return;
      }
      const version: VersionItem = {
        id: `v-${Date.now()}`,
        version: `v1.${versions.length + 2}`,
        updatedBy: "Admin hệ thống",
        updatedAt: new Date().toISOString(),
        notes: versionNote || "Cập nhật cấu hình trọng số.",
        weights,
      };
      setVersions((current) => [version, ...current]);
      addAudit("Lưu cấu hình gợi ý", version.notes);
      setVersionNote("");
      showToast({ type: "success", title: "Đã lưu cấu hình gợi ý" });
    }

    function restoreVersion(version: VersionItem) {
      setWeights(version.weights);
      addAudit("Khôi phục cấu hình", `Khôi phục ${version.version}: ${version.notes}`);
      setRestoreTarget(null);
      showToast({ type: "success", title: "Đã khôi phục phiên bản" });
    }

    return (
      <PageContainer>
        <PageHeader title="Cấu hình thuật toán gợi ý" description="Cấu hình trọng số frontend mock, preview match score và quản lý lịch sử phiên bản." />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`Tổng hiện tại: ${total}%`} tone={total === 100 ? "success" : total < 100 ? "warning" : "danger"} />
            {total < 100 ? <StatusBadge label={`Thiếu ${100 - total}%`} tone="warning" /> : null}
            {total > 100 ? <StatusBadge label={`Vượt ${total - 100}%`} tone="danger" /> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={total !== 100} onClick={saveConfiguration}>Lưu cấu hình</Button>
            <Button variant="secondary" onClick={() => { setWeights(defaultWeights); addAudit("Reset mặc định", "Khôi phục trọng số mặc định."); }}>Reset mặc định</Button>
            <Button variant="secondary" onClick={() => setRestoreTarget(versions[0] ?? null)}>Tải phiên bản trước</Button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Trọng số</h3>
              <div className="mt-4 space-y-4">
                {(Object.keys(weightDescriptions) as WeightKey[]).map((key) => (
                  <WeightControl key={key} name={key} value={weights[key]} onChange={(value) => updateWeight(key, value)} />
                ))}
              </div>
              <Textarea className="mt-5" label="Thêm ghi chú phiên bản" value={versionNote} onChange={(event) => setVersionNote(event.target.value)} placeholder="Mô tả lý do điều chỉnh trọng số..." />
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Version history</h3>
              <Table
                rows={versions}
                getRowKey={(version) => version.id}
                columns={[
                  { key: "version", header: "Version", render: (version) => version.version },
                  { key: "by", header: "Updated by", render: (version) => version.updatedBy },
                  { key: "date", header: "Updated date", render: (version) => formatDate(version.updatedAt) },
                  { key: "notes", header: "Notes", render: (version) => <span className="text-sm text-slate-600">{version.notes}</span> },
                  { key: "actions", header: "Thao tác", render: (version) => <div className="grid w-[96px] gap-2"><Button size="sm" variant="secondary" onClick={() => setRestoreTarget(version)}>Xem</Button><Button size="sm" onClick={() => setRestoreTarget(version)}>Khôi phục</Button></div> },
                ]}
              />
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Preview</h3>
              <div className="mt-4 space-y-4">
                <Select label="Candidate mock" value={selectedCandidateId} onChange={(event) => setSelectedCandidateId(event.target.value)} options={candidates.map((candidate) => ({ label: candidate.name, value: candidate.id }))} />
                <Select label="Job mock" value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} options={jobs.map((job) => ({ label: `${job.title} - ${job.companyName}`, value: job.id }))} />
              </div>
              <div className="mt-5 rounded-md border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Tổng match score</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{matchScore}%</p>
                <p className="mt-2 text-sm text-slate-600">{buildPreviewExplanation(selectedCandidate, selectedJob, matchScore)}</p>
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Điểm theo tiêu chí</h3>
              <div className="mt-4 space-y-3">
                {previewRows.map((row) => (
                  <div key={row.key} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{weightDescriptions[row.key].label}</p>
                        <p className="mt-1 text-xs text-slate-500">Điểm gốc {row.rawScore}% • Trọng số {row.weight}%</p>
                      </div>
                      <strong className="text-sm text-slate-950">{Math.round(row.weightedScore)}%</strong>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, row.weightedScore)}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Audit log</h3>
              <div className="mt-4">
                <Timeline items={(auditLogs.length ? auditLogs : [{ id: "config-init", label: "Khởi tạo cấu hình", at: "2026-07-12T08:00:00", note: "Cấu hình mock sẵn sàng chỉnh sửa." }]).map((item) => ({ label: item.label, at: item.at, note: item.note }))} />
              </div>
            </Card>
          </aside>
        </div>

        <RestoreVersionModal version={restoreTarget} onClose={() => setRestoreTarget(null)} onConfirm={() => restoreTarget && restoreVersion(restoreTarget)} />
      </PageContainer>
    );
  }

  if (mode === "recommendation") {
    return (
      <PageContainer>
        <PageHeader title="Hệ thống gợi ý" description="Theo dõi tổng lượt gợi ý, tỷ lệ nhấn xem, tỷ lệ ứng tuyển và phản hồi phù hợp." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tổng lượt gợi ý" value="12.840" />
          <Metric label="Tỷ lệ nhấn xem" value="38%" />
          <Metric label="Tỷ lệ ứng tuyển" value="14%" />
          <Metric label="Phản hồi phù hợp" value="82%" />
        </div>
      </PageContainer>
    );
  }

  const stats = buildStats(filteredRows);
  const tableRows = mode === "errors" ? errorRows : filteredRows;

  return (
    <PageContainer>
      <PageHeader title={mode === "errors" ? "Lỗi phân tích CV" : "Theo dõi phân tích CV"} description="Dashboard theo dõi upload, kết quả phân tích, lỗi xử lý CV và thao tác retry mock." />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Tổng CV" value={String(stats.total)} />
        <Metric label="Thành công" value={String(stats.success)} />
        <Metric label="Thất bại" value={String(stats.failed)} />
        <Metric label="Đang xử lý" value={String(stats.processing)} />
        <Metric label="Tỷ lệ thành công" value={`${stats.successRate}%`} />
        <Metric label="Xử lý TB" value={`${stats.avgTime}s`} />
      </div>

      <Card className="mt-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="CV ID, candidate, lỗi..." />
          <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Thành công", value: "analyzed" }, { label: "Thất bại", value: "failed" }, { label: "Đang xử lý", value: "analyzing" }, { label: "Retrying", value: "retrying" }, { label: "Resolved", value: "resolved" }]} />
          <Select label="Định dạng file" value={fileType} onChange={(event) => setFileType(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...unique(rows.map((cv) => cv.fileType)).map((value) => ({ label: value, value }))]} />
          <Select label="Loại lỗi" value={errorType} onChange={(event) => setErrorType(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...errorTypes.map((value) => ({ label: value, value }))]} />
        </div>
      </Card>

      {mode !== "errors" ? <DashboardCharts rows={filteredRows} /> : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <Table
          rows={tableRows}
          getRowKey={(cv) => cv.id}
          columns={mode === "errors" ? [
            { key: "error", header: "Error ID", render: (cv) => `ERR-${cv.id.toUpperCase()}` },
            { key: "cv", header: "CV", render: (cv) => <CvSummary cv={cv} /> },
            { key: "candidate", header: "Candidate", render: (cv) => cv.candidateName },
            { key: "type", header: "Loại lỗi", render: (cv) => cv.errorType ?? "Không có" },
            { key: "message", header: "Message", render: (cv) => <span className="text-sm text-slate-600">{cv.errorMessage ?? "Không có lỗi"}</span> },
            { key: "date", header: "Ngày xảy ra", render: (cv) => formatDate(cv.uploadedAt) },
            { key: "retry", header: "Retry", render: (cv) => cv.retryCount },
            { key: "status", header: "Trạng thái", render: (cv) => <StatusBadge label={cv.errorStatus ?? cv.status} tone={cv.errorStatus === "resolved" ? "success" : cv.status === "failed" ? "danger" : "warning"} /> },
            { key: "actions", header: "Thao tác", render: (cv) => <CvErrorActions cv={cv} onDetail={setDetailTarget} onRetry={retryCv} onResolved={markResolved} onNote={setNoteTarget} /> },
          ] : [
            { key: "cv", header: "CV ID", render: (cv) => <CvSummary cv={cv} /> },
            { key: "candidate", header: "Candidate", render: (cv) => cv.candidateName },
            { key: "type", header: "File type", render: (cv) => cv.fileType },
            { key: "uploaded", header: "Ngày upload", render: (cv) => formatDate(cv.uploadedAt) },
            { key: "status", header: "Trạng thái", render: (cv) => <CvStatusBadge status={cv.status} /> },
            { key: "time", header: "Thời gian xử lý", render: (cv) => `${cv.processingTime}s` },
            { key: "error", header: "Lỗi", render: (cv) => cv.errorType ?? "Không có" },
          ]}
        />
        <Card>
          <h3 className="text-base font-semibold text-slate-950">Audit log</h3>
          <div className="mt-4">
            <Timeline items={(auditLogs.length ? auditLogs : [{ id: "init", label: "Khởi tạo dashboard", at: "2026-07-12T08:00:00", note: "Hệ thống sẵn sàng theo dõi phân tích CV." }]).map((item) => ({ label: item.label, at: item.at, note: item.note }))} />
          </div>
        </Card>
      </div>

      <ErrorDetailModal cv={detailTarget} onClose={() => setDetailTarget(null)} />
      <NoteModal cv={noteTarget} note={note} setNote={setNote} onClose={() => setNoteTarget(null)} onSave={saveNote} />
    </PageContainer>
  );
}

function DashboardCharts({ rows }: { rows: CvAnalysisRow[] }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <ChartCard title="CV upload theo ngày" data={countBy(rows, (cv) => cv.uploadedAt)} />
      <ChartCard title="Thành công và thất bại" data={countBy(rows, (cv) => cv.status === "analyzed" || cv.status === "resolved" ? "Thành công" : cv.status === "failed" ? "Thất bại" : "Đang xử lý")} />
      <ChartCard title="Loại lỗi" data={countBy(rows.filter((cv) => cv.errorType), (cv) => cv.errorType ?? "Không có")} />
      <ChartCard title="Định dạng file" data={countBy(rows, (cv) => cv.fileType)} />
      <ChartCard title="Thời gian xử lý" data={countBy(rows, (cv) => cv.processingTime <= 15 ? "0-15s" : cv.processingTime <= 30 ? "16-30s" : "30s+")} />
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-sm"><span className="text-slate-600">{item.label}</span><strong>{item.value}</strong></div>
            <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${(item.value / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CvSummary({ cv }: { cv: CvAnalysisRow }) {
  return (
    <div className="min-w-[180px]">
      <p className="font-medium text-slate-900">{cv.id}</p>
      <p className="mt-1 text-xs text-slate-500">{cv.fileName}</p>
    </div>
  );
}

function CvStatusBadge({ status }: { status: AdminCvStatus }) {
  const tone = status === "analyzed" || status === "resolved" ? "success" : status === "failed" ? "danger" : "warning";
  const labels: Record<string, string> = { analyzed: "Thành công", failed: "Thất bại", analyzing: "Đang xử lý", retrying: "Retrying", resolved: "Resolved", uploaded: "Đã upload", needs_confirmation: "Cần xác nhận" };
  return <StatusBadge label={labels[status] ?? status} tone={tone} />;
}

function CvErrorActions({ cv, onDetail, onRetry, onResolved, onNote }: { cv: CvAnalysisRow; onDetail: (cv: CvAnalysisRow) => void; onRetry: (cv: CvAnalysisRow) => void; onResolved: (cv: CvAnalysisRow) => void; onNote: (cv: CvAnalysisRow) => void }) {
  return (
    <div className="grid w-[104px] gap-2">
      <Button size="sm" variant="secondary" onClick={() => onDetail(cv)}>Chi tiết</Button>
      <Button size="sm" onClick={() => onRetry(cv)}>Retry</Button>
      <Button size="sm" variant="secondary" onClick={() => onResolved(cv)}>Resolved</Button>
      <Button size="sm" variant="secondary" onClick={() => onNote(cv)}>Note</Button>
    </div>
  );
}

function ErrorDetailModal({ cv, onClose }: { cv: CvAnalysisRow | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(cv)} title="Chi tiết lỗi phân tích CV" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-700">
        <p><strong>CV:</strong> {cv?.fileName}</p>
        <p><strong>Candidate:</strong> {cv?.candidateName}</p>
        <p><strong>Loại lỗi:</strong> {cv?.errorType}</p>
        <p><strong>Message:</strong> {cv?.errorMessage}</p>
        <p><strong>Retry count:</strong> {cv?.retryCount}</p>
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Đóng</Button></div>
      </div>
    </Modal>
  );
}

function NoteModal({ cv, note, setNote, onClose, onSave }: { cv: CvAnalysisRow | null; note: string; setNote: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal open={Boolean(cv)} title="Thêm note lỗi CV" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700"><strong>{cv?.fileName}</strong></p>
        <Textarea label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Hủy</Button><Button onClick={onSave}>Lưu</Button></div>
      </div>
    </Modal>
  );
}

function WeightControl({ name, value, onChange }: { name: WeightKey; value: number; onChange: (value: number) => void }) {
  const meta = weightDescriptions[name];
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{meta.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{meta.description}</p>
        </div>
        <Input className="w-24" label="%" type="number" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      </div>
      <input className="mt-3 w-full accent-brand-600" type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function RestoreVersionModal({ version, onClose, onConfirm }: { version: VersionItem | null; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={Boolean(version)} title="Khôi phục phiên bản cấu hình" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Bạn có chắc muốn khôi phục <strong>{version?.version}</strong> không?</p>
        <p className="text-sm text-slate-600">{version?.notes}</p>
        {version ? (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {(Object.keys(version.weights) as WeightKey[]).map((key) => (
              <p key={key}><span className="text-slate-500">{weightDescriptions[key].label}:</span> <strong>{version.weights[key]}%</strong></p>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={onConfirm}>Khôi phục</Button>
        </div>
      </div>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></Card>;
}

function enrichCv(cv: Cv): CvAnalysisRow {
  const fileType = cv.fileName.split(".").pop()?.toUpperCase() ?? "PDF";
  const errorType = cv.status === "failed" ? getErrorType(cv.id) : undefined;
  return {
    ...cv,
    candidateName: candidates.find((candidate) => candidate.id === cv.candidateId)?.name ?? cv.candidateId,
    fileType,
    processingTime: cv.status === "analyzing" ? 42 : cv.status === "failed" ? 55 : 12 + cv.score % 18,
    errorType,
    errorMessage: errorType ? getErrorMessage(errorType) : undefined,
    retryCount: cv.status === "failed" ? 1 : 0,
    errorStatus: cv.status === "failed" ? "open" : undefined,
  };
}

function finishRetry(cv: CvAnalysisRow): CvAnalysisRow {
  const completed = cv.retryCount % 2 === 1;
  return completed ? { ...cv, status: "analyzed", errorStatus: "resolved", errorType: undefined, errorMessage: undefined, processingTime: 24, score: Math.max(cv.score, 72) } : { ...cv, status: "failed", errorStatus: "failed", processingTime: 58 };
}

function getErrorType(id: string): ErrorType {
  const index = Math.abs(id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % errorTypes.length;
  return errorTypes[index];
}

function getErrorMessage(type: ErrorType) {
  const messages: Record<ErrorType, string> = {
    "Unsupported layout": "Layout nhiều cột không thể trích xuất ổn định.",
    "Corrupted file": "File bị lỗi hoặc không mở được.",
    Timeout: "Quá thời gian xử lý OCR.",
    "Missing text layer": "PDF không có lớp text để đọc.",
    "Skill parsing error": "Không parse được danh sách kỹ năng.",
    "Unknown encoding": "Encoding không xác định trong file.",
  };
  return messages[type];
}

function buildStats(rows: CvAnalysisRow[]) {
  const total = rows.length;
  const success = rows.filter((cv) => cv.status === "analyzed" || cv.status === "resolved").length;
  const failed = rows.filter((cv) => cv.status === "failed").length;
  const processing = rows.filter((cv) => cv.status === "analyzing" || cv.status === "retrying").length;
  const avgTime = total ? Math.round(rows.reduce((sum, cv) => sum + cv.processingTime, 0) / total) : 0;
  return { total, success, failed, processing, successRate: total ? Math.round((success / total) * 100) : 0, avgTime };
}

function countBy(rows: CvAnalysisRow[], getKey: (cv: CvAnalysisRow) => string) {
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(getKey(row), (map.get(getKey(row)) ?? 0) + 1));
  return Array.from(map, ([label, value]) => ({ label, value }));
}

function buildPreviewRows(candidate: Candidate | undefined, job: Job | undefined, weights: RecommendationWeights) {
  if (!candidate || !job) return [];
  const sharedSkills = candidate.skills.filter((skill) => job.skills.some((jobSkill) => jobSkill.toLowerCase() === skill.toLowerCase())).length;
  const skillScore = Math.round((sharedSkills / Math.max(1, job.skills.length)) * 100);
  const experienceScore = Math.min(100, Math.round((candidate.experienceYears / Math.max(1, parseExperience(job.experience))) * 100));
  const educationScore = candidate.education ? 80 : 40;
  const locationScore = candidate.location === job.location || candidate.location === "Remote" || job.location === "Remote" ? 100 : 55;
  const salaryScore = salaryOverlap(candidate.desiredSalary, job.salary);
  const jobTypeScore = candidate.desiredPosition.toLowerCase().includes(job.title.toLowerCase().split(" ")[0] ?? "") ? 85 : 60;
  const workModeScore = job.workMode === "Remote" || candidate.location === job.location ? 90 : job.workMode === "Hybrid" ? 75 : 55;
  const behaviorScore = Math.min(95, candidate.profileCompletion + (job.matchScore ? Math.round(job.matchScore / 10) : 0));
  const rawScores: Record<WeightKey, number> = {
    skill: skillScore,
    experience: experienceScore,
    education: educationScore,
    location: locationScore,
    salary: salaryScore,
    jobType: jobTypeScore,
    workMode: workModeScore,
    behavior: behaviorScore,
  };
  return (Object.keys(weights) as WeightKey[]).map((key) => ({
    key,
    rawScore: rawScores[key],
    weight: weights[key],
    weightedScore: rawScores[key] * weights[key] / 100,
  }));
}

function buildPreviewExplanation(candidate: Candidate | undefined, job: Job | undefined, score: number) {
  if (!candidate || !job) return "Chọn candidate và job để xem giải thích.";
  const sharedSkills = candidate.skills.filter((skill) => job.skills.includes(skill));
  const skillText = sharedSkills.length ? `khớp kỹ năng ${sharedSkills.join(", ")}` : "chưa khớp kỹ năng chính";
  const locationText = candidate.location === job.location ? "địa điểm phù hợp" : "địa điểm cần cân nhắc";
  return `${candidate.name} so với ${job.title}: ${skillText}, ${locationText}. Tổng điểm hiện tại là ${score}%.`;
}

function parseExperience(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function salaryOverlap(candidateSalary: string, jobSalary: string) {
  const candidateNumbers = candidateSalary.match(/\d+/g)?.map(Number) ?? [];
  const jobNumbers = jobSalary.match(/\d+/g)?.map(Number) ?? [];
  if (!candidateNumbers.length || !jobNumbers.length) return 60;
  const candidateMin = candidateNumbers[0];
  const candidateMax = candidateNumbers[1] ?? candidateMin;
  const jobMin = jobNumbers[0];
  const jobMax = jobNumbers[1] ?? jobMin;
  const overlap = Math.max(0, Math.min(candidateMax, jobMax) - Math.max(candidateMin, jobMin));
  const range = Math.max(1, Math.max(candidateMax, jobMax) - Math.min(candidateMin, jobMin));
  return Math.max(40, Math.round((overlap / range) * 100));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
