import { CalendarDays, Clock, ExternalLink, MapPin, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
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
import { useAsyncData } from "../../hooks/useAsyncData";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";
import { mockInterviewService } from "../../services/mock";
import type { Interview, InterviewStatus } from "../../types/domain";
import { toneFromStatus } from "../../features/candidate/candidateLabels";

type InterviewTab = "upcoming" | "completed" | "cancelled";
type ViewMode = "list" | "calendar";

interface RescheduleRequest {
  reason: string;
  suggestedTimes: string[];
  submittedAt: string;
}

const interviewStatusLabels: Record<InterviewStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  declined: "Đã từ chối",
  reschedule_requested: "Yêu cầu đổi lịch",
  completed: "Đã hoàn thành",
};

const interviewDisplayOverrides: Record<string, Partial<Interview>> = {
  "interview-1": { candidateName: "Hoàng Đức Long", companyName: "Công ty TNHH CloudNext", interviewer: "Nguyễn Kim Oanh", note: "Chuẩn bị trao đổi về Kubernetes." },
  "interview-2": { candidateName: "Trịnh Hoàng Nam", companyName: "Công ty Cổ phần EcomHub", interviewer: "Phan Đức Tài", note: "Kiểm tra kiến thức Flutter." },
  "interview-3": { candidateName: "Lê Minh Khang", companyName: "Công ty Cổ phần FinPlus", interviewer: "Đỗ Quốc Huy", note: "Vòng kỹ thuật Java." },
  "interview-4": { candidateName: "Mai Phương Anh", companyName: "Công ty TNHH GreenSoft", interviewer: "Trần Thị Bình", note: "Đã hoàn thành, chờ offer." },
  "interview-5": { candidateName: "Nguyễn Văn An", companyName: "Công ty TNHH Công nghệ NovaTech", interviewer: "Trần Thị Bình", note: "Ứng viên yêu cầu đổi lịch." },
  "interview-6": { candidateName: "Phạm Thu Hà", companyName: "Công ty Cổ phần DataVision", interviewer: "Nguyễn Kim Oanh", note: "Ứng viên từ chối lịch đầu tiên." },
};

