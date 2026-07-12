import { ArrowLeft, Paperclip, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockMessageService } from "../../services/mock";
import type { Conversation, Message } from "../../types/domain";

const currentCandidateName = "Nguyễn Văn An";

const conversationMetadata: Record<string, { companyName: string; position: string; online: boolean; participantName?: string; subject?: string }> = {
  "conversation-1": {
    participantName: "Trần Thị Bình",
    companyName: "Công ty TNHH Công nghệ NovaTech",
    position: "Frontend Developer",
    subject: "Trao đổi vị trí Frontend Developer",
    online: true,
  },
  "conversation-2": {
    participantName: "Đỗ Quốc Huy",
    companyName: "Công ty Cổ phần FinPlus",
    position: "Backend Developer",
    subject: "Lịch phỏng vấn Backend Developer",
    online: false,
  },
  "conversation-3": {
    participantName: "Nguyễn Kim Oanh",
    companyName: "Công ty Cổ phần EcomHub",
    position: "QA Engineer",
    subject: "CV QA Engineer",
    online: true,
  },
  "conversation-4": {
    participantName: "Quản trị viên",
    companyName: "Hệ thống",
    position: "Xác minh tài khoản",
    subject: "Thông báo xác minh tài khoản",
    online: false,
  },
  "conversation-5": {
    participantName: "Phan Đức Tài",
    companyName: "MobiOne",
    position: "Mobile Developer",
    subject: "Lời mời ứng tuyển Mobile Developer",
    online: true,
  },
};

const messageTextOverrides: Record<string, Partial<Message>> = {
  "msg-1": { senderName: "Trần Thị Bình", body: "Chào An, công ty muốn trao đổi thêm về kinh nghiệm React của bạn." },
  "msg-2": { senderName: "Nguyễn Văn An", body: "Em sẵn sàng trao đổi thêm ạ." },
  "msg-3": { senderName: "Đỗ Quốc Huy", body: "Bạn xác nhận lịch phỏng vấn ngày 14/07 giúp mình nhé." },
  "msg-4": { senderName: "Nguyễn Kim Oanh", body: "Bạn vui lòng gửi thêm portfolio test case nếu có." },
  "msg-5": { senderName: "Quản trị viên", body: "Tài khoản của bạn đã được xác minh email." },
  "msg-6": { senderName: "Phan Đức Tài", body: "Hồ sơ Flutter của bạn rất phù hợp với nhóm mobile." },
  "msg-7": { senderName: "Phan Đức Tài", body: "Bạn có thể tham gia phỏng vấn tuần tới không?" },
};

export function CandidateMessagesPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const conversationsQuery = useAsyncData(() => mockMessageService.getConversations({ pageSize: 50 }), []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (conversationsQuery.data?.items) setConversations(conversationsQuery.data.items.map(normalizeConversation));
  }, [conversationsQuery.data?.items]);

  const filteredConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const metadata = getConversationMetadata(conversation);
      return !keyword || `${conversation.participantName} ${metadata.companyName} ${metadata.position} ${conversation.subject}`.toLowerCase().includes(keyword);
    });
  }, [conversations, query]);

  const selectedConversation = conversations.find((conversation) => conversation.id === conversationId) ?? null;

  useEffect(() => {
    if (!selectedConversation || selectedConversation.unreadCount === 0) return;
    void markConversationAsRead(selectedConversation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages.length, conversationId]);

  async function updateConversation(nextConversation: Conversation) {
    setConversations((current) => current.map((conversation) => (conversation.id === nextConversation.id ? nextConversation : conversation)));
    await mockMessageService.updateConversation(nextConversation.id, nextConversation);
  }

  async function markConversationAsRead(conversation: Conversation) {
    const nextConversation = {
      ...conversation,
      unreadCount: 0,
      messages: conversation.messages.map((message) => ({ ...message, read: true })),
    };
    await updateConversation(nextConversation);
  }

  function selectConversation(conversation: Conversation) {
    navigate(`/candidate/messages/${conversation.id}`);
    if (conversation.unreadCount > 0) void markConversationAsRead(conversation);
  }

  async function sendMessage() {
    if (!selectedConversation) return;
    const content = body.trim();
    if (!content) {
      showToast({ type: "error", title: "Không thể gửi tin nhắn rỗng" });
      return;
    }
    const message: Message = {
      id: `msg-${Date.now()}`,
      conversationId: selectedConversation.id,
      senderName: currentCandidateName,
      body: content,
      sentAt: new Date().toISOString(),
      read: false,
    };
    await updateConversation({ ...selectedConversation, messages: [...selectedConversation.messages, message], unreadCount: 0 });
    setBody("");
    showToast({ type: "success", title: "Đã gửi tin nhắn" });
  }

  async function sendFakeAttachment() {
    if (!selectedConversation) return;
    const message: Message = {
      id: `msg-file-${Date.now()}`,
      conversationId: selectedConversation.id,
      senderName: currentCandidateName,
      body: "[Tệp đính kèm] Nguyen-Van-An-CV.pdf",
      sentAt: new Date().toISOString(),
      read: false,
    };
    await updateConversation({ ...selectedConversation, messages: [...selectedConversation.messages, message], unreadCount: 0 });
    showToast({ type: "success", title: "Đã gửi file giả lập" });
  }

  if (conversationsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Tin nhắn" description="Trao đổi với nhà tuyển dụng, gửi tin nhắn, đính kèm file giả lập và đánh dấu hội thoại đã đọc." />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className={conversationId ? "hidden lg:block" : "block"}>
          <ConversationList
            conversations={filteredConversations}
            selectedConversationId={conversationId}
            query={query}
            onQueryChange={setQuery}
            onSelect={selectConversation}
          />
        </div>

        <div className={conversationId ? "block" : "hidden lg:block"}>
          <ConversationThread
            conversation={selectedConversation}
            body={body}
            threadEndRef={threadEndRef}
            onBack={() => navigate("/candidate/messages")}
            onBodyChange={setBody}
            onSend={() => void sendMessage()}
            onAttach={() => void sendFakeAttachment()}
          />
        </div>
      </div>
    </PageContainer>
  );
}

