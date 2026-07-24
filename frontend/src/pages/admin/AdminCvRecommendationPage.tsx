import { useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";

type CvStatus = "UPLOADED" | "PROCESSING" | "PROCESSED" | "FAILED";
type RecommendationRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

interface CvFileRow {
  id: number;
  studentId: number;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  isActive: boolean;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface RecommendationRunRow {
  id: number;
  studentId: number;
  cvFileId: number | null;
  sourceType: string;
  status: RecommendationRunStatus;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const cvStatusLabels: Record<CvStatus, string> = {
  UPLOADED: "Đã upload",
  PROCESSING: "Đang xử lý",
  PROCESSED: "Đã xử lý",
  FAILED: "Lỗi",
};

const runStatusLabels: Record<RecommendationRunStatus, string> = {
  PENDING: "Chờ chạy",
  RUNNING: "Đang chạy",
  COMPLETED: "Hoàn tất",
  FAILED: "Lỗi",
};

export function AdminCvRecommendationPage({ mode = "cv" }: { mode?: "cv" | "errors" | "recommendation" | "configuration" }) {
  if (mode === "configuration") return <RecommendationConfigurationPage />;
  if (mode === "recommendation") return <RecommendationSystemPage />;
  return <CvAnalysisPage mode={mode} />;
}

function CvAnalysisPage({ mode }: { mode: "cv" | "errors" }) {
  const [filters, setFilters] = useState({
    studentId: "",
    fileName: "",
    contentType: "",
    isActive: "",
    status: "",
    uploadedAt: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "errors" ? "Lỗi phân tích CV" : "Theo dõi phân tích CV"}
        description="Backend hiện chưa có API admin CV. Trang giữ khung theo bảng cv_files và hiển thị 0."
      />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Tổng CV" value={0} />
        <Metric label="CV active" value={0} />
        <Metric label="Đã xử lý" value={0} />
        <Metric label="Lỗi" value={0} />
        <Metric label="Recommendation runs" value={0} />
        <Metric label="Recommendation results" value={0} />
      </div>

      <Card className="mt-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Student ID" value={filters.studentId} onChange={(event) => updateFilter("studentId", event.target.value)} placeholder="student_id" disabled />
          <Input label="File name" value={filters.fileName} onChange={(event) => updateFilter("fileName", event.target.value)} placeholder="file_name" disabled />
          <Input label="Content type" value={filters.contentType} onChange={(event) => updateFilter("contentType", event.target.value)} placeholder="content_type" disabled />
          <Select label="Active" value={filters.isActive} onChange={(event) => updateFilter("isActive", event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Active", value: "true" }, { label: "Inactive", value: "false" }]} disabled />
          <Select label="Status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(cvStatusLabels).map(([value, label]) => ({ value, label }))]} disabled />
          <Input label="Uploaded at" type="date" value={filters.uploadedAt} onChange={(event) => updateFilter("uploadedAt", event.target.value)} disabled />
        </div>
      </Card>

      <Card className="mt-5">
        <p className="text-sm font-medium text-slate-900">Tổng dữ liệu: 0</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Backend chỉ có API CV theo student hiện tại, chưa có API admin list CV hoặc lỗi phân tích CV.</p>
      </Card>

      <div className="mt-5">
        <Table
          rows={[] as CvFileRow[]}
          getRowKey={(cv) => String(cv.id)}
          columns={[
            { key: "file", header: "CV", render: (cv) => <CvFileCell cv={cv} /> },
            { key: "student", header: "Student", render: (cv) => `Student #${cv.studentId}` },
            { key: "type", header: "Content type", render: (cv) => cv.contentType ?? "Chưa cập nhật" },
            { key: "size", header: "File size", render: (cv) => formatFileSize(cv.fileSize) },
            { key: "active", header: "Active", render: (cv) => <StatusBadge label={cv.isActive ? "Active" : "Inactive"} tone={cv.isActive ? "success" : "neutral"} /> },
            { key: "uploaded", header: "Uploaded", render: (cv) => formatDateTime(cv.uploadedAt) },
          ]}
        />
        <div className="mt-4">
          <EmptyState message="Chưa có API admin CV nên bảng đang hiển thị 0 dòng, không dùng dữ liệu mock." />
        </div>
      </div>

      <DbFieldsSection />
    </PageContainer>
  );
}

function RecommendationSystemPage() {
  const [filters, setFilters] = useState({
    studentId: "",
    cvFileId: "",
    sourceType: "",
    status: "",
    startedAt: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PageContainer>
      <PageHeader title="Hệ thống gợi ý" description="Backend có bảng recommendation skeleton nhưng chưa có API admin recommendation." />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Recommendation runs" value={0} />
        <Metric label="Completed" value={0} />
        <Metric label="Failed" value={0} />
        <Metric label="Results" value={0} />
      </div>

      <Card className="mt-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Input label="Student ID" value={filters.studentId} onChange={(event) => updateFilter("studentId", event.target.value)} disabled />
          <Input label="CV File ID" value={filters.cvFileId} onChange={(event) => updateFilter("cvFileId", event.target.value)} disabled />
          <Input label="Source type" value={filters.sourceType} onChange={(event) => updateFilter("sourceType", event.target.value)} disabled />
          <Select label="Status" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(runStatusLabels).map(([value, label]) => ({ value, label }))]} disabled />
          <Input label="Started at" type="date" value={filters.startedAt} onChange={(event) => updateFilter("startedAt", event.target.value)} disabled />
        </div>
      </Card>

      <div className="mt-5">
        <Table
          rows={[] as RecommendationRunRow[]}
          getRowKey={(run) => String(run.id)}
          columns={[
            { key: "id", header: "Run ID", render: (run) => run.id },
            { key: "student", header: "Student", render: (run) => `Student #${run.studentId}` },
            { key: "cv", header: "CV", render: (run) => run.cvFileId ? `CV #${run.cvFileId}` : "Không có" },
            { key: "source", header: "Source", render: (run) => run.sourceType },
            { key: "status", header: "Status", render: (run) => <StatusBadge label={runStatusLabels[run.status]} tone={getRunTone(run.status)} /> },
            { key: "started", header: "Started", render: (run) => formatDateTime(run.startedAt) },
          ]}
        />
        <div className="mt-4">
          <EmptyState message="Chưa có API admin recommendation nên bảng đang hiển thị 0 dòng." />
        </div>
      </div>

      <DbFieldsSection />
    </PageContainer>
  );
}

function RecommendationConfigurationPage() {
  return (
    <PageContainer>
      <PageHeader title="Cấu hình gợi ý" description="Phần cấu hình thuật toán chưa có DB/API admin. Thuật toán gợi ý theo CV sẽ làm sau." />
      <Card>
        <EmptyState message="Backend hiện chưa có bảng/API lưu cấu hình trọng số thuật toán. Trang không dùng cấu hình mock." />
        <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <Info label="Cấu hình trọng số" value="Chưa có API" />
          <Info label="Preview match score" value="Chưa có API" />
          <Info label="Version history" value="Chưa có API" />
          <Info label="Dữ liệu hiện hiển thị" value="0" />
        </div>
      </Card>
      <DbFieldsSection />
    </PageContainer>
  );
}

function DbFieldsSection() {
  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-3">
      <FieldCard title="cv_files" fields={["id", "student_id", "file_name", "file_url", "content_type", "file_size", "extracted_text", "original_file_name", "stored_file_name", "file_path", "processed_text", "is_active", "uploaded_at", "created_at", "updated_at"]} />
      <FieldCard title="recommendation_runs" fields={["id", "student_id", "cv_file_id", "source_type", "status", "started_at", "finished_at", "error_message", "created_at", "updated_at"]} />
      <FieldCard title="recommendation_results" fields={["id", "run_id", "job_id", "score", "matched_keywords", "rank_position", "created_at", "updated_at"]} />
    </div>
  );
}

function FieldCard({ title, fields }: { title: string; fields: string[] }) {
  return (
    <Card>
      <SectionHeader title={title} />
      <div className="flex flex-wrap gap-2">
        {fields.map((field) => <StatusBadge key={field} label={field} />)}
      </div>
    </Card>
  );
}

function CvFileCell({ cv }: { cv: CvFileRow }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{cv.fileName}</p>
      <p className="mt-1 text-xs text-slate-500">ID: {cv.id}</p>
      <p className="mt-1 text-xs text-slate-500">{cv.fileUrl}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{new Intl.NumberFormat("vi-VN").format(value)}</p></Card>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getRunTone(status: RecommendationRunStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "PENDING" || status === "RUNNING") return "warning" as const;
  if (status === "FAILED") return "danger" as const;
  return "neutral" as const;
}

function formatFileSize(value?: number | null) {
  if (!value) return "Chưa cập nhật";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
