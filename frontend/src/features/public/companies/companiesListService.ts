import { httpClient } from "../../../services/api/httpClient";
import type { CompaniesListFilters, CompaniesListResult, CompanyFilterOptions, PublicCompanyListItem } from "./companiesListTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface PublicCompanyResponse {
  id: number;
  companyName: string;
  industry: string | null;
  address: string | null;
  websiteUrl: string | null;
  description: string | null;
  status: "PENDING" | "VERIFIED" | "BLOCKED";
  openJobs: number | null;
  createdAt: string;
  updatedAt: string;
  companySize: string | null;
  logoUrl: string | null;
}

const pageSize = 8;

export function getCompanyFilterOptions(): CompanyFilterOptions {
  return {
    locations: [],
    industries: [],
    sorts: [
      { label: "Mới nhất", value: "createdAt,desc" },
      { label: "Cũ nhất", value: "createdAt,asc" },
      { label: "Tên A-Z", value: "companyName,asc" },
      { label: "Tên Z-A", value: "companyName,desc" },
    ],
  };
}

export async function getPublicCompanies(filters: CompaniesListFilters): Promise<CompaniesListResult> {
  const response = await httpClient.get<ApiResponse<PageResponse<PublicCompanyResponse>>>("/public/companies", {
    params: {
      page: filters.page,
      size: pageSize,
      keyword: emptyToUndefined(filters.keyword),
      location: emptyToUndefined(filters.location),
      industry: emptyToUndefined(filters.industry),
      sort: emptyToUndefined(filters.sort),
    },
  });
  const page = response.data.data;

  return {
    items: page.items.map(mapCompany),
    totalItems: page.totalItems,
    page: page.page,
    pageSize: page.size,
    totalPages: page.totalPages,
  };
}

export function mapCompany(company: PublicCompanyResponse): PublicCompanyListItem {
  return {
    id: String(company.id),
    cover: "bg-slate-950",
    logo: getInitials(company.companyName),
    logoUrl: company.logoUrl ?? "",
    name: company.companyName,
    verified: company.status === "VERIFIED",
    industry: company.industry || "Chưa cập nhật",
    size: company.companySize || "Chưa cập nhật",
    location: company.address || "Chưa cập nhật",
    description: company.description || "Chưa cập nhật mô tả công ty.",
    openJobs: Number(company.openJobs ?? 0),
  };
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(-2)
    .toUpperCase();
  return initials || "CT";
}
