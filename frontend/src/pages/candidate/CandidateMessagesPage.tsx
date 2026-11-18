import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { Pagination } from "../../components/common/Pagination";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Textarea } from "../../components/ui/Textarea";
import {
  accessFailure,
  contentError,
  findConversation,
  historyPage,
  listConversations,
  markRead,
  messagingError,
  positiveId,
  sendMessage,
  type Message,
  type MessagingRole,
} from "../../features/messaging/messagingApi";
import { useMessagingQuery } from "../../features/messaging/useMessagingQuery";
import { formatWallTime } from "../../features/recruiting/recruitingTime";
import { useRecruitingMutation } from "../../features/recruiting/useRecruitingRequest";
import { useAuth } from "../../hooks/useAuth";
import { sessionVersion } from "../../services/auth/sessionVersion";

export function CandidateMessagesPage({ role = "candidate" }: { role?: MessagingRole }) {
  const auth = useAuth();
  const location = useLocation();
  const recovery = (
    <Link
      className="text-brand-700 underline"
      to={role === "recruiter" ? "/recruiter/candidates" : "/candidate/applications"}
    >
      Xem đơn ứng tuyển
    </Link>
  );

  if (auth.isInitializing) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (!auth.isAuthenticated || !auth.currentUser || auth.currentRole !== role) {
    return (
      <PageContainer>
        <ErrorState message="Bạn không có quyền truy cập chức năng tin nhắn." />
        {recovery}
      </PageContainer>
    );
  }

  return (
    <Workspace
      key={`${auth.currentUser.id}:${sessionVersion()}:${role}:${location.pathname}`}
      role={role}
    />
  );
}

function Workspace({ role }: { role: MessagingRole }) {
  const { conversationId } = useParams();

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <MessageSquare className="h-3.5 w-3.5 text-teal-300" />
                <span>TRAO ĐỔI TUYỂN DỤNG</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Tin nhắn
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Trao đổi riêng tư theo từng đơn ứng tuyển. Tải lại để xem cập nhật; hệ thống không cập nhật thời gian thực.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={role === "recruiter" ? "/recruiter/candidates" : "/candidate/applications"}
              >
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  Xem đơn ứng tuyển
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {conversationId === undefined ? (
          <ConversationList role={role} />
        ) : positiveId(Number(conversationId)) ? (
          <ConversationDetail id={Number(conversationId)} role={role} />
        ) : (
          <ErrorState message="Mã hội thoại không hợp lệ." />
        )}

        <div className="pt-2">
          <Link
            className="text-sm font-medium text-brand-700 underline"
            to={role === "candidate" ? "/candidate/applications" : "/recruiter/candidates"}
          >
            Xem đơn ứng tuyển
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}

