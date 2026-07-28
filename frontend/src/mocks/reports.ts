import type { Report } from "../types/domain";

export const reports: Report[] = [
  { id: "report-1", type: "Tin tuyển dụng không rõ lương", reporter: "Nguyễn Văn An", target: "job-12", content: "Mức lương không đúng với mô tả phỏng vấn.", status: "new", createdAt: "2026-07-07T17:30:00" },
  { id: "report-2", type: "Công ty chưa xác thực", reporter: "Phạm Thu Hà", target: "company-5", content: "Công ty chưa có thông tin pháp lý rõ ràng.", status: "processing", createdAt: "2026-07-08T09:00:00", handler: "Quản trị viên" },
  { id: "report-3", type: "Tin nhắn làm phiền", reporter: "Đặng Thùy Linh", target: "conversation-3", content: "Nhận nhiều tin nhắn ngoài giờ làm việc.", status: "resolved", createdAt: "2026-07-06T12:00:00", handler: "Quản trị viên" },
];
