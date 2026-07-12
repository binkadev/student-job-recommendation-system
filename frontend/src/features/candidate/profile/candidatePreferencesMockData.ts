import type { CandidateCareerPreferences, CandidatePreferencesOptions } from "./candidatePreferencesTypes";

export const defaultCandidatePreferences: CandidateCareerPreferences = {
  desiredPositions: ["Frontend Developer", "React Developer"],
  industries: ["Công nghệ thông tin", "Phần mềm doanh nghiệp"],
  levels: ["Fresher", "Junior"],
  salaryMin: 10000000,
  salaryMax: 18000000,
  currency: "VND",
  locations: ["TP. Hồ Chí Minh", "Remote"],
  jobTypes: ["Toàn thời gian"],
  workModes: ["Hybrid", "Remote"],
  availableFrom: "2026-08-01",
  willingToTravel: false,
  willingToRelocate: true,
  internationalRemote: true,
  excludedKeywords: ["Sales thuần", "Ca đêm", "Không lương"],
};

export const candidatePreferencesOptions: CandidatePreferencesOptions = {
  industries: ["Công nghệ thông tin", "Phần mềm doanh nghiệp", "Phân tích dữ liệu", "Tài chính công nghệ", "Thiết kế sản phẩm", "Marketing"],
  levels: ["Intern", "Fresher", "Junior", "Middle", "Senior"],
  locations: ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Cần Thơ", "Remote"],
  jobTypes: ["Toàn thời gian", "Bán thời gian", "Thực tập", "Freelance"],
  workModes: ["Onsite", "Hybrid", "Remote"],
  currencies: ["VND", "USD"],
};
