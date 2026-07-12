import { withMockDelay } from "../../../utils/mockDelay";
import { publicCompanies } from "./companiesListMockData";
import type { CompaniesListFilters, CompaniesListResult, CompanyFilterOptions, PublicCompanyListItem } from "./companiesListTypes";

const pageSize = 8;

export function getCompanyFilterOptions(): CompanyFilterOptions {
  return {
    industries: Array.from(new Set(publicCompanies.map((company) => company.industry))),
    locations: Array.from(new Set(publicCompanies.map((company) => company.location))),
    sizes: Array.from(new Set(publicCompanies.map((company) => company.size))),
  };
}

export function getPublicCompanies(filters: CompaniesListFilters): Promise<CompaniesListResult> {
  const filteredCompanies = filterCompanies(publicCompanies, filters);
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const start = (page - 1) * pageSize;

  return withMockDelay({
    items: filteredCompanies.slice(start, start + pageSize),
    totalItems: filteredCompanies.length,
    page,
    pageSize,
    totalPages,
  });
}

function filterCompanies(companies: PublicCompanyListItem[], filters: CompaniesListFilters) {
  const keyword = filters.keyword.trim().toLowerCase();

  return companies.filter((company) => {
    const searchable = `${company.name} ${company.description} ${company.industry} ${company.location}`.toLowerCase();
    const matchKeyword = !keyword || searchable.includes(keyword);
    const matchIndustry = !filters.industry || company.industry === filters.industry;
    const matchLocation = !filters.location || company.location === filters.location;
    const matchSize = !filters.size || company.size === filters.size;
    const matchVerified = !filters.verified || String(company.verified) === filters.verified;

    return matchKeyword && matchIndustry && matchLocation && matchSize && matchVerified;
  });
}
