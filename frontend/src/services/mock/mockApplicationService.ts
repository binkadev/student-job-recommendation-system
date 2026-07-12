import { applications } from "../../mocks";
import type { Application } from "../../types/domain";
import { createInStorage, getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "applications";

export const mockApplicationService = {
  getApplications: (filters?: ListParams) => listFromStorage(KEY, applications, filters, ["candidateName", "jobTitle", "companyName"]),
  getApplicationById: (id: string) => getByIdFromStorage(KEY, applications, id),
  createApplication: (payload: Application) => createInStorage(KEY, applications, payload),
  updateApplication: (id: string, payload: Partial<Application>) => updateInStorage(KEY, applications, id, payload),
  withdrawApplication: (id: string) => updateInStorage(KEY, applications, id, { status: "withdrawn" }),
};