function ConversationList({
  conversations,
  selectedConversationId,
  query,
  onQueryChange,
  onSelect,
}: {
  conversations: Conversation[];
  selectedConversationId?: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (conversation: Conversation) => void;
}) {
  return (
    <Card>
      <Input label="Tìm cuộc trò chuyện" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Recruiter, công ty, vị trí..." />
      <div className="mt-4 space-y-2">
        {conversations.length === 0 ? (
          <EmptyState message={query ? "Không tìm thấy kết quả search." : "Chưa có cuộc trò chuyện."} />
        ) : (
          conversations.map((conversation) => {
            const metadata = getConversationMetadata(conversation);
            const lastMessage = conversation.messages[conversation.messages.length - 1];
            return (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={`block w-full rounded-lg border p-3 text-left text-sm transition hover:bg-slate-50 ${selectedConversationId === conversation.id ? "border-brand-200 bg-brand-50" : "border-slate-200"}`}
              >
                <div className="flex gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700">
                    {getAvatar(conversation.participantName)}
                    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${metadata.online ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{conversation.participantName}</p>
                        <p className="truncate text-xs text-slate-500">{metadata.companyName} · {metadata.position}</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">{lastMessage ? formatConversationTime(lastMessage.sentAt) : ""}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-slate-600">{lastMessage?.body ?? conversation.subject}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <StatusBadge label={metadata.online ? "Online" : "Offline"} tone={metadata.online ? "success" : "neutral"} />
                      {conversation.unreadCount ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{conversation.unreadCount}</span> : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}

function ConversationThread({
  conversation,
  body,
  threadEndRef,
  onBack,
  onBodyChange,
  onSend,
  onAttach,
}: {
  conversation: Conversation | null;
  body: string;
  threadEndRef: Ref<HTMLDivElement>;
  onBack: () => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  onAttach: () => void;
}) {
  if (!conversation) {
    return (
      <Card>
        <EmptyState message="Chưa chọn conversation." />
      </Card>
    );
  }

  const metadata = getConversationMetadata(conversation);
  const groupedMessages = groupMessagesByDate(conversation.messages);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <Card>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <Button className="lg:hidden" variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={onBack}>Quay lại</Button>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700">{getAvatar(conversation.participantName)}</div>
          <div>
            <h2 className="font-semibold text-slate-950">{conversation.participantName}</h2>
            <p className="text-sm text-slate-600">{metadata.companyName} · {metadata.position}</p>
          </div>
        </div>
        <StatusBadge label={metadata.online ? "Online" : "Offline"} tone={metadata.online ? "success" : "neutral"} />
      </header>

      <div className="mt-4 h-[52vh] overflow-y-auto rounded-lg bg-slate-50 p-4">
        {Object.entries(groupedMessages).map(([day, messages]) => (
          <div key={day}>
            <div className="my-4 flex justify-center">
              <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm">{day}</span>
            </div>
            <div className="space-y-3">
              {messages.map((message) => {
                const own = message.senderName === currentCandidateName;
                return (
                  <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-lg p-3 text-sm shadow-sm ${own ? "bg-brand-600 text-white" : "bg-white text-slate-700"}`}>
                      <p className="whitespace-pre-line">{message.body}</p>
                      <p className="mt-1 text-xs opacity-75">
                        {formatTime(message.sentAt)} · {own ? (message.read ? "Đã đọc" : "Đã gửi") : message.senderName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={threadEndRef} />
      </div>

      <div className="mt-4 space-y-3">
        <Textarea
          label="Tin nhắn mới"
          value={body}
          onChange={(event) => onBodyChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhấn Enter để gửi, Shift + Enter để xuống dòng"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" icon={<Paperclip size={16} />} onClick={onAttach}>Đính kèm file</Button>
          <Button icon={<Send size={16} />} onClick={onSend}>Gửi</Button>
        </div>
      </div>
    </Card>
  );
}

function normalizeConversation(conversation: Conversation): Conversation {
  const metadata = getConversationMetadata(conversation);
  return {
    ...conversation,
    participantName: metadata.participantName ?? conversation.participantName,
    subject: metadata.subject ?? conversation.subject,
    messages: conversation.messages.map((message) => ({ ...message, ...messageTextOverrides[message.id] })),
  };
}

function getConversationMetadata(conversation: Conversation) {
  return conversationMetadata[conversation.id] ?? {
    companyName: "Nhà tuyển dụng",
    position: conversation.subject,
    online: false,
  };
}

function getAvatar(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function groupMessagesByDate(messages: Message[]) {
  return messages.reduce<Record<string, Message[]>>((groups, message) => {
    const day = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(message.sentAt));
    groups[day] = [...(groups[day] ?? []), message];
    return groups;
  }, {});
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatConversationTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
