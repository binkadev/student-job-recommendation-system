import type { Application } from "../types/domain";

const timeline = [
  { label: "Đã gửi", at: "2026-07-01T09:00:00", note: "Ứng viên đã gửi hồ sơ." },
  { label: "Nhà tuyển dụng đã xem", at: "2026-07-02T10:30:00", note: "Hồ sơ đã được mở xem." },
];

export const applications: Application[] = [
  { id: "app-1", candidateId: "candidate-1", candidateName: "Nguyễn Văn An", jobId: "job-1", jobTitle: "Frontend Developer", companyName: "Công ty TNHH Công nghệ NovaTech", cvId: "cv-1", cvName: "Nguyen-Van-An-Frontend-CV.pdf", coverLetter: "Em mong muốn tham gia phát triển sản phẩm web hiện đại.", appliedAt: "2026-07-01", status: "reviewing", timeline },
  { id: "app-2", candidateId: "candidate-2", candidateName: "Lê Minh Khang", jobId: "job-2", jobTitle: "Backend Developer", companyName: "Công ty Cổ phần FinPlus", cvId: "cv-2", cvName: "Le-Minh-Khang-Backend.docx", coverLetter: "Tôi có kinh nghiệm xây dựng API Spring Boot.", appliedAt: "2026-07-02", status: "shortlisted", timeline },
  { id: "app-3", candidateId: "candidate-3", candidateName: "Phạm Thu Hà", jobId: "job-6", jobTitle: "Data Analyst", companyName: "Công ty Cổ phần DataVision", cvId: "cv-3", cvName: "Pham-Thu-Ha-Data-Analyst.pdf", coverLetter: "Tôi yêu thích phân tích dữ liệu và trực quan hóa.", appliedAt: "2026-07-03", status: "submitted", timeline },
  { id: "app-4", candidateId: "candidate-5", candidateName: "Hoàng Đức Long", jobId: "job-9", jobTitle: "DevOps Engineer", companyName: "Công ty TNHH CloudNext", cvId: "cv-4", cvName: "Hoang-Duc-Long-DevOps.pdf", coverLetter: "Tôi có kinh nghiệm vận hành Kubernetes.", appliedAt: "2026-07-04", status: "interview", timeline },
  { id: "app-5", candidateId: "candidate-8", candidateName: "Đặng Thùy Linh", jobId: "job-7", jobTitle: "QA Engineer", companyName: "Công ty Cổ phần EcomHub", cvId: "cv-5", cvName: "Dang-Thuy-Linh-QA.pdf", coverLetter: "Tôi có kinh nghiệm kiểm thử API và web.", appliedAt: "2026-07-05", status: "viewed", timeline },
  { id: "app-6", candidateId: "candidate-10", candidateName: "Mai Phương Anh", jobId: "job-3", jobTitle: "Full-stack Developer", companyName: "Công ty TNHH GreenSoft", cvId: "cv-6", cvName: "Mai-Phuong-Anh-Fullstack.pdf", coverLetter: "Tôi từng làm sản phẩm SaaS từ frontend đến backend.", appliedAt: "2026-07-06", status: "offer", timeline },
  { id: "app-7", candidateId: "candidate-4", candidateName: "Vũ Ngọc Mai", jobId: "job-4", jobTitle: "UI/UX Designer", companyName: "Công ty TNHH Bright Future", cvId: "cv-1", cvName: "Portfolio-UX.pdf", coverLetter: "Tôi muốn thiết kế trải nghiệm học tập hiệu quả.", appliedAt: "2026-07-06", status: "rejected", timeline },
  { id: "app-8", candidateId: "candidate-9", candidateName: "Trịnh Hoàng Nam", jobId: "job-8", jobTitle: "Mobile Developer", companyName: "Công ty Cổ phần EcomHub", cvId: "cv-2", cvName: "Mobile-CV.pdf", coverLetter: "Tôi có kinh nghiệm Flutter và REST API.", appliedAt: "2026-07-07", status: "interviewed", timeline },
  { id: "app-9", candidateId: "candidate-7", candidateName: "Bùi Tuấn Anh", jobId: "job-5", jobTitle: "Business Analyst", companyName: "Công ty Cổ phần TalentBridge", cvId: "cv-3", cvName: "BA-CV.pdf", coverLetter: "Tôi hiểu quy trình tuyển dụng và viết tài liệu nghiệp vụ.", appliedAt: "2026-07-08", status: "withdrawn", timeline },
  { id: "app-10", candidateId: "candidate-12", candidateName: "Lý Thanh Tâm", jobId: "job-12", jobTitle: "Kế toán tổng hợp", companyName: "Công ty Cổ phần FinPlus", cvId: "cv-4", cvName: "Ke-Toan-CV.pdf", coverLetter: "Tôi có kinh nghiệm đối soát giao dịch tài chính.", appliedAt: "2026-07-09", status: "submitted", timeline },
];
