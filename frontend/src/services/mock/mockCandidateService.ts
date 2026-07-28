import { candidates } from "../../mocks";
import type { Candidate } from "../../types/domain";
import { getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "candidates";

export const mockCandidateService = {
  getCandidates: (filters?: ListParams) => listFromStorage(KEY, candidates, filters, ["name", "desiredPosition", "location", "education"]),
  getCandidateById: (id: string) => getByIdFromStorage(KEY, candidates, id),
  updateCandidate: (id: string, payload: Partial<Candidate>) => updateInStorage(KEY, candidates, id, payload),
};
