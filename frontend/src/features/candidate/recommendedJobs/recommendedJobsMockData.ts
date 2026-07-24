import { publicJobs } from "../../public/jobs/jobsListMockData";
import type { CandidateRecommendedJob } from "./recommendedJobsTypes";

const scores = [
  { id: "1", matchScore: 95, skillScore: 96, experienceScore: 88, educationScore: 82, locationScore: 94, salaryScore: 90, workModeScore: 92, matchedSkills: ["React", "TypeScript", "Tailwind"], missingSkills: ["Testing"], reasons: ["Khớp mạnh với kỹ năng Frontend", "Địa điểm và hình thức Hybrid phù hợp", "Mức lương nằm trong khoảng mong muốn"] },
  { id: "18", matchScore: 91, skillScore: 92, experienceScore: 74, educationScore: 80, locationScore: 86, salaryScore: 95, workModeScore: 84, matchedSkills: ["React", "Next.js", "Node.js"], missingSkills: ["System Design"], reasons: ["Kỹ năng React rất phù hợp", "Mức lương cao hơn mong muốn", "Cần bổ sung kinh nghiệm senior"] },
  { id: "12", matchScore: 88, skillScore: 84, experienceScore: 82, educationScore: 90, locationScore: 88, salaryScore: 80, workModeScore: 86, matchedSkills: ["Python", "NLP"], missingSkills: ["TensorFlow nâng cao"], reasons: ["Nền tảng học vấn phù hợp", "Có định hướng dữ liệu", "Cần bổ sung framework ML"] },
  { id: "6", matchScore: 85, skillScore: 80, experienceScore: 86, educationScore: 78, locationScore: 96, salaryScore: 76, workModeScore: 95, matchedSkills: ["Docker", "Linux"], missingSkills: ["Kubernetes"], reasons: ["Remote phù hợp mong muốn", "Có kỹ năng nền tảng DevOps", "Mức lương thực tập phù hợp"] },
  { id: "2", matchScore: 82, skillScore: 78, experienceScore: 85, educationScore: 80, locationScore: 90, salaryScore: 84, workModeScore: 74, matchedSkills: ["Java", "PostgreSQL"], missingSkills: ["Spring Security"], reasons: ["Backend là hướng mở rộng phù hợp", "Địa điểm thuận tiện", "Cần bổ sung Spring Boot chuyên sâu"] },
  { id: "14", matchScore: 79, skillScore: 72, experienceScore: 70, educationScore: 76, locationScore: 98, salaryScore: 92, workModeScore: 96, matchedSkills: ["Firebase"], missingSkills: ["Flutter", "Dart"], reasons: ["Remote rất phù hợp", "Mức lương tốt", "Thiếu kỹ năng mobile chính"] },
  { id: "5", matchScore: 76, skillScore: 78, experienceScore: 80, educationScore: 72, locationScore: 90, salaryScore: 74, workModeScore: 70, matchedSkills: ["Figma", "Design System"], missingSkills: ["User Research"], reasons: ["Có kỹ năng UI hỗ trợ Frontend", "Phù hợp nếu muốn chuyển hướng UX", "Cần bổ sung research"] },
  { id: "13", matchScore: 72, skillScore: 70, experienceScore: 82, educationScore: 74, locationScore: 88, salaryScore: 72, workModeScore: 70, matchedSkills: ["API", "Jira"], missingSkills: ["Automation Test"], reasons: ["QA phù hợp kiến thức sản phẩm", "Có kỹ năng API cơ bản", "Thiếu automation"] },
  { id: "20", matchScore: 68, skillScore: 62, experienceScore: 66, educationScore: 74, locationScore: 96, salaryScore: 90, workModeScore: 96, matchedSkills: ["Agile", "User Research"], missingSkills: ["Roadmap", "Product Metrics"], reasons: ["Remote phù hợp", "Có nền tảng UI/product", "Cần kinh nghiệm quản lý sản phẩm"] },
  { id: "4", matchScore: 64, skillScore: 66, experienceScore: 70, educationScore: 72, locationScore: 72, salaryScore: 78, workModeScore: 82, matchedSkills: ["SQL", "Agile"], missingSkills: ["UML"], reasons: ["Có SQL và Agile", "Hợp nếu muốn làm BA", "Thiếu kỹ năng phân tích nghiệp vụ"] },
  { id: "7", matchScore: 59, skillScore: 55, experienceScore: 60, educationScore: 64, locationScore: 74, salaryScore: 70, workModeScore: 78, matchedSkills: ["Analytics"], missingSkills: ["SEO", "Content"], reasons: ["Có tư duy phân tích", "Không phải hướng chính Frontend", "Cần bổ sung marketing"] },
  { id: "17", matchScore: 55, skillScore: 54, experienceScore: 62, educationScore: 60, locationScore: 94, salaryScore: 58, workModeScore: 96, matchedSkills: ["A/B Test"], missingSkills: ["Ads", "Landing Page"], reasons: ["Remote phù hợp", "Có liên quan tối ưu giao diện", "Mức lương thấp hơn mong muốn"] },
];

export const recommendedJobs: CandidateRecommendedJob[] = scores
  .map((score) => {
    const job = publicJobs.find((item) => item.id === score.id);
    if (!job) return null;
    return {
      ...job,
      matchScore: score.matchScore,
      skillScore: score.skillScore,
      experienceScore: score.experienceScore,
      educationScore: score.educationScore,
      locationScore: score.locationScore,
      salaryScore: score.salaryScore,
      workModeScore: score.workModeScore,
      matchedSkills: score.matchedSkills,
      missingSkills: score.missingSkills,
      recommendationReasons: score.reasons,
    };
  })
  .filter((item): item is CandidateRecommendedJob => Boolean(item));
