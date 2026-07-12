export interface PublicCompanyListItem {
  id: string;
  cover: string;
  logo: string;
  name: string;
  verified: boolean;
  industry: string;
  size: string;
  location: string;
  description: string;
  openJobs: number;
}

export interface CompaniesListFilters {
  keyword: string;
  industry: string;
  location: string;
  size: string;
  verified: string;
  page: number;
}

export interface CompaniesListResult {
  items: PublicCompanyListItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CompanyFilterOptions {
  industries: string[];
  locations: string[];
  sizes: string[];
}