export function CandidateInterviewsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  const { interviewId } = useParams();
  const { showToast } = useToast();
  const interviewsQuery = useAsyncData(() => mockInterviewService.getInterviews({ pageSize: 100 }), []);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [tab, setTab] = useState<InterviewTab>("upcoming");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [declineTarget, setDeclineTarget] = useState<Interview | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<Interview | null>(null);
  const [rescheduleRequests, setRescheduleRequests] = useLocalStorageState<Record<string, RescheduleRequest>>("candidate-interview-reschedule-requests", {});

  useEffect(() => {
    if (interviewsQuery.data?.items) setInterviews(interviewsQuery.data.items.map(normalizeInterview));
  }, [interviewsQuery.data?.items]);

  const selectedInterview = interviewId ? interviews.find((interview) => interview.id === interviewId) : interviews[0];

  const companies = useMemo(() => Array.from(new Set(interviews.map((interview) => interview.companyName))), [interviews]);

  const filteredInterviews = useMemo(() => {
    return interviews
      .filter((interview) => {
        const itemTab = getInterviewTab(interview);
        const matchTab = itemTab === tab;
        const matchCompany = !company || interview.companyName === company;
        const matchStatus = !status || interview.status === status;
        const day = interview.startsAt.slice(0, 10);
        const matchFrom = !dateFrom || day >= dateFrom;
        const matchTo = !dateTo || day <= dateTo;
        return matchTab && matchCompany && matchStatus && matchFrom && matchTo;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [interviews, tab, company, status, dateFrom, dateTo]);

  async function updateInterviewStatus(interview: Interview, nextStatus: InterviewStatus, note?: string) {
    const nextInterview = { ...interview, status: nextStatus, note: note || interview.note };
    setInterviews((current) => current.map((item) => (item.id === interview.id ? nextInterview : item)));
    await mockInterviewService.updateInterview(interview.id, { status: nextStatus, note: nextInterview.note });
    showToast({ type: "success", title: "Đã cập nhật lịch phỏng vấn", message: interviewStatusLabels[nextStatus] });
  }

  function saveRescheduleRequest(interview: Interview, request: RescheduleRequest) {
    setRescheduleRequests((current) => ({ ...current, [interview.id]: request }));
    void updateInterviewStatus(interview, "reschedule_requested", `Yêu cầu đổi lịch: ${request.reason}`);
    setRescheduleTarget(null);
  }

  if (interviewsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (mode === "detail") {
    if (!selectedInterview) {
      return (
        <PageContainer>
          <PageHeader title="Không tìm thấy lịch phỏng vấn" description="Lịch phỏng vấn không tồn tại hoặc dữ liệu đã được thay đổi." />
          <Card>
            <EmptyState message="Không tìm thấy lịch phỏng vấn." />
          </Card>
        </PageContainer>
      );
    }
    return (
      <PageContainer>
        <PageHeader title="Chi tiết phỏng vấn" description="Thông tin thời gian, hình thức, địa điểm hoặc link họp, người phỏng vấn và trạng thái xác nhận." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <InterviewDetail interview={selectedInterview} rescheduleRequest={rescheduleRequests[selectedInterview.id]} />
          <aside className="space-y-4">
            <InterviewActions
              interview={selectedInterview}
              onConfirm={() => void updateInterviewStatus(selectedInterview, "confirmed")}
              onDecline={() => setDeclineTarget(selectedInterview)}
              onReschedule={() => setRescheduleTarget(selectedInterview)}
            />
          </aside>
        </div>
        <DeclineModal interview={declineTarget} onClose={() => setDeclineTarget(null)} onConfirm={(interview, reason) => void updateInterviewStatus(interview, "declined", `Từ chối: ${reason}`)} />
        <RescheduleModal interview={rescheduleTarget} onClose={() => setRescheduleTarget(null)} onConfirm={saveRescheduleRequest} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Lịch phỏng vấn" description="Xem lịch sắp tới, lịch đã hoàn thành, lịch đã hủy và cập nhật trạng thái xác nhận." />

      <Card className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as InterviewTab)}
            items={[
              { label: "Sắp tới", value: "upcoming" },
              { label: "Đã hoàn thành", value: "completed" },
              { label: "Đã hủy", value: "cancelled" },
            ]}
          />
          <div className="flex gap-2">
            <Button variant={view === "list" ? "primary" : "secondary"} size="sm" onClick={() => setView("list")}>List view</Button>
            <Button variant={view === "calendar" ? "primary" : "secondary"} size="sm" onClick={() => setView("calendar")}>Calendar view</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select label="Công ty" value={company} onChange={(event) => setCompany(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...companies.map((value) => ({ label: value, value }))]} />
          <Select
            label="Trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[{ label: "Tất cả", value: "" }, ...Object.entries(interviewStatusLabels).map(([value, label]) => ({ label, value }))]}
          />
          <Input label="Từ ngày" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input label="Đến ngày" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </Card>

      {filteredInterviews.length === 0 ? (
        <Card>
          <EmptyState message="Không có lịch phỏng vấn phù hợp." />
        </Card>
      ) : view === "calendar" ? (
        <CalendarView interviews={filteredInterviews} />
      ) : (
        <div className="grid gap-4">
          {filteredInterviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onConfirm={() => void updateInterviewStatus(interview, "confirmed")}
              onDecline={() => setDeclineTarget(interview)}
              onReschedule={() => setRescheduleTarget(interview)}
            />
          ))}
        </div>
      )}

      <DeclineModal interview={declineTarget} onClose={() => setDeclineTarget(null)} onConfirm={(interview, reason) => void updateInterviewStatus(interview, "declined", `Từ chối: ${reason}`)} />
      <RescheduleModal interview={rescheduleTarget} onClose={() => setRescheduleTarget(null)} onConfirm={saveRescheduleRequest} />
    </PageContainer>
  );
}

