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
  if (notification.referenceType === "RECOMMENDATION_RUN" && role === "candidate") return "/candidate/jobs/recommended";
  return role === "candidate" ? "/candidate/notifications" : "/recruiter/settings/notifications";
}

const APPLICATION_STATES: Record<string, string> = { PENDING: "Chờ xử lý", REVIEWED: "Đã xem xét", ACCEPTED: "Được chấp nhận", REJECTED: "Bị từ chối", WITHDRAWN: "Đã rút đơn" };
const TITLES: Record<string, string> = {
  "Application status updated": "Trạng thái ứng tuyển đã cập nhật",
  "New application received": "Có đơn ứng tuyển mới",
  "Application withdrawn": "Ứng viên đã rút đơn ứng tuyển",
  "Job approved": "Tin tuyển dụng đã được duyệt",
  "Job rejected": "Tin tuyển dụng bị từ chối",
  "Company verified": "Công ty đã được xác thực",
  "Company blocked": "Công ty đã bị khóa",
  "Job recommendations are ready": "Gợi ý việc làm đã sẵn sàng",
};
const MESSAGES: Record<string, string> = {
  "Your company account has been verified. You can now submit and publish jobs.": "Tài khoản công ty đã được xác thực. Bạn có thể gửi duyệt và đăng tin tuyển dụng.",
  "Your company account has been blocked by an administrator.": "Tài khoản công ty đã bị quản trị viên khóa.",
  "Your recommendation run finished, but no jobs met the matching threshold.": "Lượt gợi ý đã hoàn tất nhưng chưa có việc làm nào đạt ngưỡng phù hợp.",
};
/** Backend notification titles are stable English strings; unknown titles are shown unchanged. */
export function notificationTitle(value: string) { return TITLES[value] ?? value; }
/** Localises the known Backend message templates; unknown text is shown unchanged. */
export function notificationMessage(value: string) {
  if (MESSAGES[value]) return MESSAGES[value];
  let match = value.match(/^Your application for (.+) has been updated to ([A-Z_]+)\.?$/i);
  if (match) return `Đơn ứng tuyển cho ${match[1]} đã được cập nhật sang trạng thái ${APPLICATION_STATES[match[2]] ?? match[2]}.`;
  match = value.match(/^(.+) applied for (.+)\.$/);
  if (match) return `${match[1]} đã ứng tuyển vào ${match[2]}.`;
  match = value.match(/^(.+) withdrew the application for (.+)\.$/);
  if (match) return `${match[1]} đã rút đơn ứng tuyển vào ${match[2]}.`;
  match = value.match(/^Your job "(.+)" was approved and is now active\.$/);
  if (match) return `Tin "${match[1]}" đã được duyệt và đang hiển thị.`;
  match = value.match(/^Your job "(.+)" was rejected by an administrator\.$/);
  if (match) return `Tin "${match[1]}" đã bị quản trị viên từ chối.`;
  match = value.match(/^Your recommendation run finished with (\d+) matching jobs?\.$/);
  if (match) return `Lượt gợi ý đã hoàn tất với ${match[1]} việc làm phù hợp.`;
  return value;
}