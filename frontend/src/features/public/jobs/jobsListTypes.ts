export type JobsSort = "latest" | "match" | "salary" | "deadline";

export interface PublicJobListItem {
  id: string;
  logo: string;
  title: string;
  companyName: string;
  salary: string;
  salaryMax: number;
  location: string;
  industry: string;
  experienceYears: number;
  experienceLabel: string;
  level: string;
  jobType: string;
  workMode: "Onsite" | "Hybrid" | "Remote";
  skills: string[];
  postedAt: string;
  deadline: string;
  applicants: number;
  status: "published" | "featured" | "urgent";
  matchScore: number;
}

export interface JobsListFilters {
  keyword: string;
  locations: string[];
  industries: string[];
  salary: string;
  experience: string;
  level: string;
  jobType: string;
  workMode: string;
  postedDate: string;
  featured: boolean;
  sort: JobsSort;
  page: number;
}

export interface JobsListResult {
  items: PublicJobListItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobsFilterOptions {
  locations: string[];
  industries: string[];
  levels: string[];
  jobTypes: string[];
  workModes: string[];
}
