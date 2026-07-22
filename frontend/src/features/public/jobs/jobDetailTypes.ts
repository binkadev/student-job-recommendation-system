import type { PublicJobListItem } from "./jobsListTypes";

export type JobDetailStatus = "open" | "expired" | "closed";

export interface PublicJobDetail extends PublicJobListItem {
  companyId: string;
  companyVerified: boolean;
  companyIndustry: string;
  companySize: string;
  companyLocation: string;
  companyDescription: string;
  companyLogoUrl?: string;
  companyWebsite?: string;
  hiringQuantity: number;
  views: number;
  description: string;
  responsibilities: string[];
  requirements: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  benefits: string[];
  workplace: string;
  workingTime: string;
  recruitmentProcess: string[];
  apiStatus?: string;
  publishedAt?: string;
  updatedAt?: string;
  closedAt?: string;
  detailStatus: JobDetailStatus;
}

export interface JobDetailResult {
  job: PublicJobDetail;
  similarJobs: PublicJobListItem[];
}
