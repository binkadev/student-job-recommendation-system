import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { sessionVersion, AUTH_TOKEN_STORAGE_KEY } from "../../services/auth/sessionVersion";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { ErrorState } from "../../components/feedback/ErrorState";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { changeStatus, findRecord, isInterview, listRecords, type Kind, type RecruitingRecord, type RecruitingRole, type RecordStatus } from "./recruitingApi";
import { formatWallTime, safeMeetingUrl, timeGuidance } from "./recruitingTime";
import { useRecruitingMutation, useRecruitingQuery } from "./useRecruitingRequest";
import { InterviewForm, InvitationForm } from "./RecruitingForms";

import { labels, actionLabels, basePath, availableActions } from "./recruitingPresentation";

export type Mode = "list" | "detail" | "create";
interface Props { role: RecruitingRole; kind: Kind; mode?: Mode }
export function RecruitingPage({ role, kind, mode = "list" }: Props) {
  const auth = useAuth(), location = useLocation();
  if (auth.isInitializing) return <LoadingState />;
  if (!auth.isAuthenticated || auth.currentRole !== role || !auth.currentUser)
    return <PageContainer><ErrorState message="Bạn không có quyền truy cập chức năng này." /></PageContainer>;
  const key = `${auth.currentUser.id}:${sessionVersion()}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}:${location.pathname}:${location.search}`;
  return <RecruitingWorkspace key={key} role={role} kind={kind} mode={mode} />;
}
function RecruitingWorkspace({ role, kind, mode }: Required<Props>) {
  const params = useParams(), [page, setPage] = useState(1), [reload, setReload] = useState(0), [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  const path = basePath(role, kind), id = Number(kind === "interviews" ? params.interviewId : params.invitationId);
  const title = kind === "interviews" ? mode === "create" ? "Tạo lịch phỏng vấn" : mode === "detail" ? "Chi tiết phỏng vấn" : "Lịch phỏng vấn" : mode === "create" ? "Gửi lời mời ứng tuyển" : mode === "detail" ? "Chi tiết lời mời ứng tuyển" : role === "recruiter" ? "Lời mời đã gửi" : "Lời mời ứng tuyển";
  return <PageContainer>
    <PageHeader title={title} description={kind === "interviews" ? "Lịch và phản hồi phỏng vấn thuộc tài khoản hiện tại." : role === "candidate" ? "Chấp nhận lời mời không tự tạo đơn ứng tuyển. Bạn vẫn cần ứng tuyển qua trang công việc." : "Theo dõi lời mời đã gửi. Chấp nhận lời mời không tự tạo đơn ứng tuyển cho sinh viên."} />
    <div className="mb-5 flex flex-wrap gap-3">
      <Link className="font-medium text-brand-700 underline" to={path}>Danh sách {kind === "interviews" ? "phỏng vấn" : "lời mời"}</Link>
      {role === "recruiter" ? <><Link className="font-medium text-brand-700 underline" to="/recruiter/interviews/create">Tạo lịch phỏng vấn</Link><Link className="font-medium text-brand-700 underline" to="/recruiter/invitations">Lời mời đã gửi</Link><Link className="font-medium text-brand-700 underline" to="/recruiter/candidates">Chọn ứng viên từ đơn ứng tuyển</Link></> : null}
    </div>
    {kind === "interviews" ? <p className="mb-4 text-sm leading-6 text-slate-600">{timeGuidance}</p> : null}
    {notice ? <p role="status" className="mb-4 text-emerald-800">{notice}</p> : null}
    {mode === "create" && role === "recruiter" ? kind === "interviews" ? <InterviewForm /> : <InvitationForm /> : <RecordCollection key={`${kind}:${id}:${page}:${reload}`} role={role} kind={kind} detail={mode === "detail"} id={id} page={page} now={now} onPage={setPage} onReload={() => { setReload(value => value + 1); setNotice("Đã yêu cầu tải lại dữ liệu. Hãy kiểm tra trạng thái trước khi chọn lại thao tác."); }} />}
  </PageContainer>;
}
function RecordCollection({ role, kind, detail, id, page, now, onPage, onReload }: { role: RecruitingRole; kind: Kind; detail: boolean; id: number; page: number; now: Date; onPage: (page: number) => void; onReload: () => void }) {
  const query = useRecruitingQuery(async signal => detail ? { items: [await findRecord(role, kind, id, signal)], page: 1, size: 1, totalItems: 1, totalPages: 1 } : listRecords(role, kind, page, 10, signal), [role, kind, detail, id, page]);
  const mutation = useRecruitingMutation();
  const [action, setAction] = useState<{ captured: RecruitingRecord; target: RecordStatus } | null>(null), [stale, setStale] = useState(false), [notice, setNotice] = useState("");
  function open(item: RecruitingRecord, target: RecordStatus) { if (stale) return; setAction({ captured: item, target }); mutation.clearError(); }
  function send() {
    if (!action || stale) return;
    void mutation.run(signal => changeStatus(role, kind, action.captured, action.target, signal), saved => {
      query.setData(current => current ? { ...current, items: current.items.map(item => item.id === saved.id ? saved : item) } : current);
      setAction(null); setNotice(`Đã cập nhật: ${labels[saved.status] ?? "trạng thái đã được lưu"}.`);
    }, () => setStale(true));
  }
  return <>
    <Button variant="secondary" className="mb-4" disabled={query.loading || mutation.pending} onClick={onReload}>Tải lại dữ liệu</Button>
    {stale && !action ? <ErrorState message="Thao tác trước chưa được xác nhận. Hãy tải lại dữ liệu trước khi tiếp tục." /> : null}
    {query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} /> : <>
      {notice ? <p role="status" className="mb-4 text-emerald-800">{notice}</p> : null}
      {!query.data?.items.length ? <EmptyState message={kind === "interviews" ? "Chưa có lịch phỏng vấn." : "Chưa có lời mời ứng tuyển."} /> : <div className="space-y-4">{query.data.items.map(item => <Card key={item.id}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">{isInterview(item) ? item.title : `Lời mời #${item.id}`}</h2><StatusBadge label={labels[item.status] ?? "Chưa xác nhận trạng thái"} /></div>
        <p className="mt-3 text-sm text-slate-600">Công ty #{item.companyId} · Sinh viên #{item.studentId} · Công việc #{item.jobId}</p>
        {isInterview(item) ? <>
          <p className="mt-2 text-sm">{formatWallTime(item.scheduledAt)} · {item.durationMinutes} phút · {item.meetingType === "ONLINE" ? "Trực tuyến" : item.meetingType === "ONSITE" ? "Trực tiếp" : "Chưa xác nhận hình thức"}</p>
          {detail ? <><p className="mt-3 break-words">Địa điểm / liên kết: {item.meetingType === "ONLINE" && safeMeetingUrl(item.locationOrLink) ? <a className="text-brand-700 underline" href={item.locationOrLink} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Mở phòng phỏng vấn</a> : item.locationOrLink || "Chưa cập nhật"}</p><p className="mt-3 whitespace-pre-wrap break-words">{item.notes || "Chưa có ghi chú."}</p></> : null}
          <Link className="mt-3 inline-block text-brand-700 underline" to={role === "candidate" ? `/candidate/applications/${item.applicationId}` : `/recruiter/candidates/${item.applicationId}`}>Xem đơn ứng tuyển #{item.applicationId}</Link>
        </> : detail ? <p className="mt-3 whitespace-pre-wrap break-words">{item.message || "Lời mời không có nội dung bổ sung."}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {!detail ? <Link className="text-brand-700 underline" to={`${basePath(role, kind)}/${item.id}`}>Chi tiết #{item.id}</Link> : null}
          {role === "candidate" ? <Link className="text-brand-700 underline" to={`/candidate/jobs/${item.jobId}`}>Xem công việc và ứng tuyển</Link> : null}
          {availableActions(role, item, now).map(target => <Button key={target} variant={target === "CANCELLED" || target === "DECLINED" ? "secondary" : "primary"} disabled={mutation.pending || stale} onClick={() => open(item, target)}>{actionLabels[target]}</Button>)}
        </div>
      </Card>)}</div>}
      {!detail ? <Pagination page={query.data?.page ?? page} totalPages={query.data?.totalPages ?? 1} onPageChange={onPage} /> : null}
    </>}
    <Modal open={Boolean(action)} title="Xác nhận thao tác" onClose={() => { if (!mutation.pending) setAction(null); }}>
      {action ? <><p className="mb-4 text-sm leading-6">Bạn đang chọn <strong>{actionLabels[action.target]}</strong> cho hồ sơ #{action.captured.id}, từ trạng thái đã tải: <strong>{labels[action.captured.status] ?? action.captured.status}</strong>.</p>
        {mutation.error ? <ErrorState message={mutation.error} /> : null}
        {stale ? <p className="mt-3 text-sm">Dữ liệu đã xác nhận vẫn được giữ. Tải lại sẽ đóng thao tác chưa thực hiện; hãy kiểm tra trạng thái mới rồi chọn lại.</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={mutation.pending} onClick={() => setAction(null)}>Đóng</Button>{stale ? <Button disabled={mutation.pending} onClick={onReload}>Tải lại trạng thái</Button> : <Button loading={mutation.pending} onClick={send}>Xác nhận thực hiện</Button>}</div></> : null}
    </Modal>
  </>;
}
