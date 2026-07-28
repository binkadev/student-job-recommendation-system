import type { ApplicationStatus, CvStatus, InterviewStatus } from "../../types/domain";

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  submitted: "Đã gửi",
  viewed: "Nhà tuyển dụng đã xem",
  reviewing: "Đang xem xét",
  shortlisted: "Qua vòng hồ sơ",
  interview: "Mời phỏng vấn",
  interviewed: "Đã phỏng vấn",
  offer: "Nhận offer",
  rejected: "Không phù hợp",
  withdrawn: "Ứng viên đã rút hồ sơ",
};

export const cvStatusLabels: Record<CvStatus, string> = {
  uploaded: "Đã tải lên",
  analyzing: "Đang phân tích",
  analyzed: "Phân tích thành công",
  failed: "Phân tích thất bại",
  needs_confirmation: "Cần xác nhận dữ liệu",
};

export const interviewStatusLabels: Record<InterviewStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  declined: "Đã từ chối",
  reschedule_requested: "Yêu cầu đổi lịch",
  completed: "Đã hoàn thành",
};

export function toneFromStatus(status: string) {
  if (["analyzed", "confirmed", "completed", "offer", "accepted"].includes(status)) return "success" as const;
  if (["failed", "declined", "rejected"].includes(status)) return "danger" as const;
  if (["pending", "reviewing", "interview", "needs_confirmation", "reschedule_requested"].includes(status)) return "warning" as const;
  return "neutral" as const;
}