function ConversationList({ role }: { role: MessagingRole }) {
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const query = useMessagingQuery((signal) => listConversations(page, 10, signal), [page, reload]);

  return (
    <div className="space-y-4">
      <Button
        variant="secondary"
        className="rounded-xl border-slate-200"
        disabled={query.loading}
        onClick={() => setReload((value) => value + 1)}
      >
        Tải lại hội thoại
      </Button>

      {query.loading ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState message={query.error} />
      ) : query.data ? (
        <>
          {!query.data.items.length ? (
            <Card className="border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
              <EmptyState message="Chưa có hội thoại trong trang này. Chọn Nhắn tin từ đơn ứng tuyển để bắt đầu." />
            </Card>
          ) : (
            <div className="grid gap-4">
              {query.data.items.map((item) => (
                <Card
                  key={item.id}
                  className="border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md rounded-2xl"
                >
                  <h2 className="text-lg font-bold text-slate-950">
                    <Link className="text-brand-700 hover:underline" to={`/${role}/messages/${item.id}`}>
                      Hội thoại #{item.id}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm text-slate-700">
                    Đơn ứng tuyển #{item.applicationId} · Công việc #{item.jobId} ·{" "}
                    {role === "candidate" ? `Công ty #${item.companyId}` : `Sinh viên #${item.studentId}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Hoạt động gần nhất: {formatWallTime(item.lastMessageAt ?? item.createdAt)}
                  </p>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              onPageChange={setPage}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ConversationDetail({ id, role }: { id: number; role: MessagingRole }) {
  const [reload, setReload] = useState(0);
  const query = useMessagingQuery((signal) => findConversation(id, signal), [id, reload]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
          to={`/${role}/messages`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Danh sách hội thoại</span>
        </Link>
        {!query.data ? (
          <Button
            variant="secondary"
            className="rounded-xl"
            disabled={query.loading}
            onClick={() => setReload((value) => value + 1)}
          >
            Tải lại hội thoại
          </Button>
        ) : null}
      </div>

      {query.loading ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState message={query.error} />
      ) : query.data ? (
        <>
          <Card className="border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
            <h2 className="text-lg font-bold text-slate-950">Hội thoại #{query.data.id}</h2>
            <p className="mt-2 text-sm text-slate-700">
              Công ty #{query.data.companyId} · Sinh viên #{query.data.studentId} · Công việc #{query.data.jobId}
            </p>
            <Link
              className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline"
              to={
                role === "candidate"
                  ? `/candidate/applications/${query.data.applicationId}`
                  : `/recruiter/candidates/${query.data.applicationId}`
              }
            >
              Xem đơn ứng tuyển #{query.data.applicationId}
            </Link>
          </Card>
          <History key={id} id={id} role={role} />
        </>
      ) : null}
    </div>
  );
}

function History({ id, role }: { id: number; role: MessagingRole }) {
  const [page, setPage] = useState<number | "latest">(1);
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState("");
  const [validation, setValidation] = useState("");
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [uncertainAt, setUncertainAt] = useState(-1);
  const [denied, setDenied] = useState(false);
  const [confirmed, setConfirmed] = useState<Message | null>(null);
  const mutation = useRecruitingMutation();

  const query = useMessagingQuery(
    async (signal) => {
      const result = await historyPage(id, page, signal);
      return { ...result, refresh: reload };
    },
    [id, page, reload],
  );

  const ownRole = role === "candidate" ? "STUDENT" : "COMPANY";

  function refresh(latest = false) {
    if (mutation.pending) return;
    if (latest || uncertain) setPage("latest");
    setReload((value) => value + 1);
  }

  function send() {
    const invalid = contentError(draft);
    setValidation(invalid);
    if (invalid || uncertain || denied || query.loading || query.error) return;
    setFailure("");
    setNotice("");
    void mutation.run(
      (signal) => sendMessage(id, draft, signal),
      (message) => {
        setConfirmed(message);
        setDraft("");
        setNotice("Tin nhắn đã được hệ thống xác nhận gửi.");
        setPage("latest");
        setReload((value) => value + 1);
      },
      (error) => {
        if (accessFailure(error)) {
          setDenied(true);
          setConfirmed(null);
          setFailure(messagingError(error));
        } else {
          setUncertain(true);
          setUncertainAt(reload);
          setFailure(
            "Chưa xác nhận được tin nhắn đã gửi. Tin có thể đã được lưu. Bản nháp vẫn được giữ; hãy tải lại lịch sử và kiểm tra trước khi quyết định gửi lại. Hệ thống không tự gửi lại.",
          );
        }
      },
    );
  }

  function read() {
    setFailure("");
    setNotice("");
    void mutation.run(
      (signal) => markRead(id, signal),
      (result) => {
        setNotice(`Đã đánh dấu ${result.markedCount} tin nhắn đến là đã đọc trong hội thoại này.`);
        setPage(query.data?.page ?? page);
        setReload((value) => value + 1);
      },
      (error) => {
        setFailure(messagingError(error));
        if (accessFailure(error)) {
          setDenied(true);
          setConfirmed(null);
        }
      },
    );
  }

  if (denied) return <ErrorState message={failure} />;

  return (
    <div className="space-y-4">
      <Card className="border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="secondary"
            className="rounded-xl border-slate-200"
            disabled={query.loading || mutation.pending}
            onClick={() => refresh()}
          >
            Tải lại lịch sử
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl border-slate-200"
            disabled={query.loading || mutation.pending}
            onClick={() => refresh(true)}
          >
            Đến trang mới nhất
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl border-slate-200"
            disabled={query.loading || Boolean(query.error) || mutation.pending}
            onClick={read}
          >
            Đánh dấu đã đọc
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Tin nhắn xếp từ cũ đến mới. Đánh dấu đã đọc chỉ áp dụng cho tin đến trong hội thoại, kể cả các trang khác.
        </p>
      </Card>

      {notice ? <p role="status" className="text-xs font-semibold text-emerald-800">{notice}</p> : null}
      {failure ? <ErrorState message={failure} /> : null}
      {uncertain ? (
        <p className="text-xs text-slate-700 font-medium">
          Tải lại lịch sử sẽ mở trang mới nhất để bạn kiểm tra trước khi gửi lại.
        </p>
      ) : null}

      {query.loading ? (
        <LoadingState />
      ) : query.error ? (
        <ErrorState message={query.error} />
      ) : query.data ? (
        <section aria-label="Lịch sử tin nhắn" className="space-y-4">
          {!query.data.items.length ? (
            <Card className="border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
              <EmptyState message="Chưa có tin nhắn trong trang này." />
            </Card>
          ) : (
            <ol className="space-y-3">
              {query.data.items.map((message) => (
                <li key={message.id}>
                  <MessageBubble message={message} ownRole={ownRole} />
                </li>
              ))}
            </ol>
          )}

          <div className="my-4 flex justify-center">
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              onPageChange={(next) => {
                if (!mutation.pending) setPage(next);
              }}
            />
          </div>
        </section>
      ) : null}

      {confirmed && !query.data?.items.some((item) => item.id === confirmed.id) ? (
        <Card className="border border-emerald-200 bg-emerald-50/50 p-4 rounded-2xl">
          <p className="mb-2 text-xs font-bold text-emerald-900">Tin nhắn vừa gửi đã được xác nhận</p>
          <MessageBubble message={confirmed} ownRole={ownRole} />
        </Card>
      ) : null}

      <Card className="border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <Textarea
            label="Nội dung tin nhắn"
            value={draft}
            disabled={mutation.pending}
            rows={4}
            error={validation}
            aria-describedby="message-guidance"
            placeholder="Nhập nội dung tin nhắn..."
            onChange={(event) => {
              setDraft(event.target.value);
              setValidation("");
            }}
          />
          <p id="message-guidance" className="mt-2 text-xs text-slate-500">
            {draft.length}/5.000 ký tự UTF-16. Không chỉ khoảng trắng, không chứa NUL. Nội dung được gửi nguyên văn.
          </p>

          {uncertain && query.data?.refresh === reload && reload > uncertainAt && !query.loading && !query.error ? (
            <Button
              className="mt-3 rounded-xl"
              variant="secondary"
              onClick={() => {
                setUncertain(false);
                setFailure("");
              }}
            >
              Tôi đã kiểm tra lịch sử, cho phép gửi lại
            </Button>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
              loading={mutation.pending}
              disabled={uncertain || query.loading || Boolean(query.error)}
              icon={<Send className="h-4 w-4" />}
            >
              Gửi tin nhắn
            </Button>
            <p className="text-xs text-slate-500">Không gửi email hoặc cập nhật thời gian thực.</p>
          </div>
        </form>
      </Card>
    </div>
  );
}

function MessageBubble({ message, ownRole }: { message: Message; ownRole: Message["senderRole"] }) {
  const own = message.senderRole === ownRole;
  return (
    <article
      className={`max-w-3xl rounded-2xl border p-4 shadow-sm transition-all ${
        own
          ? "ml-auto border-teal-200 bg-teal-50/70"
          : "mr-auto border-slate-200/80 bg-white"
      }`}
      aria-label={`Tin nhắn ${own ? "đã gửi" : "đã nhận"} #${message.id}`}
    >
      <p className="font-bold text-slate-950">
        {own ? "Bạn" : message.senderRole === "COMPANY" ? "Nhà tuyển dụng" : "Sinh viên"}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-900 [overflow-wrap:anywhere]">
        {message.content}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        <time dateTime={message.createdAt}>{formatWallTime(message.createdAt)}</time> ·{" "}
        {own
          ? message.isRead
            ? "Người nhận đã đọc"
            : "Chưa xác nhận người nhận đã đọc"
          : message.isRead
            ? "Bạn đã đánh dấu đã đọc"
            : "Chưa đánh dấu đã đọc"}
      </p>
    </article>
  );
}
