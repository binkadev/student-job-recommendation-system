import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface ApplicationResponse {
  id: number;
  status: ApplicationStatus;
  coverLetter: string | null;
  studentId: number;
  studentName: string;
  studentEmail: string;
  jobId: number;
  jobTitle: string;
  companyId: number;
  companyName: string;
  cvFileId: number | null;
  cvFileName: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PublicStatisticsResponse {
  totalApplications?: number | null;
  applicationCount?: number | null;
  applications?: number | null;
}

const statusLabels: Record<ApplicationStatus, string> = {
  PENDING: "Chờ xử lý",
  REVIEWED: "Đã xem",
  ACCEPTED: "Chấp nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Đã rút",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

export function AdminApplicationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { applicationId } = useParams();
  const { showToast } = useToast();
  const [targetId, setTargetId] = useState(applicationId ?? "");
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>("REVIEWED");
  const [lastUpdated, setLastUpdated] = useState<ApplicationResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const statsQuery = useAsyncData(getPublicStatistics, []);
  const totalApplications = getTotalApplications(statsQuery.data);

  async function updateStatus() {
    const id = Number(targetId);
    if (!Number.isInteger(id) || id <= 0) {
      showToast({ type: "error", title: "Vui lòng nhập application ID hợp lệ" });
      return;
    }

    try {
      setSaving(true);
      const response = await httpClient.patch<ApiResponse<ApplicationResponse>>(`/applications/${id}/status`, { status: nextStatus });
      setLastUpdated(response.data.data);
      showToast({ type: "success", title: "Đã cập nhật trạng thái đơn ứng tuyển" });
    } catch {
      showToast({ type: "error", title: "Không thể cập nhật đơn ứng tuyển" });
    } finally {
      setSaving(false);
    }
  }

  if (mode === "detail") {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết đơn ứng tuyển" description="Backend chưa có API admin lấy chi tiết đơn ứng tuyển; chỉ có endpoint cập nhật trạng thái theo ID." />
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card>
            <SectionHeader title="Chưa có API chi tiết" />
            <EmptyState message="Hiện backend chưa có GET /api/applications/{id} cho admin. Khi có API detail, trang này sẽ hiển thị student, job, CV, cover letter và timeline từ ApplicationResponse." />
            <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <Info label="Application ID từ URL" value={applicationId ?? "Không có"} />
              <Info label="Bảng DB" value="applications" />
              <Info label="Field status" value="PENDING, REVIEWED, ACCEPTED, REJECTED, WITHDRAWN" />
              <Info label="Dữ liệu hiện hiển thị" value="0" />
            </div>
          </Card>
          <StatusUpdateCard targetId={targetId} nextStatus={nextStatus} lastUpdated={lastUpdated} saving={saving} setTargetId={setTargetId} setNextStatus={setNextStatus} onUpdate={() => void updateStatus()} />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý đơn ứng tuyển" description="Admin chưa có API list tất cả đơn ứng tuyển. Trang giữ khung quản trị và cho phép cập nhật trạng thái theo application ID bằng API hiện có." />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeader title="Danh sách đơn ứng tuyển" description={`Tổng đơn ứng tuyển từ API thống kê: ${totalApplications}. Danh sách admin vẫn chờ API list riêng.`} />
          <div className="mb-4 grid gap-3 md:grid-cols-5">
            <Input label="Student ID" disabled value="" onChange={() => undefined} placeholder="0" />
            <Input label="Job ID" disabled value="" onChange={() => undefined} placeholder="0" />
            <Input label="Company ID" disabled value="" onChange={() => undefined} placeholder="0" />
            <Input label="CV File ID" disabled value="" onChange={() => undefined} placeholder="0" />
            <Select label="Status" disabled value="" onChange={() => undefined} options={[{ label: "Tất cả", value: "" }, ...statusOptions]} />
          </div>
          <Table
            rows={[] as ApplicationResponse[]}
            getRowKey={(application) => String(application.id)}
            columns={[
              { key: "student", header: "Ứng viên", render: (application) => application.studentName },
              { key: "job", header: "Tin tuyển dụng", render: (application) => application.jobTitle },
              { key: "company", header: "Công ty", render: (application) => application.companyName },
              { key: "cv", header: "CV", render: (application) => application.cvFileName ?? "Không có" },
              { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={statusLabels[application.status]} tone={getStatusTone(application.status)} /> },
            ]}
          />
          <div className="mt-4">
            <EmptyState message={`Backend chưa có API admin list tất cả đơn ứng tuyển. Tổng đơn hiện có từ thống kê là ${totalApplications}.`} />
          </div>
        </Card>

        <StatusUpdateCard targetId={targetId} nextStatus={nextStatus} lastUpdated={lastUpdated} saving={saving} setTargetId={setTargetId} setNextStatus={setNextStatus} onUpdate={() => void updateStatus()} />
      </div>
    </PageContainer>
  );
}

function StatusUpdateCard({
  targetId,
  nextStatus,
  lastUpdated,
  saving,
  setTargetId,
  setNextStatus,
  onUpdate,
}: {
  targetId: string;
  nextStatus: ApplicationStatus;
  lastUpdated: ApplicationResponse | null;
  saving: boolean;
  setTargetId: (value: string) => void;
  setNextStatus: (value: ApplicationStatus) => void;
  onUpdate: () => void;
}) {
  return (
    <Card>
      <SectionHeader title="Cập nhật trạng thái" description="Endpoint thật: PATCH /api/applications/{id}/status." />
      <div className="grid gap-3">
        <Input label="Application ID" value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Nhập ID đơn ứng tuyển" />
        <Select label="Trạng thái mới" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ApplicationStatus)} options={statusOptions} />
        <Button loading={saving} onClick={onUpdate}>Cập nhật</Button>
      </div>
      {lastUpdated ? (
        <div className="mt-5 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Cập nhật gần nhất</p>
          <div className="mt-3 grid gap-2">
            <Info label="ID" value={String(lastUpdated.id)} />
            <Info label="Trạng thái" value={statusLabels[lastUpdated.status]} />
            <Info label="Ứng viên" value={`${lastUpdated.studentName} (${lastUpdated.studentEmail})`} />
            <Info label="Tin tuyển dụng" value={lastUpdated.jobTitle} />
            <Info label="Công ty" value={lastUpdated.companyName} />
            <Info label="CV" value={lastUpdated.cvFileName ?? "Không có"} />
            <Info label="Reviewed at" value={formatDateTime(lastUpdated.reviewedAt)} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

async function getPublicStatistics(): Promise<PublicStatisticsResponse | null> {
  try {
    const response = await httpClient.get<ApiResponse<PublicStatisticsResponse>>("/public/statistics");
    return response.data.data;
  } catch {
    return null;
  }
}

function getTotalApplications(stats: PublicStatisticsResponse | null) {
  return Number(stats?.totalApplications ?? stats?.applicationCount ?? stats?.applications ?? 0);
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getStatusTone(status: ApplicationStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "PENDING" || status === "REVIEWED") return "warning" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
