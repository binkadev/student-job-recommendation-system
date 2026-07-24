import { Bell, CheckCircle2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type NotificationTab = "all" | "unread";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface UnreadCountResponse {
  unreadCount: number;
}

const pageSize = 10;

export function CandidateNotificationsPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [type, setType] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const notificationsQuery = useAsyncData(() => getNotifications(page), [page, reloadKey]);
  const unreadQuery = useAsyncData(() => getUnreadCount(), [reloadKey]);
  const result = notificationsQuery.data;
  const notifications = useMemo(() => {
    return (result?.items ?? [])
      .filter((notification) => (tab === "unread" ? !notification.isRead : true))
      .filter((notification) => (!type ? true : notification.type === type));
  }, [result?.items, tab, type]);

  async function markRead(notification: NotificationResponse) {
    if (notification.isRead) return;
    await markNotificationRead(notification.id);
    setReloadKey((current) => current + 1);
  }

  async function markAllRead() {
    await markAllNotificationsRead();
    setReloadKey((current) => current + 1);
    showToast({ type: "success", title: "Đã đánh dấu tất cả đã đọc" });
  }

  if (notificationsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (notificationsQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={notificationsQuery.error} />
      </PageContainer>
    );
  }

  const unreadCount = unreadQuery.data?.unreadCount ?? 0;

  return (
    <PageContainer>
      <PageHeader title="Thông báo" description={`Bạn có ${unreadCount} thông báo chưa đọc từ API backend.`} />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={[
              { label: "Tất cả", value: "all" },
              { label: `Chưa đọc (${unreadCount})`, value: "unread" },
            ]}
            value={tab}
            onChange={(value) => setTab(value as NotificationTab)}
          />
          <div className="flex flex-wrap gap-2">
            <Select
              label="Loại thông báo"
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={[
                { label: "Tất cả", value: "" },
                ...Array.from(new Set((result?.items ?? []).map((notification) => notification.type))).map((value) => ({ label: value, value })),
              ]}
            />
            <Button variant="secondary" className="self-end" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
        </div>
      </Card>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState message="Không có thông báo phù hợp." />
        </Card>
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onOpen={() => void markRead(notification)} onMarkRead={() => void markRead(notification)} />
          ))}
        </div>
      )}

      <div className="mt-5">
        <Pagination page={result?.page ?? page} totalPages={result?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </PageContainer>
  );
}

function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationResponse;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const targetPath = resolveNotificationPath(notification);
  return (
    <Card className={notification.isRead ? "" : "border-brand-200 bg-brand-50/40"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link to={targetPath} onClick={onOpen} className="flex min-w-0 flex-1 gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${notification.isRead ? "bg-slate-100 text-slate-600" : "bg-brand-600 text-white"}`}>
            {notification.referenceType === "APPLICATION" ? <Send size={18} /> : <Bell size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-950">{notification.title}</h2>
              <StatusBadge label={notification.type} />
              <StatusBadge label={notification.isRead ? "Đã đọc" : "Chưa đọc"} tone={notification.isRead ? "neutral" : "warning"} />
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
          </div>
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={targetPath} onClick={onOpen}><Button variant="secondary" size="sm">Mở</Button></Link>
          <Button variant="secondary" size="sm" icon={<CheckCircle2 size={16} />} onClick={onMarkRead} disabled={notification.isRead}>Đánh dấu đã đọc</Button>
        </div>
      </div>
    </Card>
  );
}

async function getNotifications(page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<NotificationResponse>>>("/notifications", {
    params: { page, size: pageSize },
  });
  return response.data.data;
}

async function getUnreadCount() {
  const response = await httpClient.get<ApiResponse<UnreadCountResponse>>("/notifications/unread-count");
  return response.data.data;
}

async function markNotificationRead(id: number) {
  await httpClient.patch<ApiResponse<NotificationResponse>>(`/notifications/${id}/read`);
}

async function markAllNotificationsRead() {
  await httpClient.patch<ApiResponse<null>>("/notifications/read-all");
}

function resolveNotificationPath(notification: NotificationResponse) {
  if (notification.referenceType === "APPLICATION" && notification.referenceId) return `/candidate/applications/${notification.referenceId}`;
  if (notification.referenceType === "JOB" && notification.referenceId) return `/candidate/jobs/${notification.referenceId}`;
  return "/candidate/notifications";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
