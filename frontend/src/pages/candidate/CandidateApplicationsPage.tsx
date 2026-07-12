import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { Timeline } from "../../components/ui/Timeline";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";
import { interviews } from "../../mocks/interviews";
import { mockApplicationService } from "../../services/mock";
import type { Application, ApplicationStatus } from "../../types/domain";
import { toneFromStatus } from "../../features/candidate/candidateLabels";

const pageSize = 5;

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  submitted: "Đã gửi",
  viewed: "Nhà tuyển dụng đã xem",
  reviewing: "Đang xem xét",
  shortlisted: "Qua vòng hồ sơ",
  interview: "Mời phỏng vấn",
  interviewed: "Đã phỏng vấn",
  offer: "Offer",
  rejected: "Không phù hợp",
  withdrawn: "Đã rút",
};

const applicationDisplayOverrides: Record<string, Partial<Application>> = {
  "app-1": { candidateName: "Nguyễn Văn An", jobTitle: "Frontend Developer", companyName: "Công ty TNHH Công nghệ NovaTech" },
  "app-2": { candidateName: "Lê Minh Khang", jobTitle: "Backend Developer", companyName: "Công ty Cổ phần FinPlus" },
  "app-3": { candidateName: "Phạm Thu Hà", jobTitle: "Data Analyst", companyName: "Công ty Cổ phần DataVision" },
  "app-4": { candidateName: "Hoàng Đức Long", jobTitle: "DevOps Engineer", companyName: "Công ty TNHH CloudNext" },
  "app-5": { candidateName: "Đặng Thùy Linh", jobTitle: "QA Engineer", companyName: "Công ty Cổ phần EcomHub" },
  "app-6": { candidateName: "Mai Phương Anh", jobTitle: "Full-stack Developer", companyName: "Công ty TNHH GreenSoft" },
  "app-7": { candidateName: "Vũ Ngọc Mai", jobTitle: "UI/UX Designer", companyName: "Công ty TNHH Bright Future" },
  "app-8": { candidateName: "Trịnh Hoàng Nam", jobTitle: "Mobile Developer", companyName: "Công ty Cổ phần EcomHub" },
  "app-9": { candidateName: "Bùi Tuấn Anh", jobTitle: "Business Analyst", companyName: "Công ty Cổ phần TalentBridge" },
  "app-10": { candidateName: "Lý Thanh Tâm", jobTitle: "Kế toán tổng hợp", companyName: "Công ty Cổ phần FinPlus" },
};

const applicationDetailMetadata: Record<string, { jobLocation: string; workMode: string; salary: string; companyDescription: string; contactName: string; contactEmail: string; contactPhone: string }> = {
  "app-1": {
    jobLocation: "Hà Nội",
    workMode: "Hybrid",
    salary: "18 - 28 triệu",
    companyDescription: "NovaTech phát triển nền tảng SaaS cho doanh nghiệp vừa và nhỏ.",
    contactName: "Trần Thị Bình",
    contactEmail: "binh.tran@novatech.vn",
    contactPhone: "0901 222 333",
  },
  "app-2": {
    jobLocation: "TP. Hồ Chí Minh",
    workMode: "Onsite",
    salary: "20 - 32 triệu",
    companyDescription: "FinPlus xây dựng sản phẩm tài chính số và hệ thống thanh toán.",
    contactName: "Đỗ Quốc Huy",
    contactEmail: "huy.do@finplus.vn",
    contactPhone: "0902 333 444",
  },
  "app-4": {
    jobLocation: "Remote",
    workMode: "Remote",
    salary: "25 - 40 triệu",
    companyDescription: "CloudNext cung cấp hạ tầng cloud và dịch vụ DevOps cho doanh nghiệp.",
    contactName: "Nguyễn Kim Oanh",
    contactEmail: "oanh.nguyen@cloudnext.vn",
    contactPhone: "0903 444 555",
  },
};

