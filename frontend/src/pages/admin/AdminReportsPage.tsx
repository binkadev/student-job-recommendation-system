import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";

type ReportStatus = "NEW" | "PROCESSING" | "RESOLVED" | "REJECTED";

interface AdminReportRow {
  id: number;
  type: string;
  status: ReportStatus;
  targetType: string;
  targetId: number;
  reporterUserId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<ReportStatus, string> = {
  NEW: "Mới",
  PROCESSING: "Đang xử lý",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Từ chối",
};

export function AdminReportsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { reportId } = useParams();
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    targetType: "",
    targetId: "",
    createdAt: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  if (mode === "detail") {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết báo cáo vi phạm" description="Backend chưa có API detail cho báo cáo vi phạm." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <SectionHeader title="Chưa có API detail" />
            <EmptyState message="Hiện backend chưa có bảng reports và chưa có GET /api/admin/reports/{id}. Khi có API, trang này sẽ hiển thị nội dung báo cáo, đối tượng liên quan và lịch sử xử lý." />
            <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <Info label="Report ID từ URL" value={reportId ?? "Không có"} />
              <Info label="Dữ liệu hiện hiển thị" value="0" />
              <Info label="Action xử lý" value="Chưa có API" />
              <Info label="Audit/timeline" value="Chưa có API" />
            </div>
          </Card>
          <ReportFieldsCard />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Báo cáo vi phạm" description="Trang giữ khung quản trị báo cáo. Backend hiện chưa có DB/API reports nên không hiển thị dữ liệu mock." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Loại báo cáo" value={filters.type} onChange={(event) => updateFilter("type", event.target.value)} placeholder="type" disabled />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} disabled />
          <Input label="Target type" value={filters.targetType} onChange={(event) => updateFilter("targetType", event.target.value)} placeholder="target_type" disabled />
          <Input label="Target ID" value={filters.targetId} onChange={(event) => updateFilter("targetId", event.target.value)} placeholder="target_id" disabled />
          <Input label="Ngày tạo" type="date" value={filters.createdAt} onChange={(event) => updateFilter("createdAt", event.target.value)} disabled />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng báo cáo: 0</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Backend hiện chưa có bảng reports và chưa có endpoint quản lý báo cáo vi phạm.</p>
      </Card>

      <Table
        rows={[] as AdminReportRow[]}
        getRowKey={(report) => String(report.id)}
        columns={[
          { key: "id", header: "Report ID", render: (report) => report.id },
          { key: "type", header: "Loại", render: (report) => report.type },
          { key: "target", header: "Đối tượng", render: (report) => `${report.targetType} #${report.targetId}` },
          { key: "reporter", header: "Người báo cáo", render: (report) => `User #${report.reporterUserId}` },
          { key: "status", header: "Trạng thái", render: (report) => <StatusBadge label={statusLabels[report.status]} tone={getStatusTone(report.status)} /> },
          { key: "created", header: "Ngày tạo", render: (report) => formatDateTime(report.createdAt) },
        ]}
      />
      <div className="mt-4">
        <EmptyState message="Chưa có API reports nên bảng đang hiển thị 0 dòng, không dùng dữ liệu mock." />
      </div>
    </PageContainer>
  );
}

function ReportFieldsCard() {
  return (
    <Card>
      <SectionHeader title="Field cần có khi bổ sung DB/API" />
      <div className="flex flex-wrap gap-2">
        {["id", "type", "status", "target_type", "target_id", "reporter_user_id", "content", "created_at", "updated_at"].map((field) => <StatusBadge key={field} label={field} />)}
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getStatusTone(status: ReportStatus) {
  if (status === "RESOLVED") return "success" as const;
  if (status === "NEW" || status === "PROCESSING") return "warning" as const;
  if (status === "REJECTED") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
