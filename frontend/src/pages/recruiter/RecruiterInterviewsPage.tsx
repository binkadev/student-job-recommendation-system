import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Rating } from "../../components/ui/Rating";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockInterviewService } from "../../services/mock";
import type { Interview, InterviewStatus } from "../../types/domain";

type InterviewView = "list" | "calendar";

interface InterviewFormState {
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  mode: "Online" | "Offline";
  locationOrLink: string;
  interviewers: string;
  agenda: string;
  instructions: string;
  reminder: string;
}

const statusLabels: Record<InterviewStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  declined: "Đã từ chối",
  reschedule_requested: "Yêu cầu đổi lịch",
  completed: "Hoàn thành",
};

const interviewerOptions = ["Trần Thị Bình", "Đỗ Quốc Huy", "Nguyễn Kim Oanh", "Phan Đức Tài"];
const candidateOptions = [
  { id: "candidate-1", name: "Nguyễn Văn An" },
  { id: "candidate-2", name: "Lê Minh Khang" },
  { id: "candidate-3", name: "Phạm Thu Hà" },
  { id: "candidate-5", name: "Hoàng Đức Long" },
];
const jobOptions = ["Frontend Developer", "Backend Developer", "Full-stack Developer", "DevOps Engineer", "Mobile Developer", "Data Analyst"];

const defaultForm: InterviewFormState = {
  candidateId: "candidate-1",
  candidateName: "Nguyễn Văn An",
  jobTitle: "Frontend Developer",
  date: "2026-07-18",
  startTime: "09:00",
  endTime: "10:00",
  mode: "Online",
  locationOrLink: "https://meet.example.vn/frontend",
  interviewers: "Trần Thị Bình",
  agenda: "Giới thiệu công ty, trao đổi kinh nghiệm dự án, kiểm tra kỹ thuật và hỏi đáp.",
  instructions: "Ứng viên chuẩn bị CV, portfolio hoặc GitHub nếu có.",
  reminder: "Gửi nhắc lịch trước 24 giờ và trước 30 phút.",
};

