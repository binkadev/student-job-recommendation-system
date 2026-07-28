import type { CandidateProfileData } from "./candidateProfileTypes";

export const candidateProfileData: CandidateProfileData = {
  header: {
    avatar: "MA",
    name: "Nguyễn Minh Anh",
    birthDate: "2003-04-18",
    currentTitle: "Frontend Developer",
    location: "Hồ Chí Minh",
    address: "Quận 7, TP. Hồ Chí Minh",
    email: "minhanh.frontend@example.com",
    phone: "090 123 4567",
    availability: "Sẵn sàng làm việc sau 2 tuần",
    completion: 78,
  },
  summary:
    "Frontend Developer định hướng xây dựng giao diện web rõ ràng, dễ dùng và có khả năng mở rộng. Có kinh nghiệm với React, TypeScript, Tailwind CSS và phối hợp cùng backend để triển khai sản phẩm tuyển dụng, dashboard nội bộ.",
  careerGoal:
    "Trong 12 tháng tới, mong muốn phát triển thành Frontend Developer vững về component architecture, performance và accessibility, đồng thời tham gia các sản phẩm có tác động thực tế tới người dùng.",
  experiences: [
    {
      id: "exp-1",
      company: "VietNext Software",
      position: "Frontend Developer Intern",
      period: "03/2026 - 07/2026",
      description: "Tham gia xây dựng dashboard quản lý tuyển dụng, module danh sách công việc và luồng upload CV.",
      achievements: ["Tối ưu component list giúp giảm thời gian thao tác lọc dữ liệu.", "Chuẩn hóa 12 component UI dùng chung cho nhóm frontend."],
      technologies: ["React", "TypeScript", "Tailwind CSS", "React Hook Form"],
    },
    {
      id: "exp-2",
      company: "Freelance Project",
      position: "Frontend Contributor",
      period: "09/2025 - 02/2026",
      description: "Xây dựng landing page, trang quản lý nội dung và các form nhập liệu cho khách hàng nhỏ.",
      achievements: ["Triển khai giao diện responsive cho mobile và desktop.", "Tích hợp validation form với Zod."],
      technologies: ["React", "Vite", "Zod", "REST API"],
    },
  ],
  education: [
    {
      id: "edu-1",
      school: "Học viện Công nghệ Bưu chính Viễn thông",
      major: "Công nghệ thông tin",
      degree: "Kỹ sư",
      period: "2022 - 2026",
      gpa: "3.35/4.0",
    },
  ],
  skills: {
    frontend: [
      { id: "skill-1", name: "React", level: "Tốt", years: 2 },
      { id: "skill-2", name: "TypeScript", level: "Khá", years: 1.5 },
      { id: "skill-3", name: "Tailwind CSS", level: "Tốt", years: 1.5 },
    ],
    backend: [
      { id: "skill-4", name: "Node.js", level: "Cơ bản", years: 1 },
      { id: "skill-5", name: "REST API", level: "Khá", years: 1 },
    ],
    tools: [
      { id: "skill-6", name: "Git", level: "Khá", years: 2 },
      { id: "skill-7", name: "Figma", level: "Khá", years: 1 },
      { id: "skill-8", name: "Jira", level: "Cơ bản", years: 0.5 },
    ],
    soft: [
      { id: "skill-9", name: "Giao tiếp", level: "Tốt", years: 2 },
      { id: "skill-10", name: "Làm việc nhóm", level: "Tốt", years: 2 },
    ],
  },
  certificates: [
    {
      id: "cert-1",
      name: "React Advanced Certificate",
      issuer: "Frontend Academy",
      issuedAt: "2026-04-10",
      expiresAt: "2028-04-10",
      code: "FAC-REACT-2026-0182",
      url: "https://example.com/cert/react-advanced",
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Student Job Recommendation UI",
      role: "Frontend Developer",
      period: "01/2026 - 06/2026",
      description: "Xây dựng giao diện hệ thống gợi ý việc làm dựa trên CV và hồ sơ cá nhân.",
      technologies: ["React", "TypeScript", "Tailwind CSS", "React Router"],
      url: "https://github.com/minhanh/job-recommendation-ui",
    },
    {
      id: "project-2",
      name: "CV Analyzer Prototype",
      role: "UI Developer",
      period: "10/2025 - 12/2025",
      description: "Thiết kế giao diện hiển thị điểm CV, kỹ năng trích xuất và cảnh báo thiếu thông tin.",
      technologies: ["React", "Zod", "Recharts"],
      url: "https://example.com/projects/cv-analyzer",
    },
  ],
  languages: [
    { id: "lang-1", name: "Tiếng Việt", level: "Bản ngữ" },
    { id: "lang-2", name: "Tiếng Anh", level: "TOEIC 750" },
  ],
  links: {
    linkedIn: "https://linkedin.com/in/nguyen-minh-anh",
    github: "https://github.com/minhanh",
    portfolio: "https://minhanh.dev",
    website: "https://blog.minhanh.dev",
  },
};
