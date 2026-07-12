import type { CategoryItem } from "../types/domain";

export const categories: CategoryItem[] = [
  { id: "cat-1", type: "industry", name: "Phần mềm doanh nghiệp", order: 1, active: true },
  { id: "cat-2", type: "industry", name: "Fintech", order: 2, active: true },
  { id: "cat-3", type: "industry", name: "E-commerce", order: 3, active: true },
  { id: "cat-4", type: "jobTitle", name: "Frontend Developer", order: 1, active: true },
  { id: "cat-5", type: "jobTitle", name: "Backend Developer", order: 2, active: true },
  { id: "cat-6", type: "skill", name: "React", order: 1, active: true },
  { id: "cat-7", type: "skill", name: "Spring Boot", order: 2, active: true },
  { id: "cat-8", type: "location", name: "Hà Nội", order: 1, active: true },
  { id: "cat-9", type: "location", name: "Thành phố Hồ Chí Minh", order: 2, active: true },
  { id: "cat-10", type: "jobType", name: "Toàn thời gian", order: 1, active: true },
  { id: "cat-11", type: "jobType", name: "Thực tập", order: 2, active: true },
  { id: "cat-12", type: "experienceLevel", name: "Junior", order: 1, active: true },
  { id: "cat-13", type: "experienceLevel", name: "Middle", order: 2, active: true },
];
