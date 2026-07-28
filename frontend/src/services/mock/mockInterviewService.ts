import { interviews } from "../../mocks";
import type { Interview } from "../../types/domain";
import { createInStorage, getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "interviews";

export const mockInterviewService = {
  getInterviews: (filters?: ListParams) => listFromStorage(KEY, interviews, filters, ["candidateName", "jobTitle", "companyName", "interviewer"]),
  getInterviewById: (id: string) => getByIdFromStorage(KEY, interviews, id),
  createInterview: (payload: Interview) => createInStorage(KEY, interviews, payload),
  updateInterview: (id: string, payload: Partial<Interview>) => updateInStorage(KEY, interviews, id, payload),
};
