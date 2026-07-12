import { Bell, BriefcaseBusiness, CalendarDays, FileText, Mail, MessageSquare, Send, Settings, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockNotificationService } from "../../services/mock";
import type { AppNotification, NotificationType } from "../../types/domain";

type NotificationTab = "all" | "unread";

const notificationTypeLabels: Record<NotificationType, string> = {
  application: "Ứng tuyển",
  interview: "Phỏng vấn",
  job: "Việc làm",
  invitation: "Lời mời",
  message: "Tin nhắn",
  system: "Hệ thống",
  cv: "CV",
};

const notificationTypeIcons: Record<NotificationType, ReactNode> = {
  application: <Send size={18} />,
  interview: <CalendarDays size={18} />,
  job: <BriefcaseBusiness size={18} />,
  invitation: <Mail size={18} />,
  message: <MessageSquare size={18} />,
  system: <Settings size={18} />,
  cv: <FileText size={18} />,
};

const notificationOverrides: Record<string, Partial<AppNotification>> = {
  "notification-1": {
    title: "Có 5 việc làm mới phù hợp",
    body: "Các việc làm React mới đã được thêm vào danh sách gợi ý.",
    type: "job",
    targetPath: "/candidate/jobs/recommended",
  },
  "notification-2": {
    title: "CV đã phân tích xong",
    body: "CV Frontend của bạn đạt 82 điểm.",
    type: "cv",
    targetPath: "/candidate/cvs/cv-1/analysis",
  },
  "notification-3": {
    title: "Nhà tuyển dụng đã xem hồ sơ",
    body: "NovaTech vừa xem hồ sơ ứng tuyển Frontend Developer của bạn.",
    type: "application",
    targetPath: "/candidate/applications/app-1",
  },
  "notification-4": {
    title: "Lịch phỏng vấn được xác nhận",
    body: "Lịch phỏng vấn DevOps ngày 12/07 đã được xác nhận.",
    type: "interview",
    targetPath: "/candidate/interviews/interview-1",
  },
  "notification-5": {
    title: "Có lời mời ứng tuyển mới",
    body: "NovaTech gửi lời mời ứng tuyển vị trí Frontend Developer.",
    type: "invitation",
    targetPath: "/candidate/invitations/invitation-1",
  },
  "notification-6": {
    title: "Cập nhật hệ thống",
    body: "Hệ thống đã cập nhật chính sách bảo mật tài khoản ứng viên.",
    type: "system",
    targetPath: "/candidate/settings",
  },
  "notification-7": {
    title: "Tin nhắn mới từ nhà tuyển dụng",
    body: "Trần Thị Bình vừa gửi tin nhắn về vị trí Frontend Developer.",
    type: "message",
    targetPath: "/candidate/messages/conversation-1",
  },
  "notification-8": {
    title: "Gợi ý hoàn thiện hồ sơ",
    body: "Bạn nên bổ sung dự án cá nhân để tăng khả năng được gợi ý việc làm.",
    type: "system",
    targetPath: "/candidate/profile/edit",
  },
};

const extraNotifications: AppNotification[] = [
  {
    id: "notification-9",
    title: "Tin nhắn mới từ Phan Đức Tài",
    body: "Nhà tuyển dụng hỏi về thời gian bạn có thể phỏng vấn cho vị trí Mobile Developer.",
    type: "message",
    read: false,
    createdAt: "2026-07-10T10:15:00",
    targetPath: "/candidate/messages/conversation-5",
  },
];

