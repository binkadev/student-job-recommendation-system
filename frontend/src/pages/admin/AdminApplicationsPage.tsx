import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Timeline } from "../../components/ui/Timeline";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockApplicationService } from "../../services/mock";
import type { Application, ApplicationStatus } from "../../types/domain";

const statusLabels: Record<ApplicationStatus, string> = {
  submitted: "Đã nộp",
  viewed: "Đã xem",
  reviewing: "Đang đánh giá",
  shortlisted: "Vào vòng trong",
  interview: "Mời phỏng vấn",
  interviewed: "Đã phỏng vấn",
  offer: "Đề nghị nhận việc",
  rejected: "Từ chối",
  withdrawn: "Đã rút",
};

export function AdminApplicationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { applicationId } = useParams();
  const { showToast } = useToast();
  const applicationsQuery = useAsyncData(() => mockApplicationService.getApplications({ pageSize: 100 }), []);
  const [applications, setApplications] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (applicationsQuery.data?.items) setApplications(applicationsQuery.data.items);
  }, [applicationsQuery.data?.items]);

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const keyword = `${application.candidateName} ${application.jobTitle} ${application.companyName}`.toLowerCase();
    return (!query || keyword.includes(query.toLowerCase())) && (!status || application.status === status);
  }), [applications, query, status]);

  const selectedApplication = applications.find((application) => application.id === applicationId) ?? applications[0];

  function updateStatus(id: string, nextStatus: ApplicationStatus) {
    setApplications((current) => current.map((application) => application.id === id ? { ...application, status: nextStatus } : application));
    void mockApplicationService.updateApplication(id, { status: nextStatus });
    showToast({ type: "success", title: "Đã cập nhật trạng thái đơn ứng tuyển" });
  }

  if (mode === "detail" && selectedApplication) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết đơn ứng tuyển" description="Theo dõi ứng viên, tin tuyển dụng, CV đã nộp, thư ứng tuyển và lịch sử trạng thái." />
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card>
            <SectionHeader title={selectedApplication.candidateName} description={selectedApplication.jobTitle} />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <p><strong>Công ty:</strong> {selectedApplication.companyName}</p>
              <p><strong>CV:</strong> {selectedApplication.cvName}</p>
              <p><strong>Ngày ứng tuyển:</strong> {selectedApplication.appliedAt}</p>
              <p><strong>Trạng thái:</strong> <StatusBadge label={statusLabels[selectedApplication.status]} tone={selectedApplication.status === "rejected" ? "danger" : "success"} /></p>
            </div>
            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {selectedApplication.coverLetter}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => updateStatus(selectedApplication.id, "reviewing")}>Chuyển sang đang đánh giá</Button>
              <Button variant="secondary" onClick={() => updateStatus(selectedApplication.id, "interview")}>Mời phỏng vấn</Button>
              <Button variant="danger" onClick={() => updateStatus(selectedApplication.id, "rejected")}>Từ chối</Button>
            </div>
          </Card>
          <Card>
            <SectionHeader title="Dòng thời gian" />
            <Timeline items={selectedApplication.timeline} />
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý đơn ứng tuyển" description="Admin theo dõi tất cả đơn ứng tuyển trên hệ thống, lọc theo trạng thái và xử lý các trường hợp cần can thiệp." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Tìm kiếm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên ứng viên, công việc, công ty" />
          <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} />
          <Button className="self-end" variant="secondary" onClick={() => showToast({ type: "success", title: "Đã xuất báo cáo đơn ứng tuyển mock" })}>Xuất báo cáo</Button>
        </div>
      </Card>
      <Table rows={filteredApplications} getRowKey={(application) => application.id} columns={[
        { key: "candidate", header: "Ứng viên", render: (application) => application.candidateName },
        { key: "job", header: "Tin tuyển dụng", render: (application) => application.jobTitle },
        { key: "company", header: "Công ty", render: (application) => application.companyName },
        { key: "status", header: "Trạng thái", render: (application) => <StatusBadge label={statusLabels[application.status]} tone={application.status === "rejected" ? "danger" : "neutral"} /> },
        { key: "actions", header: "Thao tác", render: (application) => <div className="flex gap-2"><Button size="sm" onClick={() => updateStatus(application.id, "reviewing")}>Theo dõi</Button><Button size="sm" variant="secondary" onClick={() => updateStatus(application.id, "withdrawn")}>Đánh dấu rút</Button></div> },
      ]} />
    </PageContainer>
  );
}