function InterviewCard({ interview, onConfirm, onDecline, onReschedule }: { interview: Interview; onConfirm: () => void; onDecline: () => void; onReschedule: () => void }) {
  const specialState = getSpecialState(interview);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={interviewStatusLabels[interview.status]} tone={toneFromStatus(interview.status)} />
            {specialState ? <StatusBadge label={specialState} tone="warning" /> : null}
          </div>
          <h2 className="mt-3 font-semibold text-slate-950">{interview.jobTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{interview.companyName}</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <span className="inline-flex items-center gap-2"><CalendarDays size={16} />{formatDate(interview.startsAt)}</span>
            <span className="inline-flex items-center gap-2"><Clock size={16} />{formatTimeRange(interview)}</span>
            <span className="inline-flex items-center gap-2"><Video size={16} />{interview.mode}</span>
            <span className="inline-flex items-center gap-2"><MapPin size={16} />{interview.locationOrLink || "Chưa có link họp"}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">Người phỏng vấn: <strong>{interview.interviewer}</strong></p>
          <p className="mt-1 text-sm text-slate-600">Thời gian còn lại: <strong>{getTimeRemaining(interview)}</strong></p>
        </div>
        <InterviewActions interview={interview} onConfirm={onConfirm} onDecline={onDecline} onReschedule={onReschedule} compact />
      </div>
    </Card>
  );
}

