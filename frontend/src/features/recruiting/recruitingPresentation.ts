import { isInterview, type RecruitingRole, type RecruitingRecord, type RecordStatus, type Kind } from "./recruitingApi";
import { appearsFinished, localStamp, validWallTime } from "./recruitingTime";

export const labels: Record<string, string> = { SCHEDULED: "Đã lên lịch", CONFIRMED: "Đã xác nhận", DECLINED: "Đã từ chối", COMPLETED: "Đã hoàn tất", CANCELLED: "Đã hủy", PENDING: "Chờ phản hồi", ACCEPTED: "Đã chấp nhận" };
export const actionLabels: Record<string, string> = { CONFIRMED: "Xác nhận tham dự", DECLINED: "Từ chối", CANCELLED: "Hủy", COMPLETED: "Đánh dấu hoàn tất", ACCEPTED: "Chấp nhận lời mời" };
export function basePath(role: RecruitingRole, kind: Kind) { return `/${role}/${kind}`; }
export function availableActions(role: RecruitingRole, item: RecruitingRecord, now: Date): RecordStatus[] {
  if (!isInterview(item)) return item.status === "PENDING" ? role === "recruiter" ? ["CANCELLED"] : ["ACCEPTED", "DECLINED"] : [];
  if (role === "candidate") return item.status === "SCHEDULED" && validWallTime(item.scheduledAt) && item.scheduledAt > localStamp(now) ? ["CONFIRMED", "DECLINED"] : [];
  if (item.status === "SCHEDULED") return ["CANCELLED"];
  if (item.status === "CONFIRMED") return appearsFinished(item.scheduledAt, item.durationMinutes, now) ? ["CANCELLED", "COMPLETED"] : ["CANCELLED"];
  return [];
}
