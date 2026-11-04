import { httpClient } from "../../services/api/httpClient";

export const notificationTypes = {
  APPLICATION_STATUS_CHANGED: "Trạng thái ứng tuyển",
  JOB_STATUS_CHANGED: "Trạng thái việc làm",
  SYSTEM: "Hệ thống",
  RECOMMENDATION: "Gợi ý việc làm",
};
export interface Notification {
  id: number; type: keyof typeof notificationTypes; title: string; message: string;
  referenceType: string | null; referenceId: number | null; isRead: boolean;
  readAt: string | null; createdAt: string;
}
export interface NotificationPage {
  items: Notification[]; page: number; size: number; totalItems: number; totalPages: number;
}
export const NOTIFICATIONS_CHANGED = "job-system:notifications-invalidated";
export async function listNotifications(page: number, unread: boolean, type: string) {
  return (await httpClient.get<{ data: NotificationPage }>("/notifications", {
    params: { page, size: 10, ...(unread ? { unread: true } : {}), ...(type ? { type } : {}) },
  })).data.data;
}
export async function unreadCount() {
  return (await httpClient.get<{ data: { unreadCount: number } }>("/notifications/unread-count")).data.data.unreadCount;
}
export async function markRead(id?: number) {
  await httpClient.patch(id === undefined ? "/notifications/read-all" : `/notifications/${id}/read`);
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
export function notificationPath(notification: Notification, role: "candidate" | "recruiter") {
  const id = notification.referenceId;
  if (!id || !Number.isSafeInteger(id) || id < 1) return role === "candidate" ? "/candidate/notifications" : "/recruiter/settings/notifications";
  if (notification.referenceType === "APPLICATION") return role === "candidate" ? `/candidate/applications/${id}` : `/recruiter/candidates/${id}`;
  if (notification.referenceType === "JOB") return `/${role}/jobs/${id}`;
  return role === "candidate" ? "/candidate/notifications" : "/recruiter/settings/notifications";
}
