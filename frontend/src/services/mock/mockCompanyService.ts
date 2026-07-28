import { companies } from "../../mocks";
import type { Company } from "../../types/domain";
import { getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "companies";

export const mockCompanyService = {
  getCompanies: (filters?: ListParams) => listFromStorage(KEY, companies, filters, ["name", "industry", "location"]),
  getCompanyById: (id: string) => getByIdFromStorage(KEY, companies, id),
  updateCompany: (id: string, payload: Partial<Company>) => updateInStorage(KEY, companies, id, payload),
};
