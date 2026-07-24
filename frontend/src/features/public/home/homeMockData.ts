import type { CareerArticle, FeaturedHomeCompany, FeaturedHomeJob, FeaturedIndustry, HomeStatistic } from "./homeTypes";

export const homeStatistics: HomeStatistic[] = [
  { id: "jobs", label: "việc làm", value: "1.250+" },
  { id: "companies", label: "doanh nghiệp", value: "320+" },
  { id: "candidates", label: "ứng viên", value: "18.000+" },
  { id: "successful-applications", label: "lượt ứng tuyển thành công", value: "6.500+" },
];

export const featuredHomeJobs: FeaturedHomeJob[] = [
  {
    id: "1",
    logo: "VN",
    title: "Frontend Developer Intern",
    companyName: "VietNext Software",
    salary: "8 - 12 triệu",
    location: "Hà Nội",
    workMode: "Hybrid",
    skills: ["React", "TypeScript", "Tailwind"],
    deadline: "30/07/2026",
    featuredLabel: "Nổi bật",
  },
  {
    id: "2",
    logo: "TC",
    title: "Java Backend Fresher",
    companyName: "TechCore Solutions",
    salary: "10 - 15 triệu",
    location: "TP. Hồ Chí Minh",
    workMode: "Onsite",
    skills: ["Java", "Spring Boot", "PostgreSQL"],
    deadline: "05/08/2026",
    featuredLabel: "Nổi bật",
  },
  {
    id: "3",
    logo: "DA",
    title: "Data Analyst Intern",
    companyName: "DataAide Analytics",
    salary: "7 - 10 triệu",
    location: "Đà Nẵng",
    workMode: "Remote",
    skills: ["SQL", "Power BI", "Python"],
    deadline: "12/08/2026",
    featuredLabel: "Nổi bật",
  },
  {
    id: "4",
    logo: "FI",
    title: "Business Analyst Junior",
    companyName: "FinInsight",
    salary: "12 - 18 triệu",
    location: "Hà Nội",
    workMode: "Hybrid",
    skills: ["UML", "Agile", "SQL"],
    deadline: "18/08/2026",
    featuredLabel: "Nổi bật",
  },
  {
    id: "5",
    logo: "PX",
    title: "UI/UX Designer Fresher",
    companyName: "PixelCraft Studio",
    salary: "9 - 13 triệu",
    location: "TP. Hồ Chí Minh",
    workMode: "Onsite",
    skills: ["Figma", "Prototype", "Design System"],
    deadline: "22/08/2026",
    featuredLabel: "Nổi bật",
  },
  {
    id: "6",
    logo: "CL",
    title: "DevOps Intern",
    companyName: "CloudLeap",
    salary: "8 - 11 triệu",
    location: "Remote",
    workMode: "Remote",
    skills: ["Docker", "Linux", "CI/CD"],
    deadline: "28/08/2026",
    featuredLabel: "Nổi bật",
  },
];

export const featuredIndustries: FeaturedIndustry[] = [
  { id: "it", name: "Công nghệ thông tin", jobCount: 420, iconName: "code" },
  { id: "business", name: "Kinh doanh", jobCount: 238, iconName: "briefcase" },
  { id: "marketing", name: "Marketing", jobCount: 186, iconName: "megaphone" },
  { id: "finance", name: "Tài chính", jobCount: 154, iconName: "banknote" },
  { id: "accounting", name: "Kế toán", jobCount: 132, iconName: "calculator" },
  { id: "hr", name: "Nhân sự", jobCount: 96, iconName: "users" },
  { id: "design", name: "Thiết kế", jobCount: 88, iconName: "palette" },
  { id: "data", name: "Phân tích dữ liệu", jobCount: 76, iconName: "chart" },
];

export const featuredHomeCompanies: FeaturedHomeCompany[] = [
  { id: "1", logo: "VN", name: "VietNext Software", industry: "Công nghệ thông tin", size: "100-300 nhân sự", location: "Hà Nội", openJobs: 18, verified: true },
  { id: "2", logo: "TC", name: "TechCore Solutions", industry: "Phần mềm doanh nghiệp", size: "300-500 nhân sự", location: "TP. Hồ Chí Minh", openJobs: 24, verified: true },
  { id: "3", logo: "DA", name: "DataAide Analytics", industry: "Phân tích dữ liệu", size: "50-100 nhân sự", location: "Đà Nẵng", openJobs: 9, verified: true },
  { id: "4", logo: "FI", name: "FinInsight", industry: "Tài chính công nghệ", size: "100-300 nhân sự", location: "Hà Nội", openJobs: 12, verified: true },
  { id: "5", logo: "PX", name: "PixelCraft Studio", industry: "Thiết kế sản phẩm", size: "30-80 nhân sự", location: "TP. Hồ Chí Minh", openJobs: 7, verified: false },
  { id: "6", logo: "CL", name: "CloudLeap", industry: "Cloud & DevOps", size: "80-150 nhân sự", location: "Remote", openJobs: 11, verified: true },
];

export const careerArticles: CareerArticle[] = [
  {
    id: "cv-student",
    title: "Cách viết CV cho sinh viên mới ra trường",
    summary: "Cách trình bày dự án, kỹ năng và kinh nghiệm học tập để CV rõ ràng hơn.",
    path: "/career-resources/cach-viet-cv-cho-sinh-vien-moi-ra-truong",
  },
  {
    id: "interview-prep",
    title: "Chuẩn bị gì trước buổi phỏng vấn",
    summary: "Checklist giúp ứng viên chuẩn bị thông tin công ty, câu hỏi kỹ thuật và phần giới thiệu bản thân.",
    path: "/career-resources/chuan-bi-truoc-buoi-phong-van",
  },
  {
    id: "expected-salary",
    title: "Cách xác định mức lương mong muốn",
    summary: "Gợi ý cách tham khảo thị trường và xác định khoảng lương phù hợp với năng lực hiện tại.",
    path: "/career-resources/cach-xac-dinh-muc-luong-mong-muon",
  },
];