export function RecruiterInterviewsPage({ mode = "list" }: { mode?: "list" | "create" | "detail" }) {
  const { interviewId } = useParams();
  const { showToast } = useToast();
  const interviewsQuery = useAsyncData(() => mockInterviewService.getInterviews({ pageSize: 100 }), []);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [view, setView] = useState<InterviewView>("list");
  const [statusFilter, setStatusFilter] = useState("");
  const [interviewerFilter, setInterviewerFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [form, setForm] = useState<InterviewFormState>(defaultForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [evaluationNote, setEvaluationNote] = useState("Ứng viên giao tiếp tốt, cần kiểm tra thêm phần tối ưu hiệu năng.");
  const [confirmTarget, setConfirmTarget] = useState<Interview | null>(null);

  useEffect(() => {
    if (interviewsQuery.data?.items) setInterviews(interviewsQuery.data.items);
  }, [interviewsQuery.data?.items]);

  const selectedInterview = interviews.find((item) => item.id === interviewId) ?? interviews[0];
  const filteredInterviews = useMemo(() => interviews.filter((interview) => {
    const interviewDate = interview.startsAt.slice(0, 10);
    const matchStatus = !statusFilter || interview.status === statusFilter;
    const matchInterviewer = !interviewerFilter || interview.interviewer.includes(interviewerFilter);
    const matchJob = !jobFilter || interview.jobTitle === jobFilter;
    const matchFrom = !dateFrom || interviewDate >= dateFrom;
    const matchTo = !dateTo || interviewDate <= dateTo;
    return matchStatus && matchInterviewer && matchJob && matchFrom && matchTo;
  }), [dateFrom, dateTo, interviewerFilter, interviews, jobFilter, statusFilter]);

  async function updateStatus(id: string, status: InterviewStatus) {
    setInterviews((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    await mockInterviewService.updateInterview(id, { status });
    showToast({ type: "success", title: "Đã cập nhật lịch phỏng vấn", message: statusLabels[status] });
  }

  function requestConfirmInterview(id: string) {
    const target = interviews.find((interview) => interview.id === id);
    if (!target || target.status === "confirmed") return;
    setConfirmTarget(target);
  }

  async function confirmInterview() {
    if (!confirmTarget) return;
    await updateStatus(confirmTarget.id, "confirmed");
    setConfirmTarget(null);
  }

  async function saveInterview(nextStatus: InterviewStatus = "pending") {
    const validationErrors = validateInterviewForm(form);
    setErrors(validationErrors);
    if (validationErrors.length) return;

    const interview = buildInterviewFromForm(form, nextStatus);
    setInterviews((current) => [interview, ...current]);
    await mockInterviewService.createInterview(interview);
    showToast({ type: "success", title: "Đã tạo lịch phỏng vấn" });
  }

  async function updateSelectedInterview() {
    if (!selectedInterview) return;
    const validationErrors = validateInterviewForm(form);
    setErrors(validationErrors);
    if (validationErrors.length) return;
    const payload = buildInterviewFromForm(form, selectedInterview.status, selectedInterview.id);
    setInterviews((current) => current.map((item) => item.id === selectedInterview.id ? payload : item));
    await mockInterviewService.updateInterview(selectedInterview.id, payload);
    setEditing(false);
    showToast({ type: "success", title: "Đã chỉnh sửa lịch phỏng vấn" });
  }

  function startEdit(interview: Interview) {
    setForm(formFromInterview(interview));
    setEditing(true);
    setErrors([]);
  }

  if (interviewsQuery.loading) return <PageContainer><LoadingState /></PageContainer>;

  if (mode === "create") {
    return (
      <PageContainer>
        <PageHeader title="Tạo lịch phỏng vấn" description="Chọn ứng viên, vị trí, thời gian, hình thức, người phỏng vấn, agenda và nhắc lịch." />
        <InterviewForm form={form} setForm={setForm} errors={errors} submitLabel="Tạo lịch" onSubmit={() => void saveInterview("pending")} />
      </PageContainer>
    );
  }

  if (mode === "detail" && selectedInterview) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết phỏng vấn" description="Thông tin lịch, trạng thái xác nhận, ghi chú và đánh giá sau phỏng vấn." />
        {editing ? (
          <InterviewForm form={form} setForm={setForm} errors={errors} submitLabel="Lưu chỉnh sửa" onSubmit={() => void updateSelectedInterview()} onCancel={() => setEditing(false)} />
        ) : (
          <InterviewDetail
            interview={selectedInterview}
            evaluationNote={evaluationNote}
            setEvaluationNote={setEvaluationNote}
            onEdit={() => startEdit(selectedInterview)}
            onReschedule={() => startEdit(selectedInterview)}
            onCancel={() => void updateStatus(selectedInterview.id, "declined")}
            onComplete={() => void updateStatus(selectedInterview.id, "completed")}
            onSubmitEvaluation={() => void updateStatus(selectedInterview.id, "completed")}
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý phỏng vấn" description="Theo dõi lịch phỏng vấn bằng calendar/list view, lọc lịch và cập nhật trạng thái xác nhận." />
      <InterviewFilters
        view={view}
        setView={setView}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        interviewerFilter={interviewerFilter}
        setInterviewerFilter={setInterviewerFilter}
        jobFilter={jobFilter}
        setJobFilter={setJobFilter}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />
      {filteredInterviews.length ? (
        view === "calendar" ? <CalendarView interviews={filteredInterviews} onConfirm={requestConfirmInterview} /> : <InterviewListView interviews={filteredInterviews} onConfirm={requestConfirmInterview} />
      ) : (
        <Card><p className="text-sm text-slate-600">Không có lịch phỏng vấn phù hợp với bộ lọc hiện tại.</p></Card>
      )}
      <Modal open={Boolean(confirmTarget)} title="Xác nhận lịch phỏng vấn" onClose={() => setConfirmTarget(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Bạn có chắc muốn xác nhận lịch phỏng vấn của <strong>{confirmTarget?.candidateName}</strong> cho vị trí <strong>{confirmTarget?.jobTitle}</strong> không?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Hủy</Button>
            <Button onClick={() => void confirmInterview()}>Đồng ý</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

function InterviewFilters({
  view,
  setView,
  statusFilter,
  setStatusFilter,
  interviewerFilter,
  setInterviewerFilter,
  jobFilter,
  setJobFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}: {
  view: InterviewView;
  setView: (view: InterviewView) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  interviewerFilter: string;
  setInterviewerFilter: (value: string) => void;
  jobFilter: string;
  setJobFilter: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
}) {
  return (
    <Card className="mb-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}>List view</Button>
        <Button variant={view === "calendar" ? "primary" : "secondary"} onClick={() => setView("calendar")}>Calendar view</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Select label="Trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(statusLabels).map(([value, label]) => ({ label, value }))]} />
        <Select label="Interviewer" value={interviewerFilter} onChange={(event) => setInterviewerFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...interviewerOptions.map((value) => ({ label: value, value }))]} />
        <Select label="Job" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...jobOptions.map((value) => ({ label: value, value }))]} />
        <Input label="Từ ngày" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input label="Đến ngày" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>
    </Card>
  );
}

function InterviewListView({ interviews, onConfirm }: { interviews: Interview[]; onConfirm: (id: string) => void }) {
  return (
    <Table
      rows={interviews}
      getRowKey={(interview) => interview.id}
      columns={[
        { key: "candidate", header: "Candidate", render: (interview) => <div><p className="font-medium text-slate-900">{interview.candidateName}</p><p className="text-xs text-slate-500">{interview.companyName}</p></div> },
        { key: "job", header: "Job", render: (interview) => interview.jobTitle },
        { key: "time", header: "Thời gian", render: (interview) => <div className="text-xs"><p>{formatDateTime(interview.startsAt)}</p><p className="text-slate-500">{formatTime(interview.startsAt)} - {formatTime(interview.endsAt)}</p></div> },
        { key: "mode", header: "Hình thức", render: (interview) => <div className="min-w-[150px] text-xs"><p>{interview.mode}</p><p className="text-slate-500">{interview.locationOrLink}</p></div> },
        { key: "interviewers", header: "Interviewers", render: (interview) => interview.interviewer },
        { key: "status", header: "Xác nhận", render: (interview) => <StatusBadge label={statusLabels[interview.status]} tone={interviewTone(interview.status)} /> },
        { key: "actions", header: "Thao tác", render: (interview) => <Button variant="secondary" size="sm" disabled={interview.status === "confirmed"} onClick={() => onConfirm(interview.id)}>{interview.status === "confirmed" ? "Đã xác nhận" : "Xác nhận"}</Button> },
      ]}
    />
  );
}

function CalendarView({ interviews, onConfirm }: { interviews: Interview[]; onConfirm: (id: string) => void }) {
  const grouped = interviews.reduce<Record<string, Interview[]>>((acc, interview) => {
    const key = interview.startsAt.slice(0, 10);
    acc[key] = [...(acc[key] ?? []), interview];
    return acc;
  }, {});
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Object.entries(grouped).map(([date, items]) => (
        <Card key={date}>
          <SectionHeader title={formatDate(date)} description={`${items.length} lịch phỏng vấn`} />
          <div className="space-y-3">
            {items.map((interview) => (
              <div key={interview.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{interview.candidateName}</p>
                    <p className="text-xs text-slate-500">{interview.jobTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatTime(interview.startsAt)} - {formatTime(interview.endsAt)} • {interview.mode}</p>
                  </div>
                  <StatusBadge label={statusLabels[interview.status]} tone={interviewTone(interview.status)} />
                </div>
                <div className="mt-3 flex justify-end"><Button variant="secondary" size="sm" disabled={interview.status === "confirmed"} onClick={() => onConfirm(interview.id)}>{interview.status === "confirmed" ? "Đã xác nhận" : "Xác nhận"}</Button></div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function InterviewForm({ form, setForm, errors, submitLabel, onSubmit, onCancel }: { form: InterviewFormState; setForm: (form: InterviewFormState) => void; errors: string[]; submitLabel: string; onSubmit: () => void; onCancel?: () => void }) {
  function update<K extends keyof InterviewFormState>(key: K, value: InterviewFormState[K]) {
    const next = { ...form, [key]: value };
    if (key === "candidateId") next.candidateName = candidateOptions.find((item) => item.id === value)?.name ?? form.candidateName;
    setForm(next);
  }

  return (
    <Card>
      {errors.length ? <div className="mb-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Candidate" value={form.candidateId} onChange={(event) => update("candidateId", event.target.value)} options={[{ label: "Chọn ứng viên", value: "" }, ...candidateOptions.map((item) => ({ label: item.name, value: item.id }))]} />
        <Select label="Job" value={form.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} options={[{ label: "Chọn job", value: "" }, ...jobOptions.map((value) => ({ label: value, value }))]} />
        <Input label="Ngày" type="date" value={form.date} onChange={(event) => update("date", event.target.value)} />
        <Input label="Giờ bắt đầu" type="time" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} />
        <Input label="Giờ kết thúc" type="time" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} />
        <Select label="Hình thức" value={form.mode} onChange={(event) => update("mode", event.target.value as InterviewFormState["mode"])} options={[{ label: "Online", value: "Online" }, { label: "Offline", value: "Offline" }]} />
        <Input label="Địa điểm hoặc link" value={form.locationOrLink} onChange={(event) => update("locationOrLink", event.target.value)} />
        <Input label="Interviewers" value={form.interviewers} onChange={(event) => update("interviewers", event.target.value)} placeholder="Trần Thị Bình, Đỗ Quốc Huy" />
        <Textarea label="Agenda" value={form.agenda} onChange={(event) => update("agenda", event.target.value)} />
        <Textarea label="Instructions" value={form.instructions} onChange={(event) => update("instructions", event.target.value)} />
        <div className="md:col-span-2"><Textarea label="Reminder" value={form.reminder} onChange={(event) => update("reminder", event.target.value)} /></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onSubmit}>{submitLabel}</Button>
        {onCancel ? <Button variant="secondary" onClick={onCancel}>Hủy</Button> : null}
      </div>
    </Card>
  );
}

function InterviewDetail({ interview, evaluationNote, setEvaluationNote, onEdit, onReschedule, onCancel, onComplete, onSubmitEvaluation }: { interview: Interview; evaluationNote: string; setEvaluationNote: (value: string) => void; onEdit: () => void; onReschedule: () => void; onCancel: () => void; onComplete: () => void; onSubmitEvaluation: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <Card>
        <SectionHeader title={interview.candidateName} description={`${interview.jobTitle} • ${interview.companyName}`} />
        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <p><strong>Candidate:</strong> {interview.candidateName}</p>
          <p><strong>Job:</strong> {interview.jobTitle}</p>
          <p><strong>Thời gian:</strong> {formatDateTime(interview.startsAt)} - {formatTime(interview.endsAt)}</p>
          <p><strong>Interviewers:</strong> {interview.interviewer}</p>
          <p><strong>Hình thức:</strong> {interview.mode}</p>
          <p><strong>Địa điểm/link:</strong> {interview.locationOrLink}</p>
          <p><strong>Confirmation status:</strong> <StatusBadge label={statusLabels[interview.status]} tone={interviewTone(interview.status)} /></p>
        </div>
        <div className="mt-5">
          <SectionHeader title="Ghi chú" />
          <p className="text-sm leading-6 text-slate-700">{interview.note}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onEdit}>Chỉnh sửa</Button>
          <Button variant="secondary" onClick={onReschedule}>Đổi lịch</Button>
          <Button variant="danger" onClick={onCancel}>Hủy</Button>
          <Button onClick={onComplete}>Đánh dấu hoàn thành</Button>
        </div>
      </Card>
      <Card>
        <SectionHeader title="Evaluation" />
        <div className="space-y-4">
          <div><p className="mb-2 text-sm font-medium text-slate-700">Technical</p><Rating value={4} /></div>
          <div><p className="mb-2 text-sm font-medium text-slate-700">Communication</p><Rating value={4} /></div>
          <Textarea label="Nhận xét" value={evaluationNote} onChange={(event) => setEvaluationNote(event.target.value)} />
          <Select label="Kết quả" options={[{ label: "Qua vòng", value: "pass" }, { label: "Cần cân nhắc", value: "hold" }, { label: "Không phù hợp", value: "reject" }]} />
          <Button onClick={onSubmitEvaluation}>Submit evaluation</Button>
        </div>
      </Card>
    </div>
  );
}

function buildInterviewFromForm(form: InterviewFormState, status: InterviewStatus, id = `interview-${Date.now()}`): Interview {
  return {
    id,
    applicationId: "app-1",
    candidateId: form.candidateId,
    candidateName: form.candidateName,
    jobTitle: form.jobTitle,
    companyName: "Công ty TNHH Công nghệ NovaTech",
    startsAt: `${form.date}T${form.startTime}:00`,
    endsAt: `${form.date}T${form.endTime}:00`,
    mode: form.mode,
    locationOrLink: form.locationOrLink,
    interviewer: form.interviewers,
    status,
    note: `${form.agenda}\n${form.instructions}\n${form.reminder}`,
  };
}

function formFromInterview(interview: Interview): InterviewFormState {
  return {
    candidateId: interview.candidateId,
    candidateName: interview.candidateName,
    jobTitle: interview.jobTitle,
    date: interview.startsAt.slice(0, 10),
    startTime: interview.startsAt.slice(11, 16),
    endTime: interview.endsAt.slice(11, 16),
    mode: interview.mode,
    locationOrLink: interview.locationOrLink,
    interviewers: interview.interviewer,
    agenda: interview.note.split("\n")[0] ?? "",
    instructions: interview.note.split("\n")[1] ?? "",
    reminder: interview.note.split("\n")[2] ?? "",
  };
}

function validateInterviewForm(form: InterviewFormState) {
  const errors: string[] = [];
  if (!form.candidateId) errors.push("Candidate bắt buộc.");
  if (!form.jobTitle) errors.push("Job bắt buộc.");
  if (!splitValues(form.interviewers).length) errors.push("Phải có ít nhất một interviewer.");
  if (form.endTime <= form.startTime) errors.push("Giờ kết thúc phải sau giờ bắt đầu.");
  if (new Date(`${form.date}T${form.startTime}:00`).getTime() <= new Date("2026-07-12T00:00:00").getTime()) errors.push("Không được đặt lịch trong quá khứ.");
  return errors;
}

function splitValues(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function interviewTone(status: InterviewStatus) {
  if (status === "confirmed" || status === "completed") return "success" as const;
  if (status === "pending" || status === "reschedule_requested") return "warning" as const;
  return "danger" as const;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
