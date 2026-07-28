import type { EntityStatus, JobStatus } from "../../types/domain";

export const entityStatusLabels: Record<EntityStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Tạm khóa",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  draft: "Bản nháp",
  closed: "Đã đóng",
};

export const moderationJobStatusLabels: Record<JobStatus, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đang hiển thị",
  paused: "Tạm dừng",
  expired: "Hết hạn",
  rejected: "Bị từ chối",
  closed: "Đã đóng",
};

export function adminTone(status: string) {
  if (["active", "approved", "published", "resolved"].includes(status)) return "success" as const;
  if (["pending", "draft", "processing", "paused"].includes(status)) return "warning" as const;
  if (["inactive", "rejected", "closed"].includes(status)) return "danger" as const;
  return "neutral" as const;
}
