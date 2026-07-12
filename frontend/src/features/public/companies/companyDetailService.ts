import { withMockDelay } from "../../../utils/mockDelay";
import { getCompanyJobs, publicCompanyDetails } from "./companyDetailMockData";
import type { CompanyDetailResult } from "./companyDetailTypes";

export function getPublicCompanyDetail(companyId: string): Promise<CompanyDetailResult | null> {
  const company = publicCompanyDetails.find((item) => item.id === companyId);
  if (!company) return withMockDelay(null);

  return withMockDelay({
    company,
    jobs: getCompanyJobs(company.name),
  });
}
