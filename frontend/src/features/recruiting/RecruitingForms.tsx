import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Button } from "../../components/ui/Button";
import { Pagination } from "../../components/common/Pagination";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { createInterview, createInvitation, errorCode, listApplications, listJobs, ownedApplication } from "./recruitingApi";
import { localStamp, safeMeetingUrl, validWallTime } from "./recruitingTime";
import { useRecruitingMutation, useRecruitingQuery } from "./useRecruitingRequest";

const eligibleApplication = (status: string) => ["PENDING", "REVIEWED", "ACCEPTED"].includes(status);
export function InterviewForm() {
  const [search] = useSearchParams(), source = search.get("applicationId"), navigate = useNavigate();
  const [page, setPage] = useState(1), [reload, setReload] = useState(0);
  const [applicationId, setApplicationId] = useState(source ?? ""), [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""), [duration, setDuration] = useState("60");
  const [meetingType, setMeetingType] = useState<"ONLINE" | "ONSITE">("ONLINE"), [location, setLocation] = useState(""), [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({}), summary = useRef<HTMLDivElement>(null);
  const query = useRecruitingQuery(async signal => source !== null
    ? { items: [await ownedApplication(Number(source), signal)], page: 1, size: 1, totalItems: 1, totalPages: 1 }
    : listApplications(page, signal), [source, page, reload]);
  const mutation = useRecruitingMutation();
  const options = query.data?.items.filter(item => eligibleApplication(item.status)) ?? [];
  function submit(event: FormEvent) {
    event.preventDefault(); if (mutation.pending || query.loading || query.error) return;
    const selected = options.find(item => String(item.id) === applicationId), next: Record<string, string> = {};
    if (!selected) next.application = "Chọn đơn ứng tuyển còn xử lý từ dữ liệu công ty.";
    if (!title.trim() || title.length > 255) next.title = "Tiêu đề bắt buộc, tối đa 255 ký tự.";
    if (!validWallTime(scheduledAt) || scheduledAt <= localStamp()) next.time = "Chọn ngày giờ hợp lệ trong tương lai theo giờ máy chủ.";
    if (!Number.isInteger(Number(duration)) || Number(duration) < 15 || Number(duration) > 480) next.duration = "Thời lượng từ 15 đến 480 phút.";
    if (!location.trim() || location.length > 1000 || meetingType === "ONLINE" && !safeMeetingUrl(location)) next.location = meetingType === "ONLINE" ? "Nhập URL HTTP/HTTPS có host hợp lệ, không chứa khoảng trắng hoặc thông tin đăng nhập; tối đa 1000 ký tự." : "Nhập địa điểm trực tiếp, tối đa 1000 ký tự.";
    if (notes.length > 5000) next.notes = "Ghi chú tối đa 5000 ký tự.";
    setErrors(next);
    if (Object.keys(next).length || !selected) { window.setTimeout(() => summary.current?.focus(), 0); return; }
    void mutation.run(signal => createInterview({ applicationId: selected.id, title: title.trim(), scheduledAt,
      durationMinutes: Number(duration), meetingType, locationOrLink: location.trim(), notes: notes || null }, signal),
      item => navigate(`/recruiter/interviews/${item.id}`));
  }
  return <Card>
    <p className="mb-4 text-sm text-slate-600">Chỉ tạo lịch cho đơn chờ xử lý, đã xem hoặc đã nhận của công ty đã xác thực. Đơn đã rút hoặc bị từ chối không đủ điều kiện.</p>
    {query.loading ? <LoadingState /> : null}
    {query.error ? <ErrorState message={query.error} /> : null}
    <Button className="mb-4" variant="secondary" disabled={mutation.pending || query.loading} onClick={() => setReload(value => value + 1)}>Tải lại đơn ứng tuyển</Button>
    <form onSubmit={submit} noValidate className="space-y-4">
      {Object.keys(errors).length ? <div ref={summary} tabIndex={-1} role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">Chưa gửi lịch phỏng vấn. Vui lòng kiểm tra các trường được đánh dấu.</div> : null}
      <Select label="Đơn ứng tuyển" value={applicationId} disabled={query.loading || Boolean(query.error) || mutation.pending} error={errors.application} onChange={e => setApplicationId(e.target.value)} options={[{ label: "Chọn đơn ứng tuyển", value: "" }, ...options.map(item => ({ label: `#${item.id} · ${item.studentName || `Sinh viên #${item.studentId}`} · ${item.jobTitle}`, value: String(item.id) }))]} />
      {!query.loading && !query.error && !options.length ? <p className="text-sm text-slate-600">Trang này không có đơn đủ điều kiện. Hãy chọn trang khác hoặc kiểm tra danh sách ứng viên.</p> : null}
      {source === null && !query.error && !query.loading ? <Pagination page={page} totalPages={query.data?.totalPages ?? 1} onPageChange={value => { setPage(value); setApplicationId(""); }} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tiêu đề phỏng vấn" value={title} maxLength={255} error={errors.title} disabled={mutation.pending} onChange={e => setTitle(e.target.value)} />
        <Input label="Ngày giờ phỏng vấn (giờ máy chủ)" type="datetime-local" step={1} value={scheduledAt} error={errors.time} disabled={mutation.pending} onChange={e => setScheduledAt(e.target.value)} />
        <Input label="Thời lượng (phút)" type="number" min={15} max={480} step={1} value={duration} error={errors.duration} disabled={mutation.pending} onChange={e => setDuration(e.target.value)} />
        <Select label="Hình thức phỏng vấn" value={meetingType} disabled={mutation.pending} options={[{ label: "Trực tuyến", value: "ONLINE" }, { label: "Trực tiếp", value: "ONSITE" }]} onChange={e => setMeetingType(e.target.value as "ONLINE" | "ONSITE")} />
      </div>
      <Input label={meetingType === "ONLINE" ? "Liên kết cuộc họp" : "Địa điểm phỏng vấn"} value={location} maxLength={1000} error={errors.location} disabled={mutation.pending} onChange={e => setLocation(e.target.value)} />
      <Textarea label="Ghi chú phỏng vấn" value={notes} maxLength={5000} error={errors.notes} disabled={mutation.pending} onChange={e => setNotes(e.target.value)} />
      {mutation.error ? <ErrorState message={mutation.error} /> : null}
      <Button type="submit" loading={mutation.pending} disabled={query.loading || Boolean(query.error) || !options.length}>Lưu lịch phỏng vấn</Button>
    </form>
  </Card>;
}
export function InvitationForm() {
  const [search] = useSearchParams(), source = search.get("applicationId");
  if (source === null) return <Card><p className="mb-3">Chọn ứng viên từ đơn ứng tuyển hoặc hồ sơ đã lưu của công ty để gửi lời mời.</p><Link className="text-brand-700 underline" to="/recruiter/candidates">Xem đơn ứng tuyển</Link></Card>;
  return <AuthorizedInvitationForm source={source} />;
}
function AuthorizedInvitationForm({ source }: { source: string }) {
  const [page, setPage] = useState(1), [reload, setReload] = useState(0), [jobId, setJobId] = useState(""), [message, setMessage] = useState("");
  const [validation, setValidation] = useState(""), [duplicate, setDuplicate] = useState(false), [sent, setSent] = useState(false);
  const sourceQuery = useRecruitingQuery(signal => ownedApplication(Number(source), signal), [source, reload]);
  const jobsQuery = useRecruitingQuery(signal => listJobs(page, signal), [page, reload]);
  const mutation = useRecruitingMutation();
  const jobs = jobsQuery.data?.items.filter(job => job.status === "ACTIVE" && (!job.deadline || job.deadline >= localStamp().slice(0, 10))) ?? [];
  const loading = sourceQuery.loading || jobsQuery.loading, failed = sourceQuery.error || jobsQuery.error;
  function send(event: FormEvent) {
    event.preventDefault(); if (loading || failed || mutation.pending || duplicate || sent || !sourceQuery.data) return;
    const selected = jobs.find(item => String(item.id) === jobId);
    if (!selected || message.length > 5000) { setValidation("Chọn công việc đang tuyển của công ty và nhập lời nhắn tối đa 5000 ký tự."); return; }
    setValidation("");
    void mutation.run(signal => createInvitation({ studentId: sourceQuery.data!.studentId, jobId: selected.id, message: message || null }, signal),
      () => setSent(true), failure => setDuplicate(errorCode(failure) === "INVITATION_ALREADY_PENDING"));
  }
  return <Card>
    {loading ? <LoadingState /> : null}
    {failed ? <ErrorState message={failed} /> : null}
    <Button className="mb-4" variant="secondary" disabled={mutation.pending || loading || sent} onClick={() => setReload(value => value + 1)}>Tải lại nguồn ứng viên và công việc</Button>
    {sourceQuery.data && !sourceQuery.loading && !sourceQuery.error ? <p className="mb-4 font-medium">Ứng viên: {sourceQuery.data.studentName || `Sinh viên #${sourceQuery.data.studentId}`} · Đơn nguồn #{sourceQuery.data.id}</p> : null}
    <p className="mb-4 text-sm text-slate-600">Chỉ công ty đã xác thực mới được gửi lời mời cho công việc đang tuyển, còn hạn. Lời mời không tự tạo đơn ứng tuyển.</p>
    {sent ? <p role="status" className="mb-4 text-emerald-800">Đã gửi lời mời ứng tuyển.</p> : null}
    <form onSubmit={send} noValidate className="space-y-4">
      <Select label="Công việc mời ứng tuyển" value={jobId} disabled={loading || Boolean(failed) || mutation.pending || sent} options={[{ label: "Chọn công việc", value: "" }, ...jobs.map(job => ({ label: `#${job.id} · ${job.title}`, value: String(job.id) }))]} onChange={e => { setJobId(e.target.value); setDuplicate(false); mutation.clearError(); }} />
      {!loading && !failed && !jobs.length ? <p className="text-sm">Trang này không có công việc đủ điều kiện. Hãy chọn trang khác hoặc kiểm tra tin tuyển dụng.</p> : null}
      {!loading && !jobsQuery.error && !sent ? <Pagination page={page} totalPages={jobsQuery.data?.totalPages ?? 1} onPageChange={value => { setPage(value); setJobId(""); setDuplicate(false); mutation.clearError(); }} /> : null}
      <Textarea label="Lời nhắn mời ứng tuyển (không bắt buộc)" maxLength={5000} value={message} disabled={mutation.pending || sent} onChange={e => setMessage(e.target.value)} />
      {validation ? <ErrorState message={validation} /> : null}
      {mutation.error ? <ErrorState message={mutation.error} /> : null}
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={mutation.pending} disabled={loading || Boolean(failed) || !sourceQuery.data || !jobs.length || duplicate || sent}>Gửi lời mời ứng tuyển</Button><Link className="text-brand-700 underline" to="/recruiter/invitations">Xem lời mời đã gửi</Link></div>
    </form>
  </Card>;
}
