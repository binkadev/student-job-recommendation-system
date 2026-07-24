import type { Invitation } from "../types/domain";

export const invitations: Invitation[] = [
  { id: "invitation-1", candidateId: "candidate-1", recruiterId: "recruiter-1", jobId: "job-1", jobTitle: "Frontend Developer", companyName: "Công ty TNHH Công nghệ NovaTech", message: "Hồ sơ của bạn phù hợp với vị trí Frontend Developer.", sentAt: "2026-07-08", status: "pending" },
  { id: "invitation-2", candidateId: "candidate-5", recruiterId: "recruiter-2", jobId: "job-9", jobTitle: "DevOps Engineer", companyName: "Công ty TNHH CloudNext", message: "Chúng tôi muốn trao đổi thêm về kinh nghiệm DevOps của bạn.", sentAt: "2026-07-07", status: "accepted" },
  { id: "invitation-3", candidateId: "candidate-8", recruiterId: "recruiter-3", jobId: "job-7", jobTitle: "QA Engineer", companyName: "Công ty Cổ phần EcomHub", message: "Bạn có kinh nghiệm kiểm thử phù hợp với nhóm QA.", sentAt: "2026-07-06", status: "declined" },
];
