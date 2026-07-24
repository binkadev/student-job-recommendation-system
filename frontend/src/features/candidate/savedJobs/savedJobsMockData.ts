import { publicJobs } from "../../public/jobs/jobsListMockData";
import type { SavedJobItem } from "./savedJobsTypes";

const savedMetadata: Record<string, { savedAt: string; benefits: string[]; deadline?: string; displayStatus?: SavedJobItem["displayStatus"] }> = {
  "1": {
    savedAt: "2026-07-11",
    benefits: ["Mentor 1:1", "Lộ trình lên Junior", "Laptop làm việc"],
    displayStatus: "featured",
  },
  "2": {
    savedAt: "2026-07-10",
    benefits: ["Đào tạo Spring Boot", "Review lương 2 lần/năm", "Bảo hiểm đầy đủ"],
    displayStatus: "active",
  },
  "6": {
    savedAt: "2026-07-09",
    benefits: ["Làm remote", "Hỗ trợ chứng chỉ cloud", "Tham gia dự án DevOps thật"],
    displayStatus: "active",
  },
  "7": {
    savedAt: "2026-07-08",
    benefits: ["Thưởng hiệu suất", "Ngân sách học tập", "Làm việc hybrid"],
    deadline: "2026-07-05",
    displayStatus: "expired",
  },
  "12": {
    savedAt: "2026-07-07",
    benefits: ["Dữ liệu thực tế", "Mentor AI/ML", "Cơ hội chuyển chính thức"],
    displayStatus: "featured",
  },
  "18": {
    savedAt: "2026-07-06",
    benefits: ["Lương cạnh tranh", "MacBook Pro", "Ngân sách hội thảo kỹ thuật"],
    displayStatus: "featured",
  },
};

const vietnameseOverrides: Record<string, Partial<SavedJobItem>> = {
  "1": {
    title: "Thực tập sinh Frontend Developer",
    companyName: "VietNext Software",
    salary: "8 - 12 triệu",
    location: "Hà Nội",
    industry: "Công nghệ thông tin",
    experienceLabel: "Thực tập",
    jobType: "Toàn thời gian",
    skills: ["React", "TypeScript", "Tailwind"],
  },
  "2": {
    title: "Java Backend Fresher",
    companyName: "TechCore Solutions",
    salary: "10 - 15 triệu",
    location: "TP. Hồ Chí Minh",
    industry: "Công nghệ thông tin",
    experienceLabel: "0-1 năm",
    jobType: "Toàn thời gian",
    skills: ["Java", "Spring Boot", "PostgreSQL"],
  },
  "6": {
    title: "Thực tập sinh DevOps",
    companyName: "CloudLeap",
    salary: "8 - 11 triệu",
    location: "Remote",
    industry: "Công nghệ thông tin",
    experienceLabel: "Thực tập",
    jobType: "Thực tập",
    skills: ["Docker", "Linux", "CI/CD"],
  },
  "7": {
    title: "Digital Marketing Executive",
    companyName: "MarketHub",
    salary: "11 - 16 triệu",
    location: "Hà Nội",
    industry: "Marketing",
    experienceLabel: "1-2 năm",
    jobType: "Toàn thời gian",
    skills: ["SEO", "Content", "Analytics"],
  },
  "12": {
    title: "Thực tập sinh Machine Learning",
    companyName: "AIWorks Lab",
    salary: "9 - 14 triệu",
    location: "Hà Nội",
    industry: "Phân tích dữ liệu",
    experienceLabel: "Thực tập",
    jobType: "Thực tập",
    skills: ["Python", "TensorFlow", "NLP"],
  },
  "18": {
    title: "Senior React Engineer",
    companyName: "StarTech",
    salary: "35 - 55 triệu",
    location: "TP. Hồ Chí Minh",
    industry: "Công nghệ thông tin",
    experienceLabel: "5+ năm",
    jobType: "Toàn thời gian",
    skills: ["React", "Next.js", "Node.js"],
  },
};

export function buildSavedJobs(savedJobIds: string[]): SavedJobItem[] {
  return savedJobIds
    .map((jobId, index) => {
      const baseJob = publicJobs.find((job) => job.id === jobId);
      if (!baseJob) return null;
      const metadata = savedMetadata[jobId] ?? {
        savedAt: new Date(Date.now() - index * 86400000).toISOString().slice(0, 10),
        benefits: ["Môi trường chuyên nghiệp", "Đào tạo nội bộ", "Cơ hội phát triển nghề nghiệp"],
      };
      const deadline = metadata.deadline ?? baseJob.deadline;
      const expired = deadline < "2026-07-11";

      return {
        ...baseJob,
        ...vietnameseOverrides[jobId],
        deadline,
        savedAt: metadata.savedAt,
        benefits: metadata.benefits,
        displayStatus: expired ? "expired" : metadata.displayStatus ?? (baseJob.status === "urgent" ? "urgent" : baseJob.status === "featured" ? "featured" : "active"),
      };
    })
    .filter((job): job is SavedJobItem => Boolean(job));
}