export function CandidateNotificationsPage() {
  const { showToast } = useToast();
  const notificationsQuery = useAsyncData(() => mockNotificationService.getNotifications({ pageSize: 100 }), []);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [type, setType] = useState<NotificationType | "">("");
  const [confirmClearRead, setConfirmClearRead] = useState(false);

  useEffect(() => {
    if (notificationsQuery.data?.items) {
      setNotifications(mergeNotifications(notificationsQuery.data.items));
    }
  }, [notificationsQuery.data?.items]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((notification) => (tab === "unread" ? !notification.read : true))
      .filter((notification) => (!type ? true : notification.type === type))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [notifications, tab, type]);

  async function markRead(notification: AppNotification) {
    if (notification.read) return;
    const nextNotification = { ...notification, read: true };
    setNotifications((current) => current.map((item) => (item.id === notification.id ? nextNotification : item)));
    await mockNotificationService.updateNotification(notification.id, { read: true });
  }

  async function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    await Promise.all(notifications.filter((notification) => !notification.read).map((notification) => mockNotificationService.updateNotification(notification.id, { read: true })));
    showToast({ type: "success", title: "Đã đánh dấu tất cả đã đọc" });
  }

  async function deleteNotification(notification: AppNotification) {
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    await mockNotificationService.deleteNotification(notification.id);
    showToast({ type: "success", title: "Đã xóa thông báo" });
  }

  async function clearReadNotifications() {
    const readNotifications = notifications.filter((notification) => notification.read);
    setNotifications((current) => current.filter((notification) => !notification.read));
    await Promise.all(readNotifications.map((notification) => mockNotificationService.deleteNotification(notification.id)));
    setConfirmClearRead(false);
    showToast({ type: "success", title: "Đã xóa toàn bộ thông báo đã đọc" });
  }

  if (notificationsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Thông báo" description={`Bạn có ${unreadCount} thông báo chưa đọc. Lọc, đánh dấu đã đọc và mở nhanh các route liên quan.`} />

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
              onChange={(event) => setType(event.target.value as NotificationType | "")}
              options={[
                { label: "Tất cả", value: "" },
                { label: "Ứng tuyển", value: "application" },
                { label: "Phỏng vấn", value: "interview" },
                { label: "Việc làm", value: "job" },
                { label: "Lời mời", value: "invitation" },
                { label: "Tin nhắn", value: "message" },
                { label: "Hệ thống", value: "system" },
              ]}
            />
            <Button variant="secondary" className="self-end" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
              Đánh dấu tất cả đã đọc
            </Button>
            <Button variant="danger" className="self-end" icon={<Trash2 size={16} />} onClick={() => setConfirmClearRead(true)} disabled={!notifications.some((notification) => notification.read)}>
              Xóa đã đọc
            </Button>
          </div>
        </div>
      </Card>

      {filteredNotifications.length === 0 ? (
        <Card>
          <EmptyState message="Không có thông báo phù hợp." />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredNotifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onOpen={() => void markRead(notification)} onMarkRead={() => void markRead(notification)} onDelete={() => void deleteNotification(notification)} />
          ))}
        </div>
      )}

      <Modal open={confirmClearRead} title="Xóa thông báo đã đọc" onClose={() => setConfirmClearRead(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-700">Bạn có chắc muốn xóa toàn bộ thông báo đã đọc? Thao tác này sẽ cập nhật dữ liệu localStorage.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmClearRead(false)}>Hủy</Button>
            <Button variant="danger" onClick={() => void clearReadNotifications()}>Xóa đã đọc</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}

function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  notification: AppNotification;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const typeLabel = notificationTypeLabels[notification.type];
  return (
    <Card className={notification.read ? "" : "border-brand-200 bg-brand-50/40"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link to={notification.targetPath} onClick={onOpen} className="flex min-w-0 flex-1 gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${notification.read ? "bg-slate-100 text-slate-600" : "bg-brand-600 text-white"}`}>
            {notificationTypeIcons[notification.type] ?? <Bell size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-950">{notification.title}</h2>
              <StatusBadge label={typeLabel} />
              <StatusBadge label={notification.read ? "Đã đọc" : "Chưa đọc"} tone={notification.read ? "neutral" : "warning"} />
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
            <p className="mt-1 text-xs text-brand-700">Route: {notification.targetPath}</p>
          </div>
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={notification.targetPath} onClick={onOpen}><Button variant="secondary" size="sm">Mở</Button></Link>
          <Button variant="secondary" size="sm" onClick={onMarkRead} disabled={notification.read}>Đánh dấu đã đọc</Button>
          <Button variant="danger" size="sm" onClick={onDelete}>Xóa</Button>
        </div>
      </div>
    </Card>
  );
}

function mergeNotifications(items: AppNotification[]) {
  const normalized = items.map((notification) => ({
    ...notification,
    ...notificationOverrides[notification.id],
  }));
  const existingIds = new Set(normalized.map((notification) => notification.id));
  return [...normalized, ...extraNotifications.filter((notification) => !existingIds.has(notification.id))];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
