import type { JobStatus } from "../../types/domain";

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đang hiển thị",
  paused: "Tạm dừng",
  expired: "Hết hạn",
  rejected: "Bị từ chối",
  closed: "Đã đóng",
};

export function recruiterTone(status: string) {
  if (["published", "approved", "confirmed", "completed", "hired"].includes(status)) return "success" as const;
  if (["pending", "draft", "paused", "reviewing", "interview"].includes(status)) return "warning" as const;
  if (["rejected", "declined", "closed"].includes(status)) return "danger" as const;
  return "neutral" as const;
}

export const pipelineColumns = [
  "Mới nhận",
  "Đang xem xét",
  "Qua vòng CV",
  "Phỏng vấn",
  "Offer",
  "Đã tuyển",
  "Không phù hợp",
];