const fallbackApplicationMetadata = {
  jobLocation: "Hà Nội",
  workMode: "Hybrid",
  salary: "15 - 25 triệu",
  companyDescription: "Doanh nghiệp đang tuyển dụng nhân sự phù hợp với hồ sơ ứng viên.",
  contactName: "Bộ phận tuyển dụng",
  contactEmail: "hr@example.vn",
  contactPhone: "0900 000 000",
};

export function CandidateApplicationsPage({ mode = "list" }: { mode?: "list" | "detail" | "status" }) {
  const { applicationId } = useParams();
  const { showToast } = useToast();
  const applicationsQuery = useAsyncData(() => mockApplicationService.getApplications({ pageSize: 100 }), []);
  const [applications, setApplications] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cvId, setCvId] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [withdrawTarget, setWithdrawTarget] = useState<Application | null>(null);
  const [detailTab, setDetailTab] = useState(mode === "status" ? "timeline" : "overview");
  const [notesByApplication, setNotesByApplication] = useLocalStorageState<Record<string, string>>("candidate-application-notes", {});
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    if (applicationsQuery.data?.items) {
      setApplications(applicationsQuery.data.items.map(normalizeApplication));
    }
  }, [applicationsQuery.data?.items]);

  const selectedApplication = applicationId ? applications.find((application) => application.id === applicationId) : applications[0];

  useEffect(() => {
    if (mode === "status") setDetailTab("timeline");
  }, [mode]);

  useEffect(() => {
    if (selectedApplication) setNoteDraft(notesByApplication[selectedApplication.id] ?? "");
  }, [notesByApplication, selectedApplication]);

  const filteredApplications = useMemo(() => {
    return applications
      .filter((application) => {
        const matchQuery = !query || `${application.jobTitle} ${application.companyName}`.toLowerCase().includes(query.toLowerCase());
        const matchStatus = !status || application.status === status;
        const matchFrom = !dateFrom || application.appliedAt >= dateFrom;
        const matchTo = !dateTo || application.appliedAt <= dateTo;
        const matchCv = !cvId || application.cvId === cvId;
        return matchQuery && matchStatus && matchFrom && matchTo && matchCv;
      })
      .sort((a, b) => {
        const dateA = sort === "updated" ? getLastUpdatedAt(a) : a.appliedAt;
        const dateB = sort === "updated" ? getLastUpdatedAt(b) : b.appliedAt;
        return dateB.localeCompare(dateA);
      });
  }, [applications, query, status, dateFrom, dateTo, cvId, sort]);

  const cvOptions = useMemo(() => {
    const uniqueCvs = new Map(applications.map((application) => [application.cvId, application.cvName]));
    return Array.from(uniqueCvs.entries()).map(([value, label]) => ({ value, label }));
  }, [applications]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const pagedApplications = filteredApplications.slice((page - 1) * pageSize, page * pageSize);

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
  }

  async function withdrawApplication(application: Application, reason: string) {
    const nextTimeline = [
      ...application.timeline,
      {
        label: "Đã rút",
        at: new Date().toISOString(),
        note: reason ? `Ứng viên đã rút hồ sơ. Lý do: ${reason}` : "Ứng viên đã rút hồ sơ.",
      },
    ];
    const nextApplication = { ...application, status: "withdrawn" as const, timeline: nextTimeline };
    setApplications((current) => current.map((item) => (item.id === application.id ? nextApplication : item)));
    await mockApplicationService.updateApplication(application.id, { status: "withdrawn", timeline: nextTimeline });
    setWithdrawTarget(null);
    showToast({ type: "success", title: "Đã rút hồ sơ", message: "Trạng thái đơn ứng tuyển và timeline đã được cập nhật." });
  }

  function saveNote(application: Application) {
    setNotesByApplication((current) => ({ ...current, [application.id]: noteDraft }));
    showToast({ type: "success", title: "Đã lưu ghi chú", message: "Ghi chú cá nhân cho đơn ứng tuyển đã được cập nhật." });
  }

  if (applicationsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "status") && !selectedApplication) {
    return (
      <PageContainer>
        <PageHeader title="Không tìm thấy đơn ứng tuyển" description="Mã ứng tuyển không tồn tại hoặc dữ liệu đã được thay đổi." />
        <Card>
          <EmptyState message="Application not found." />
          <div className="mt-4 flex justify-center">
            <Link to="/candidate/applications"><Button>Quay lại lịch sử ứng tuyển</Button></Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "status") && selectedApplication) {
    const metadata = applicationDetailMetadata[selectedApplication.id] ?? fallbackApplicationMetadata;
    const relatedInterview = getRelatedInterview(selectedApplication.id);
    const logo = getCompanyLogo(selectedApplication.companyName);

    return (
      <PageContainer>
        <Card className="mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg font-semibold text-brand-700">{logo}</div>
              <div>
                <h1 className="text-xl font-semibold text-slate-950">{selectedApplication.jobTitle}</h1>
                <p className="mt-1 text-sm text-slate-600">{selectedApplication.companyName}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge label={`Ngày ứng tuyển ${formatDate(selectedApplication.appliedAt)}`} />
                  <StatusBadge label={applicationStatusLabels[selectedApplication.status]} tone={toneFromStatus(selectedApplication.status)} />
                  <StatusBadge label={`Mã ${selectedApplication.id}`} />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/candidate/jobs/${selectedApplication.jobId}`}><Button variant="secondary">Xem việc làm</Button></Link>
              <Link to={`/candidate/cvs/${selectedApplication.cvId}`}><Button variant="secondary">Xem CV</Button></Link>
              {relatedInterview ? <Link to="/candidate/interviews"><Button variant="secondary">Xem lịch phỏng vấn</Button></Link> : null}
              {canWithdraw(selectedApplication.status) ? <Button variant="danger" onClick={() => setWithdrawTarget(selectedApplication)}>Rút hồ sơ</Button> : null}
            </div>
          </div>
        </Card>

        <ApplicationStateNotice status={selectedApplication.status} />

        <Card className="mb-5">
          <Tabs
            value={detailTab}
            onChange={setDetailTab}
            items={[
              { label: "Tổng quan", value: "overview" },
              { label: "Hồ sơ đã gửi", value: "profile" },
              { label: "Timeline", value: "timeline" },
              { label: "Phỏng vấn", value: "interview" },
              { label: "Ghi chú cá nhân", value: "notes" },
            ]}
          />
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {detailTab === "overview" ? <ApplicationOverview application={selectedApplication} metadata={metadata} /> : null}
            {detailTab === "profile" ? <SubmittedProfileSection application={selectedApplication} /> : null}
            {detailTab === "timeline" ? <ApplicationTimelineSection application={selectedApplication} /> : null}
            {detailTab === "interview" ? <InterviewSection interview={relatedInterview} /> : null}
            {detailTab === "notes" ? (
              <Card>
                <SectionHeader title="Ghi chú cá nhân" description="Ghi chú chỉ lưu ở trình duyệt hiện tại bằng localStorage." />
                <Textarea label="Nội dung ghi chú" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Ví dụ: cần chuẩn bị portfolio, ôn lại React hooks, hỏi thêm về lộ trình..." />
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => saveNote(selectedApplication)}>Lưu ghi chú</Button>
                </div>
              </Card>
            ) : null}
          </div>
          <aside className="space-y-5">
            <Card>
              <SectionHeader title="Tóm tắt đơn" />
              <div className="space-y-3 text-sm text-slate-700">
                <SummaryItem label="Mã ứng tuyển" value={selectedApplication.id} />
                <SummaryItem label="Trạng thái" value={applicationStatusLabels[selectedApplication.status]} />
                <SummaryItem label="Cập nhật cuối" value={formatDateTime(getLastUpdatedAt(selectedApplication))} />
                <SummaryItem label="Bước tiếp theo" value={getNextStep(selectedApplication.status)} />
              </div>
            </Card>
            <Card>
              <SectionHeader title="Người liên hệ" />
              <div className="space-y-2 text-sm text-slate-700">
                <p className="font-medium text-slate-950">{metadata.contactName}</p>
                <p>{metadata.contactEmail}</p>
                <p>{metadata.contactPhone}</p>
              </div>
            </Card>
          </aside>
        </div>
        <WithdrawApplicationModal application={withdrawTarget} onClose={() => setWithdrawTarget(null)} onConfirm={withdrawApplication} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Lịch sử ứng tuyển" description="Tìm kiếm, lọc, sắp xếp và theo dõi trạng thái các đơn ứng tuyển đã gửi." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input label="Từ khóa" value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} placeholder="Tên việc làm, công ty..." />
          <Select
            label="Trạng thái"
            value={status}
            onChange={(event) => updateFilter(() => setStatus(event.target.value))}
            options={[{ label: "Tất cả", value: "" }, ...Object.entries(applicationStatusLabels).map(([value, label]) => ({ label, value }))]}
          />
          <Input label="Từ ngày" type="date" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} />
          <Input label="Đến ngày" type="date" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} />
          <Select
            label="CV đã sử dụng"
            value={cvId}
            onChange={(event) => updateFilter(() => setCvId(event.target.value))}
            options={[{ label: "Tất cả", value: "" }, ...cvOptions]}
          />
          <Select
            label="Sắp xếp"
            value={sort}
            onChange={(event) => updateFilter(() => setSort(event.target.value))}
            options={[
              { label: "Mới nhất", value: "latest" },
              { label: "Cập nhật gần nhất", value: "updated" },
            ]}
          />
        </div>
      </Card>

      {pagedApplications.length === 0 ? (
        <Card>
          <EmptyState message="Chưa có đơn ứng tuyển." />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/candidate/jobs"><Button>Tìm việc</Button></Link>
            <Link to="/candidate/jobs/recommended"><Button variant="secondary">Xem việc làm gợi ý</Button></Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {pagedApplications.map((application) => (
              <ApplicationCard key={application.id} application={application} onWithdraw={() => setWithdrawTarget(application)} />
            ))}
          </div>
          <div className="mt-5">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
      <WithdrawApplicationModal application={withdrawTarget} onClose={() => setWithdrawTarget(null)} onConfirm={withdrawApplication} />
    </PageContainer>
  );
}

function ApplicationCard({ application, onWithdraw }: { application: Application; onWithdraw: () => void }) {
  const lastUpdated = getLastUpdatedAt(application);
  const nextStep = getNextStep(application.status);
  const logo = application.companyName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700">{logo}</div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-950">{application.jobTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{application.companyName}</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <p>Ngày ứng tuyển: <strong>{formatDate(application.appliedAt)}</strong></p>
              <p>CV đã dùng: <strong>{application.cvName}</strong></p>
              <p>Cập nhật cuối: <strong>{formatDateTime(lastUpdated)}</strong></p>
              <p>Bước tiếp theo: <strong>{nextStep}</strong></p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusBadge label={applicationStatusLabels[application.status]} tone={toneFromStatus(application.status)} />
          <Link to={`/candidate/applications/${application.id}`}><Button variant="secondary" size="sm">Xem chi tiết</Button></Link>
          <Link to={`/candidate/applications/${application.id}/status`}><Button variant="secondary" size="sm">Xem trạng thái</Button></Link>
          {["interview", "interviewed"].includes(application.status) ? (
            <Link to="/candidate/interviews"><Button variant="secondary" size="sm">Lịch phỏng vấn</Button></Link>
          ) : null}
          {canWithdraw(application.status) ? <Button variant="danger" size="sm" onClick={onWithdraw}>Rút hồ sơ</Button> : null}
        </div>
      </div>
    </Card>
  );
}

function ApplicationOverview({ application, metadata }: { application: Application; metadata: typeof fallbackApplicationMetadata }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Tổng quan" description="Thông tin chính của đơn ứng tuyển và công việc đã nộp." />
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <SummaryItem label="Công việc" value={application.jobTitle} />
          <SummaryItem label="Công ty" value={application.companyName} />
          <SummaryItem label="Ngày ứng tuyển" value={formatDate(application.appliedAt)} />
          <SummaryItem label="Trạng thái" value={applicationStatusLabels[application.status]} />
          <SummaryItem label="Địa điểm" value={metadata.jobLocation} />
          <SummaryItem label="Hình thức" value={metadata.workMode} />
          <SummaryItem label="Mức lương" value={metadata.salary} />
          <SummaryItem label="Mã ứng tuyển" value={application.id} />
        </div>
      </Card>
      <Card>
        <SectionHeader title="Công ty" description={metadata.companyDescription} />
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <SummaryItem label="Người liên hệ" value={metadata.contactName} />
          <SummaryItem label="Email" value={metadata.contactEmail} />
          <SummaryItem label="Số điện thoại" value={metadata.contactPhone} />
          <SummaryItem label="Bước tiếp theo" value={getNextStep(application.status)} />
        </div>
      </Card>
    </div>
  );
}

function SubmittedProfileSection({ application }: { application: Application }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="CV đã gửi" description="CV được dùng trong đơn ứng tuyển này." />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950">{application.cvName}</p>
            <p className="mt-1 text-sm text-slate-600">Mã CV: {application.cvId}</p>
          </div>
          <Link to={`/candidate/cvs/${application.cvId}`}><Button variant="secondary">Xem CV</Button></Link>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Thư giới thiệu" />
        <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{application.coverLetter}</p>
      </Card>
      <Card>
        <SectionHeader title="Câu trả lời sàng lọc" />
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <SummaryItem label="Bạn có bao nhiêu năm kinh nghiệm?" value="1 năm" />
          <SummaryItem label="Khi nào bạn có thể bắt đầu?" value="Sau 2 tuần" />
          <SummaryItem label="Mức lương mong muốn?" value="15-22 triệu" />
          <SummaryItem label="Sẵn sàng onsite 3 ngày mỗi tuần?" value="Có thể theo lịch hybrid" />
        </div>
      </Card>
    </div>
  );
}

function ApplicationTimelineSection({ application }: { application: Application }) {
  const normalizedTimeline = normalizeTimeline(application);
  return (
    <Card>
      <SectionHeader title="Timeline" description="Các mốc xử lý của đơn ứng tuyển theo dữ liệu hiện tại." />
      <Timeline items={normalizedTimeline} />
    </Card>
  );
}

function InterviewSection({ interview }: { interview: ReturnType<typeof getRelatedInterview> }) {
  if (!interview) {
    return (
      <Card>
        <EmptyState message="Chưa có lịch phỏng vấn cho đơn ứng tuyển này." />
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Phỏng vấn" description="Thông tin lịch phỏng vấn liên quan đến đơn ứng tuyển." />
      <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
        <SummaryItem label="Thời gian" value={`${formatDateTime(interview.startsAt)} - ${new Date(interview.endsAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`} />
        <SummaryItem label="Hình thức" value={interview.mode} />
        <SummaryItem label="Địa điểm hoặc link" value={interview.locationOrLink} />
        <SummaryItem label="Trạng thái xác nhận" value={interview.statusLabel} />
        <SummaryItem label="Người phỏng vấn" value={interview.interviewer} />
        <SummaryItem label="Ghi chú" value={interview.note} />
      </div>
      <div className="mt-4 flex justify-end">
        <Link to="/candidate/interviews"><Button variant="secondary">Xem chi tiết</Button></Link>
      </div>
    </Card>
  );
}

function ApplicationStateNotice({ status }: { status: ApplicationStatus }) {
  if (!["withdrawn", "rejected", "offer"].includes(status)) return null;
  const messages: Record<string, { title: string; body: string; tone: "success" | "warning" | "danger" }> = {
    withdrawn: { title: "Application withdrawn", body: "Hồ sơ này đã được rút. Bạn không thể tiếp tục thao tác rút hồ sơ.", tone: "warning" },
    rejected: { title: "Rejected", body: "Nhà tuyển dụng đã đánh dấu đơn này là không phù hợp.", tone: "danger" },
    offer: { title: "Offer", body: "Đơn ứng tuyển đã có offer. Bạn có thể xem chi tiết để phản hồi theo quy trình tiếp theo.", tone: "success" },
  };
  const message = messages[status];
  return (
    <Card className="mb-5">
      <StatusBadge label={message.title} tone={message.tone} />
      <p className="mt-2 text-sm text-slate-600">{message.body}</p>
    </Card>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function WithdrawApplicationModal({
  application,
  onClose,
  onConfirm,
}: {
  application: Application | null;
  onClose: () => void;
  onConfirm: (application: Application, reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (application) setReason("");
  }, [application]);

  return (
    <Modal open={Boolean(application)} title="Rút hồ sơ ứng tuyển" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Bạn có chắc muốn rút hồ sơ ứng tuyển vị trí <strong>{application?.jobTitle}</strong> tại <strong>{application?.companyName}</strong>?
        </p>
        <Textarea label="Lý do rút hồ sơ tùy chọn" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: đã nhận offer khác, chưa phù hợp thời gian..." />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => application && onConfirm(application, reason)}>Rút hồ sơ</Button>
        </div>
      </div>
    </Modal>
  );
}

function normalizeApplication(application: Application): Application {
  return {
    ...application,
    ...applicationDisplayOverrides[application.id],
  };
}

function getCompanyLogo(companyName: string) {
  return companyName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getRelatedInterview(applicationId: string) {
  const interview = interviews.find((item) => item.applicationId === applicationId);
  if (!interview) return null;
  const statusLabels: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    declined: "Đã từ chối",
    reschedule_requested: "Yêu cầu đổi lịch",
    completed: "Đã hoàn thành",
  };
  const overrides: Record<string, Partial<typeof interview>> = {
    "interview-1": { candidateName: "Hoàng Đức Long", companyName: "Công ty TNHH CloudNext", interviewer: "Nguyễn Kim Oanh", note: "Chuẩn bị trao đổi về Kubernetes." },
    "interview-2": { candidateName: "Trịnh Hoàng Nam", companyName: "Công ty Cổ phần EcomHub", interviewer: "Phan Đức Tài", note: "Kiểm tra kiến thức Flutter." },
    "interview-3": { candidateName: "Lê Minh Khang", companyName: "Công ty Cổ phần FinPlus", interviewer: "Đỗ Quốc Huy", note: "Vòng kỹ thuật Java." },
  };
  return {
    ...interview,
    ...overrides[interview.id],
    statusLabel: statusLabels[interview.status] ?? interview.status,
  };
}

function normalizeTimeline(application: Application) {
  const fallbackByStatus: Record<ApplicationStatus, Array<{ label: string; at: string; note: string }>> = {
    submitted: [{ label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." }],
    viewed: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Nhà tuyển dụng đã xem", at: `${application.appliedAt}T14:30:00`, note: "Hồ sơ đã được mở xem." },
    ],
    reviewing: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Nhà tuyển dụng đã xem", at: `${application.appliedAt}T14:30:00`, note: "Hồ sơ đã được mở xem." },
      { label: "Đang xem xét", at: `${application.appliedAt}T16:00:00`, note: "Nhà tuyển dụng đang đánh giá hồ sơ." },
    ],
    shortlisted: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Nhà tuyển dụng đã xem", at: `${application.appliedAt}T14:30:00`, note: "Hồ sơ đã được mở xem." },
      { label: "Đang xem xét", at: `${application.appliedAt}T16:00:00`, note: "Nhà tuyển dụng đang đánh giá hồ sơ." },
      { label: "Qua vòng hồ sơ", at: `${application.appliedAt}T17:15:00`, note: "Ứng viên đã qua vòng lọc hồ sơ." },
    ],
    interview: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Nhà tuyển dụng đã xem", at: `${application.appliedAt}T14:30:00`, note: "Hồ sơ đã được mở xem." },
      { label: "Đang xem xét", at: `${application.appliedAt}T16:00:00`, note: "Nhà tuyển dụng đang đánh giá hồ sơ." },
      { label: "Qua vòng hồ sơ", at: `${application.appliedAt}T17:15:00`, note: "Ứng viên đã qua vòng lọc hồ sơ." },
      { label: "Mời phỏng vấn", at: `${application.appliedAt}T18:00:00`, note: "Nhà tuyển dụng đã gửi lời mời phỏng vấn." },
    ],
    interviewed: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Mời phỏng vấn", at: `${application.appliedAt}T18:00:00`, note: "Nhà tuyển dụng đã gửi lời mời phỏng vấn." },
      { label: "Đã phỏng vấn", at: `${application.appliedAt}T19:00:00`, note: "Ứng viên đã hoàn thành phỏng vấn." },
    ],
    offer: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Đã phỏng vấn", at: `${application.appliedAt}T19:00:00`, note: "Ứng viên đã hoàn thành phỏng vấn." },
      { label: "Offer", at: `${application.appliedAt}T20:00:00`, note: "Nhà tuyển dụng đã gửi offer." },
    ],
    rejected: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Không phù hợp", at: `${application.appliedAt}T18:00:00`, note: "Nhà tuyển dụng đã từ chối hồ sơ." },
    ],
    withdrawn: [
      { label: "Đã gửi", at: `${application.appliedAt}T09:00:00`, note: "Ứng viên đã gửi hồ sơ." },
      { label: "Đã rút", at: getLastUpdatedAt(application), note: "Ứng viên đã rút hồ sơ." },
    ],
  };
  const source = application.timeline.length > 2 ? application.timeline : fallbackByStatus[application.status];
  return source.map((item) => ({
    ...item,
    label: fixTimelineLabel(item.label),
    note: fixTimelineNote(item.note),
    at: formatDateTime(item.at),
  }));
}

function fixTimelineLabel(label: string) {
  const normalized: Record<string, string> = {
    "ÄÃ£ gá»­i": "Đã gửi",
    "NhÃ  tuyá»ƒn dá»¥ng Ä‘Ã£ xem": "Nhà tuyển dụng đã xem",
    "ÄÃ£ rÃºt": "Đã rút",
  };
  return normalized[label] ?? label;
}

function fixTimelineNote(note: string) {
  if (note.includes("Ä")) return "Hồ sơ đã được cập nhật trong hệ thống.";
  return note;
}

function canWithdraw(status: ApplicationStatus) {
  return !["rejected", "offer", "withdrawn"].includes(status);
}

function getLastUpdatedAt(application: Application) {
  return application.timeline[application.timeline.length - 1]?.at ?? `${application.appliedAt}T00:00:00`;
}

function getNextStep(status: ApplicationStatus) {
  const nextSteps: Record<ApplicationStatus, string> = {
    submitted: "Chờ nhà tuyển dụng xem hồ sơ",
    viewed: "Chờ phản hồi từ nhà tuyển dụng",
    reviewing: "Chờ kết quả xem xét",
    shortlisted: "Chuẩn bị vòng tiếp theo",
    interview: "Xác nhận hoặc tham gia phỏng vấn",
    interviewed: "Chờ kết quả phỏng vấn",
    offer: "Xem và phản hồi offer",
    rejected: "Không còn bước tiếp theo",
    withdrawn: "Hồ sơ đã rút",
  };
  return nextSteps[status];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
