import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../hooks/useAuth";
import { sessionVersion } from "../../services/auth/sessionVersion";
import { useRecruitingMutation } from "../../features/recruiting/useRecruitingRequest";
import { formatWallTime } from "../../features/recruiting/recruitingTime";
import { useMessagingQuery } from "../../features/messaging/useMessagingQuery";
import { accessFailure, contentError, findConversation, historyPage, listConversations, markRead, messagingError, positiveId, sendMessage, type Message, type MessagingRole } from "../../features/messaging/messagingApi";

export function CandidateMessagesPage({ role = "candidate" }: { role?: MessagingRole }) {
  const auth = useAuth(), location = useLocation();
  const recovery = <Link className="text-brand-700 underline" to={role === "recruiter" ? "/recruiter/candidates" : "/candidate/applications"}>Xem đơn ứng tuyển</Link>;
  if (auth.isInitializing) return <PageContainer><LoadingState /></PageContainer>;
  if (!auth.isAuthenticated || !auth.currentUser || auth.currentRole !== role) return <PageContainer><ErrorState message="Bạn không có quyền truy cập chức năng tin nhắn." />{recovery}</PageContainer>;
  return <Workspace key={`${auth.currentUser.id}:${sessionVersion()}:${role}:${location.pathname}`} role={role} />;
}
function Workspace({ role }: { role: MessagingRole }) {
  const { conversationId } = useParams();
  return <PageContainer>
    <PageHeader title="Tin nhắn" description="Trao đổi riêng tư theo từng đơn ứng tuyển. Tải lại để xem cập nhật; hệ thống không cập nhật thời gian thực." />
    {conversationId === undefined ? <ConversationList role={role} /> : positiveId(Number(conversationId)) ? <ConversationDetail id={Number(conversationId)} role={role} /> : <ErrorState message="Mã hội thoại không hợp lệ." />}
    <Link className="mt-5 inline-block text-brand-700 underline" to={role === "candidate" ? "/candidate/applications" : "/recruiter/candidates"}>Xem đơn ứng tuyển</Link>
  </PageContainer>;
}
function ConversationList({ role }: { role: MessagingRole }) {
  const [page, setPage] = useState(1), [reload, setReload] = useState(0);
  const query = useMessagingQuery(signal => listConversations(page, 10, signal), [page, reload]);
  return <>
    <Button variant="secondary" className="mb-4" disabled={query.loading} onClick={() => setReload(value => value + 1)}>Tải lại hội thoại</Button>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} /> : query.data ? <>
      {!query.data.items.length ? <EmptyState message="Chưa có hội thoại trong trang này. Chọn Nhắn tin từ đơn ứng tuyển để bắt đầu." /> : <div className="grid gap-4">{query.data.items.map(item => <Card key={item.id}>
        <h2 className="text-lg font-semibold text-slate-950"><Link className="text-brand-700 underline" to={`/${role}/messages/${item.id}`}>Hội thoại #{item.id}</Link></h2>
        <p className="mt-2 text-sm text-slate-700">Đơn ứng tuyển #{item.applicationId} · Công việc #{item.jobId} · {role === "candidate" ? `Công ty #${item.companyId}` : `Sinh viên #${item.studentId}`}</p>
        <p className="mt-2 text-sm text-slate-600">Hoạt động gần nhất: {formatWallTime(item.lastMessageAt ?? item.createdAt)}</p>
      </Card>)}</div>}
      <div className="mt-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} onPageChange={setPage} /></div>
    </> : null}
  </>;
}
function ConversationDetail({ id, role }: { id: number; role: MessagingRole }) {
  const [reload, setReload] = useState(0);
  const query = useMessagingQuery(signal => findConversation(id, signal), [id, reload]);
  return <>
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <Link className="text-brand-700 underline" to={`/${role}/messages`}>Danh sách hội thoại</Link>
      {!query.data ? <Button variant="secondary" disabled={query.loading} onClick={() => setReload(value => value + 1)}>Tải lại hội thoại</Button> : null}
    </div>
    {query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} /> : query.data ? <>
      <Card className="mb-4"><h2 className="text-lg font-semibold text-slate-950">Hội thoại #{query.data.id}</h2>
        <p className="mt-2 text-sm text-slate-700">Công ty #{query.data.companyId} · Sinh viên #{query.data.studentId} · Công việc #{query.data.jobId}</p>
        <Link className="mt-2 inline-block text-brand-700 underline" to={role === "candidate" ? `/candidate/applications/${query.data.applicationId}` : `/recruiter/candidates/${query.data.applicationId}`}>Xem đơn ứng tuyển #{query.data.applicationId}</Link>
      </Card>
      <History key={id} id={id} role={role} />
    </> : null}
  </>;
}
function History({ id, role }: { id: number; role: MessagingRole }) {
  const [page, setPage] = useState<number | "latest">(1), [reload, setReload] = useState(0);
  const [draft, setDraft] = useState(""), [validation, setValidation] = useState("");
  const [notice, setNotice] = useState(""), [failure, setFailure] = useState("");
  const [uncertain, setUncertain] = useState(false), [uncertainAt, setUncertainAt] = useState(-1), [denied, setDenied] = useState(false);
  const [confirmed, setConfirmed] = useState<Message | null>(null);
  const mutation = useRecruitingMutation();
  const query = useMessagingQuery(async signal => {
    const result = await historyPage(id, page, signal);
    return { ...result, refresh: reload };
  }, [id, page, reload]);
  const ownRole = role === "candidate" ? "STUDENT" : "COMPANY";
  function refresh(latest = false) {
    if (mutation.pending) return;
    if (latest || uncertain) setPage("latest");
    setReload(value => value + 1);
  }
  function send() {
    const invalid = contentError(draft);
    setValidation(invalid);
    if (invalid || uncertain || denied || query.loading || query.error) return;
    setFailure(""); setNotice("");
    void mutation.run(signal => sendMessage(id, draft, signal), message => {
      setConfirmed(message); setDraft(""); setNotice("Tin nhắn đã được hệ thống xác nhận gửi.");
      setPage("latest"); setReload(value => value + 1);
    }, error => {
      if (accessFailure(error)) { setDenied(true); setConfirmed(null); setFailure(messagingError(error)); }
      else { setUncertain(true); setUncertainAt(reload); setFailure("Chưa xác nhận được tin nhắn đã gửi. Tin có thể đã được lưu. Bản nháp vẫn được giữ; hãy tải lại lịch sử và kiểm tra trước khi quyết định gửi lại. Hệ thống không tự gửi lại."); }
    });
  }
  function read() {
    setFailure(""); setNotice("");
    void mutation.run(signal => markRead(id, signal), result => {
      setNotice(`Đã đánh dấu ${result.markedCount} tin nhắn đến là đã đọc trong hội thoại này.`);
      // Keep the visible history page; authoritative GET supplies every read state.
      setPage(query.data?.page ?? page); setReload(value => value + 1);
    }, error => {
      setFailure(messagingError(error));
      if (accessFailure(error)) { setDenied(true); setConfirmed(null); }
    });
  }
  if (denied) return <ErrorState message={failure} />;
  return <>
    <Card className="mb-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={query.loading || mutation.pending} onClick={() => refresh()}>Tải lại lịch sử</Button>
        <Button variant="secondary" disabled={query.loading || mutation.pending} onClick={() => refresh(true)}>Đến trang mới nhất</Button>
        <Button variant="secondary" disabled={query.loading || Boolean(query.error) || mutation.pending} onClick={read}>Đánh dấu đã đọc</Button>
      </div>
      <p className="mt-3 text-sm text-slate-600">Tin nhắn xếp từ cũ đến mới. Đánh dấu đã đọc chỉ áp dụng cho tin đến trong hội thoại, kể cả các trang khác.</p>
    </Card>
    {notice ? <p role="status" className="mb-4 text-emerald-800">{notice}</p> : null}
    {failure ? <ErrorState message={failure} /> : null}
    {uncertain ? <p className="mb-4 text-sm text-slate-700">Tải lại lịch sử sẽ mở trang mới nhất để bạn kiểm tra trước khi gửi lại.</p> : null}
    {query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} /> : query.data ? <section aria-label="Lịch sử tin nhắn">
      {!query.data.items.length ? <EmptyState message="Chưa có tin nhắn trong trang này." /> : <ol className="space-y-4">{query.data.items.map(message => <li key={message.id}><MessageBubble message={message} ownRole={ownRole} /></li>)}</ol>}
      <div className="my-4"><Pagination page={query.data.page} totalPages={query.data.totalPages} onPageChange={next => { if (!mutation.pending) setPage(next); }} /></div>
    </section> : null}
    {confirmed && !query.data?.items.some(item => item.id === confirmed.id) ? <Card className="mb-4"><p className="mb-3 text-sm font-semibold">Tin nhắn vừa gửi đã được xác nhận</p><MessageBubble message={confirmed} ownRole={ownRole} /></Card> : null}
    <Card className="mt-4">
      <form onSubmit={event => { event.preventDefault(); send(); }}>
        <Textarea label="Nội dung tin nhắn" value={draft} disabled={mutation.pending} rows={4} error={validation} aria-describedby="message-guidance" onChange={event => { setDraft(event.target.value); setValidation(""); }} />
        <p id="message-guidance" className="mt-2 text-sm text-slate-600">{draft.length}/5.000 ký tự UTF-16. Không chỉ khoảng trắng, không chứa NUL. Nội dung được gửi nguyên văn.</p>
        {uncertain && query.data?.refresh === reload && reload > uncertainAt && !query.loading && !query.error ? <Button className="mt-3" variant="secondary" onClick={() => { setUncertain(false); setFailure(""); }}>Tôi đã kiểm tra lịch sử, cho phép gửi lại</Button> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="submit" loading={mutation.pending} disabled={uncertain || query.loading || Boolean(query.error)}>Gửi tin nhắn</Button><p className="text-sm text-slate-600">Không gửi email hoặc cập nhật thời gian thực.</p></div>
      </form>
    </Card>
  </>;
}
function MessageBubble({ message, ownRole }: { message: Message; ownRole: Message["senderRole"] }) {
  const own = message.senderRole === ownRole;
  return <article className={`max-w-3xl rounded-2xl border p-4 ${own ? "ml-auto border-brand-200 bg-brand-50" : "mr-auto border-slate-200 bg-white"}`} aria-label={`Tin nhắn ${own ? "đã gửi" : "đã nhận"} #${message.id}`}>
    <p className="font-semibold text-slate-900">{own ? "Bạn" : message.senderRole === "COMPANY" ? "Nhà tuyển dụng" : "Sinh viên"}</p>
    <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-900 [overflow-wrap:anywhere]">{message.content}</p>
    <p className="mt-3 text-xs leading-5 text-slate-600"><time dateTime={message.createdAt}>{formatWallTime(message.createdAt)}</time> · {own ? message.isRead ? "Người nhận đã đọc" : "Chưa xác nhận người nhận đã đọc" : message.isRead ? "Bạn đã đánh dấu đã đọc" : "Chưa đánh dấu đã đọc"}</p>
  </article>;
}
