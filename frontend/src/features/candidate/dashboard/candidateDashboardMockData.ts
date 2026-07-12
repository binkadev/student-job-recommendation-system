import { publicJobs } from "../../public/jobs/jobsListMockData";
import type { CandidateDashboardData } from "./candidateDashboardTypes";

export const candidateDashboardData: CandidateDashboardData = {
  profile: {
    id: "candidate-1",
    name: "Nguyễn Minh Anh",
    title: "Frontend Developer",
    location: "Hồ Chí Minh",
    profileCompletion: 78,
    profileViews: 12,
  },
  stats: {
    matchedJobs: 18,
    savedJobs: 7,
    applications: 5,
    interviews: 2,
  },
  cv: {
    id: "cv-frontend-main",
    fileName: "Nguyen-Minh-Anh-Frontend-CV.pdf",
    score: 82,
    updatedAt: "2026-07-08",
    isPublic: true,
  },
  missingProfileItems: [
    { id: "career-goal", label: "Mục tiêu nghề nghiệp", path: "/candidate/profile/edit" },
    { id: "certificates", label: "Chứng chỉ", path: "/candidate/profile/edit" },
    { id: "expected-salary", label: "Mức lương mong muốn", path: "/candidate/profile/preferences" },
  ],
  recommendedJobs: publicJobs.filter((job) => ["1", "2", "6", "18"].includes(job.id)),
  applications: [
    { id: "app-1", jobTitle: "Frontend Developer Intern", companyName: "VietNext Software", appliedAt: "2026-07-08", status: "interview" },
    { id: "app-2", jobTitle: "Java Backend Fresher", companyName: "TechCore Solutions", appliedAt: "2026-07-06", status: "reviewing" },
    { id: "app-3", jobTitle: "UI/UX Designer Fresher", companyName: "PixelCraft Studio", appliedAt: "2026-07-03", status: "submitted" },
    { id: "app-4", jobTitle: "Manual QA Tester Fresher", companyName: "QualityApps", appliedAt: "2026-06-30", status: "rejected" },
    { id: "app-5", jobTitle: "Machine Learning Intern", companyName: "AIWorks Lab", appliedAt: "2026-06-28", status: "offer" },
  ],
  interviews: [
    {
      id: "interview-1",
      jobTitle: "Frontend Developer Intern",
      companyName: "VietNext Software",
      startsAt: "2026-07-11T15:00:00+07:00",
      mode: "Online",
      locationOrLink: "Google Meet",
      status: "confirmed",
    },
    {
      id: "interview-2",
      jobTitle: "Java Backend Fresher",
      companyName: "TechCore Solutions",
      startsAt: "2026-07-15T09:30:00+07:00",
      mode: "Offline",
      locationOrLink: "Quận 1, TP. Hồ Chí Minh",
      status: "pending",
    },
  ],
  notifications: [
    { id: "noti-1", title: "CV đã được phân tích", body: "Điểm CV hiện tại là 82/100.", createdAt: "2026-07-10", read: false, targetPath: "/candidate/cvs/cv-frontend-main/analysis" },
    { id: "noti-2", title: "Có việc làm mới phù hợp", body: "Senior React Engineer phù hợp 89% với hồ sơ của bạn.", createdAt: "2026-07-09", read: false, targetPath: "/candidate/jobs/18" },
    { id: "noti-3", title: "Lịch phỏng vấn đã xác nhận", body: "VietNext Software đã xác nhận lịch phỏng vấn.", createdAt: "2026-07-08", read: true, targetPath: "/candidate/interviews/interview-1" },
  ],
};
