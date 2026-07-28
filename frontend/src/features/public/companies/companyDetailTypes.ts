import type { PublicCompanyListItem } from "./companiesListTypes";
import type { PublicJobListItem } from "../jobs/jobsListTypes";

export interface CompanyGalleryItem {
  id: string;
  title: string;
  description: string;
  tone: string;
}

export interface PublicCompanyDetail extends PublicCompanyListItem {
  website: string;
  address: string;
  foundedYear: number;
  mission: string;
  coreValues: string[];
  branches: string[];
  benefits: Array<{ title: string; description: string }>;
  gallery: CompanyGalleryItem[];
}

export interface CompanyDetailResult {
  company: PublicCompanyDetail;
  jobs: PublicJobListItem[];
}
