import type { CandidateCvItem } from "./candidateCvTypes";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ExtractedField {
  label: string;
  value: string;
  confidence: ConfidenceLevel;
}

export interface CvAnalysisData {
  analyzedAt: string;
  scoreBreakdown: Array<{ label: string; value: number }>;
  personalInfo: ExtractedField[];
  experiences: Array<{
    company: ExtractedField;
    position: ExtractedField;
    period: ExtractedField;
    description: ExtractedField;
  }>;
  education: ExtractedField[];
  skills: Array<{ name: string; confidence: ConfidenceLevel }>;
  certificates: ExtractedField[];
  projects: ExtractedField[];
  missingInfo: string[];
  warnings: string[];
}

export function buildCvAnalysisData(cv: CandidateCvItem): CvAnalysisData {
  return {
    analyzedAt: cv.updatedAt,
    scoreBreakdown: [
      { label: "Điểm CV tổng", value: cv.score },
      { label: "Nội dung", value: cv.status === "failed" ? 0 : 80 },
      { label: "Kinh nghiệm", value: cv.status === "failed" ? 0 : 74 },
      { label: "Kỹ năng", value: cv.status === "failed" ? 0 : 86 },
      { label: "Trình bày", value: cv.status === "failed" ? 0 : 78 },
      { label: "Từ khóa", value: cv.status === "failed" ? 0 : 84 },
    ],
    personalInfo: [
      { label: "Họ tên", value: "Nguyễn Minh Anh", confidence: "high" },
      { label: "Email", value: "minhanh.frontend@example.com", confidence: "high" },
      { label: "Số điện thoại", value: "090 123 4567", confidence: "high" },
      { label: "Chức danh", value: "Frontend Developer", confidence: "medium" },
    ],
    experiences: [
      {
        company: { label: "Công ty", value: "VietNext Software", confidence: "high" },
        position: { label: "Vị trí", value: "Frontend Developer Intern", confidence: "high" },
        period: { label: "Thời gian", value: "03/2026 - 07/2026", confidence: "medium" },
        description: { label: "Mô tả", value: "Xây dựng dashboard tuyển dụng, danh sách việc làm và luồng upload CV bằng React.", confidence: "medium" },
      },
    ],
    education: [
      { label: "Trường", value: "Học viện Công nghệ Bưu chính Viễn thông", confidence: "high" },
      { label: "Chuyên ngành", value: "Công nghệ thông tin", confidence: "high" },
      { label: "Bằng cấp", value: "Kỹ sư", confidence: "medium" },
    ],
    skills: (cv.extractedSkills.length ? cv.extractedSkills : ["ReactJS", "TypeScript", "JavaScript", "Tailwind CSS", "Git", "REST API"]).map((name, index) => ({
      name,
      confidence: index < 3 ? "high" : index < 5 ? "medium" : "low",
    })),
    certificates: cv.status === "failed" ? [] : [
      { label: "Chứng chỉ", value: "React Advanced Certificate", confidence: "medium" },
    ],
    projects: cv.status === "failed" ? [] : [
      { label: "Dự án", value: "Student Job Recommendation UI", confidence: "high" },
      { label: "Vai trò", value: "Frontend Developer", confidence: "medium" },
    ],
    missingInfo: cv.missingFields.length ? cv.missingFields : ["Chưa có mức lương mong muốn.", "Chưa có chứng chỉ ngoại ngữ.", "Chưa có liên kết GitHub."],
    warnings: cv.warnings.length ? cv.warnings : ["Một số mốc thời gian chưa rõ.", "Một kỹ năng có độ tin cậy thấp.", "Phần giới thiệu quá ngắn."],
  };
}
