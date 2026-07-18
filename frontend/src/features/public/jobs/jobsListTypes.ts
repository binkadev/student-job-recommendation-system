export interface PublicJobListItem {
  id: string;
  logo: string;
  title: string;
  companyId?: string;
  companyName: string;
  salary: string;
  salaryMax: number;
  location: string;
  industry: string;
  experienceYears: number;
  experienceLabel: string;
  level: string;
  jobType: string;
  workMode: string;
  skills: string[];
  postedAt: string;
  deadline: string;
  applicants: number;
  status: "published" | "featured" | "urgent";
  matchScore: number;
}

export interface JobsListFilters {
  keyword: string;
  location: string;
  jobType: string;
  workingModel: string;
  page: number;
}

export interface JobsListResult {
  items: PublicJobListItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface JobsFilterOptions {
  locations: FilterOption[];
  jobTypes: FilterOption[];
  workModes: FilterOption[];
}
