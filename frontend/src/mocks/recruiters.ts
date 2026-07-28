import type { Recruiter } from "../types/domain";

export const recruiters: Recruiter[] = [
  { id: "recruiter-1", userId: "user-2", name: "Trần Thị Bình", email: "recruiter@example.com", companyId: "company-1", roleTitle: "Recruitment Manager", status: "active" },
  { id: "recruiter-2", userId: "user-6", name: "Đỗ Quốc Huy", email: "huy.do@example.com", companyId: "company-2", roleTitle: "Recruiter", status: "active" },
  { id: "recruiter-3", userId: "user-19", name: "Nguyễn Kim Oanh", email: "oanh.nguyen@example.com", companyId: "company-6", roleTitle: "Interviewer", status: "active" },
  { id: "recruiter-4", userId: "user-20", name: "Phan Đức Tài", email: "tai.phan@example.com", companyId: "company-8", roleTitle: "Owner", status: "pending" },
];