function InterviewActions({ interview, onConfirm, onDecline, onReschedule, compact = false }: { interview: Interview; onConfirm: () => void; onDecline: () => void; onReschedule: () => void; compact?: boolean }) {
  const canUpdate = !["declined", "completed"].includes(interview.status);
  const canOpenMeeting = interview.mode === "Online" && interview.locationOrLink.startsWith("http") && isNearInterviewTime(interview);
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "justify-end" : ""}`}>
      <Link to={`/candidate/interviews/${interview.id}`}><Button variant="secondary" size="sm">Xem chi tiết</Button></Link>
      <Button size="sm" onClick={onConfirm} disabled={!canUpdate || interview.status === "confirmed"}>Xác nhận tham gia</Button>
      <Button variant="secondary" size="sm" onClick={onReschedule} disabled={!canUpdate}>Yêu cầu đổi lịch</Button>
      <Button variant="danger" size="sm" onClick={onDecline} disabled={!canUpdate}>Từ chối</Button>
      <Button variant="secondary" size="sm" icon={<ExternalLink size={16} />} disabled={!canOpenMeeting} onClick={() => window.open(interview.locationOrLink, "_blank", "noopener,noreferrer")}>
        Mở link họp
      </Button>
    </div>
  );
}

function CalendarView({ interviews }: { interviews: Interview[] }) {
  const grouped = interviews.reduce<Record<string, Interview[]>>((acc, interview) => {
    const day = interview.startsAt.slice(0, 10);
    acc[day] = [...(acc[day] ?? []), interview];
    return acc;
  }, {});
  return (
    <Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day} className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-950">{formatDate(day)}</p>
            <div className="mt-3 space-y-2">
              {items.map((interview) => (
                <Link key={interview.id} to={`/candidate/interviews/${interview.id}`} className="block rounded-md bg-slate-50 p-3 hover:bg-brand-50">
                  <p className="text-sm font-medium text-slate-900">{formatTimeRange(interview)} · {interview.jobTitle}</p>
                  <p className="mt-1 text-xs text-slate-600">{interview.companyName}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function InterviewDetail({ interview, rescheduleRequest }: { interview: Interview; rescheduleRequest?: RescheduleRequest }) {
  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title={interview.jobTitle} description={interview.companyName} />
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <SummaryItem label="Ngày" value={formatDate(interview.startsAt)} />
          <SummaryItem label="Giờ" value={formatTimeRange(interview)} />
          <SummaryItem label="Hình thức" value={interview.mode} />
          <SummaryItem label="Địa điểm hoặc link" value={interview.locationOrLink || "Chưa có link họp"} />
          <SummaryItem label="Người phỏng vấn" value={interview.interviewer} />
          <SummaryItem label="Trạng thái xác nhận" value={interviewStatusLabels[interview.status]} />
          <SummaryItem label="Thời gian còn lại" value={getTimeRemaining(interview)} />
          <SummaryItem label="Ghi chú" value={interview.note} />
        </div>
      </Card>
      {rescheduleRequest ? (
        <Card>
          <SectionHeader title="Yêu cầu đổi lịch đã lưu" description={`Gửi lúc ${formatDateTime(rescheduleRequest.submittedAt)}`} />
          <p className="text-sm text-slate-700"><strong>Lý do:</strong> {rescheduleRequest.reason}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rescheduleRequest.suggestedTimes.map((time) => <StatusBadge key={time} label={formatDateTime(time)} />)}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function DeclineModal({ interview, onClose, onConfirm }: { interview: Interview | null; onClose: () => void; onConfirm: (interview: Interview, reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (interview) {
      setReason("");
      setError("");
    }
  }, [interview]);
  return (
    <Modal open={Boolean(interview)} title="Từ chối lịch phỏng vấn" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Vui lòng nhập lý do từ chối lịch phỏng vấn cho vị trí <strong>{interview?.jobTitle}</strong>.</p>
        <Textarea label="Lý do từ chối" value={reason} error={error} onChange={(event) => setReason(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={() => {
            if (!reason.trim()) {
              setError("Vui lòng nhập lý do từ chối.");
              return;
            }
            if (interview) onConfirm(interview, reason.trim());
            onClose();
          }}>Từ chối</Button>
        </div>
      </div>
    </Modal>
  );
}

function RescheduleModal({ interview, onClose, onConfirm }: { interview: Interview | null; onClose: () => void; onConfirm: (interview: Interview, request: RescheduleRequest) => void }) {
  const [reason, setReason] = useState("");
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");
  const [time3, setTime3] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (interview) {
      setReason("");
      setTime1("");
      setTime2("");
      setTime3("");
      setError("");
    }
  }, [interview]);
  return (
    <Modal open={Boolean(interview)} title="Yêu cầu đổi lịch" onClose={onClose}>
      <div className="space-y-4">
        <Textarea label="Lý do đổi lịch" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Thời gian đề xuất 1" type="datetime-local" value={time1} onChange={(event) => setTime1(event.target.value)} />
          <Input label="Thời gian đề xuất 2" type="datetime-local" value={time2} onChange={(event) => setTime2(event.target.value)} />
          <Input label="Thời gian đề xuất 3" type="datetime-local" value={time3} onChange={(event) => setTime3(event.target.value)} />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={() => {
            const suggestedTimes = [time1, time2, time3].filter(Boolean);
            if (!reason.trim() || suggestedTimes.length === 0) {
              setError("Vui lòng nhập lý do và ít nhất một thời gian đề xuất.");
              return;
            }
            if (interview) onConfirm(interview, { reason: reason.trim(), suggestedTimes, submittedAt: new Date().toISOString() });
          }}>Lưu yêu cầu</Button>
        </div>
      </div>
    </Modal>
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

function normalizeInterview(interview: Interview): Interview {
  return { ...interview, ...interviewDisplayOverrides[interview.id] };
}

function getInterviewTab(interview: Interview): InterviewTab {
  if (["declined", "reschedule_requested"].includes(interview.status)) return "cancelled";
  if (interview.status === "completed" || new Date(interview.endsAt).getTime() < Date.now()) return "completed";
  return "upcoming";
}

function isNearInterviewTime(interview: Interview) {
  const now = Date.now();
  const start = new Date(interview.startsAt).getTime();
  const end = new Date(interview.endsAt).getTime();
  return now >= start - 15 * 60 * 1000 && now <= end;
}

function getSpecialState(interview: Interview) {
  if (interview.status === "declined") return "Lịch đã bị hủy";
  if (interview.mode === "Online" && !interview.locationOrLink) return "Link họp chưa có";
  const now = Date.now();
  const start = new Date(interview.startsAt).getTime();
  const end = new Date(interview.endsAt).getTime();
  if (end < now && interview.status !== "completed") return "Phỏng vấn đã quá giờ";
  if (start > now && start - now <= 24 * 60 * 60 * 1000) return "Phỏng vấn trong 24 giờ";
  return "";
}

function getTimeRemaining(interview: Interview) {
  const now = Date.now();
  const start = new Date(interview.startsAt).getTime();
  const end = new Date(interview.endsAt).getTime();
  if (end < now) return "Đã quá giờ";
  if (now >= start && now <= end) return "Đang diễn ra";
  const minutes = Math.max(0, Math.round((start - now) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes % 60} phút`;
  return `${minutes} phút`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatTimeRange(interview: Interview) {
  const formatter = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${formatter.format(new Date(interview.startsAt))} - ${formatter.format(new Date(interview.endsAt))}`;
}
