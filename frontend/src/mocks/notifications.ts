import type { AppNotification } from "../types/domain";

export const notifications: AppNotification[] = [
  { id: "notification-1", title: "Có 5 việc làm mới phù hợp", body: "Các việc làm React mới đã được thêm vào danh sách gợi ý.", type: "job", read: false, createdAt: "2026-07-10T08:00:00", targetPath: "/candidate/jobs/recommended" },
  { id: "notification-2", title: "CV đã phân tích xong", body: "CV Frontend của bạn đạt 82 điểm.", type: "cv", read: false, createdAt: "2026-07-10T08:30:00", targetPath: "/candidate/cvs/cv-1/analysis" },
  { id: "notification-3", title: "Nhà tuyển dụng đã xem hồ sơ", body: "NovaTech vừa xem hồ sơ của bạn.", type: "application", read: true, createdAt: "2026-07-09T14:00:00", targetPath: "/candidate/applications/app-1" },
  { id: "notification-4", title: "Lịch phỏng vấn được xác nhận", body: "Lịch phỏng vấn DevOps ngày 12/07 đã được xác nhận.", type: "interview", read: false, createdAt: "2026-07-09T15:00:00", targetPath: "/candidate/interviews/interview-1" },
  { id: "notification-5", title: "Có lời mời ứng tuyển mới", body: "TalentBridge gửi lời mời ứng tuyển vị trí Business Analyst.", type: "invitation", read: false, createdAt: "2026-07-08T10:30:00", targetPath: "/candidate/invitations/invitation-1" },
  { id: "notification-6", title: "Tin tuyển dụng chờ duyệt", body: "Tin UI/UX Designer đang chờ quản trị viên duyệt.", type: "system", read: true, createdAt: "2026-07-08T11:00:00", targetPath: "/recruiter/jobs/job-4" },
  { id: "notification-7", title: "Doanh nghiệp cần bổ sung hồ sơ", body: "Bright Future cần cập nhật giấy phép kinh doanh.", type: "system", read: false, createdAt: "2026-07-07T16:00:00", targetPath: "/admin/companies/company-5/verification" },
  { id: "notification-8", title: "Báo cáo vi phạm mới", body: "Có báo cáo về nội dung tin tuyển dụng không phù hợp.", type: "system", read: false, createdAt: "2026-07-07T17:30:00", targetPath: "/admin/reports/report-1" },
];
