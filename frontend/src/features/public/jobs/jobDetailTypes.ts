import type { PublicJobListItem } from "./jobsListTypes";

export type JobDetailStatus = "open" | "expired" | "closed";

export interface PublicJobDetail extends PublicJobListItem {
  companyId: string;
  companyVerified: boolean;
  companyIndustry: string;
  companySize: string;
  companyLocation: string;
  companyDescription: string;
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
  detailStatus: JobDetailStatus;
}

export interface JobDetailResult {
  job: PublicJobDetail;
  similarJobs: PublicJobListItem[];
}
