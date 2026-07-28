export interface PublicCompanyListItem {
  id: string;
  cover: string;
  logo: string;
  logoUrl?: string;
  name: string;
  verified: boolean;
  industry: string;
  size: string;
  location: string;
  description: string;
  openJobs: number;
  jobTypes?: string[];
  workingModels?: string[];
}

export interface CompaniesListFilters {
  keyword: string;
  location: string;
  industry: string;
  sort: string;
  page: number;
}

export interface CompaniesListResult {
  items: PublicCompanyListItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface CompanyFilterOptions {
  locations: FilterOption[];
  industries: FilterOption[];
  sorts: FilterOption[];
}
