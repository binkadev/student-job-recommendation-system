import type { Cv } from "../types/domain";

export const cvs: Cv[] = [
  { id: "cv-1", candidateId: "candidate-1", fileName: "Nguyen-Van-An-Frontend-CV.pdf", uploadedAt: "2026-07-01", status: "analyzed", score: 82, isDefault: true, isPublic: true, extractedSkills: ["React", "TypeScript", "Tailwind CSS"], missingFields: ["Dự án cá nhân"], warnings: ["Mô tả kinh nghiệm còn ngắn"] },
  { id: "cv-2", candidateId: "candidate-2", fileName: "Le-Minh-Khang-Backend.docx", uploadedAt: "2026-07-02", status: "needs_confirmation", score: 88, isDefault: true, isPublic: true, extractedSkills: ["Java", "Spring Boot", "PostgreSQL"], missingFields: ["Chứng chỉ"], warnings: ["Thiếu thông tin người tham chiếu"] },
  { id: "cv-3", candidateId: "candidate-3", fileName: "Pham-Thu-Ha-Data-Analyst.pdf", uploadedAt: "2026-07-03", status: "analyzing", score: 70, isDefault: false, isPublic: false, extractedSkills: ["SQL", "Python"], missingFields: ["Portfolio"], warnings: [] },
  { id: "cv-4", candidateId: "candidate-5", fileName: "Hoang-Duc-Long-DevOps.pdf", uploadedAt: "2026-07-04", status: "analyzed", score: 91, isDefault: true, isPublic: true, extractedSkills: ["Docker", "Kubernetes", "AWS"], missingFields: [], warnings: ["Nên bổ sung số liệu vận hành"] },
  { id: "cv-5", candidateId: "candidate-8", fileName: "Dang-Thuy-Linh-QA.pdf", uploadedAt: "2026-07-05", status: "failed", score: 0, isDefault: false, isPublic: false, extractedSkills: [], missingFields: ["Không đọc được nội dung"], warnings: ["File có thể bị khóa hoặc lỗi định dạng"] },
  { id: "cv-6", candidateId: "candidate-10", fileName: "Mai-Phuong-Anh-Fullstack.pdf", uploadedAt: "2026-07-06", status: "analyzed", score: 86, isDefault: true, isPublic: true, extractedSkills: ["React", "Node.js", "MongoDB"], missingFields: ["Ngoại ngữ"], warnings: [] },
];
