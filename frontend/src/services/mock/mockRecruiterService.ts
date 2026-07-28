import { recruiters } from "../../mocks";
import type { Recruiter } from "../../types/domain";
import { getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "recruiters";

export const mockRecruiterService = {
  getRecruiters: (filters?: ListParams) => listFromStorage(KEY, recruiters, filters, ["name", "email", "roleTitle"]),
  getRecruiterById: (id: string) => getByIdFromStorage(KEY, recruiters, id),
  updateRecruiter: (id: string, payload: Partial<Recruiter>) => updateInStorage(KEY, recruiters, id, payload),
};
