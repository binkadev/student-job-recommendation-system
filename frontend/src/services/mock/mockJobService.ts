import { jobs } from "../../mocks";
import type { Job } from "../../types/domain";
import { createInStorage, deleteFromStorage, getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "jobs";

export const mockJobService = {
  getJobs: (filters?: ListParams) => listFromStorage(KEY, jobs, filters, ["title", "companyName", "location", "industry"]),
  getJobById: (id: string) => getByIdFromStorage(KEY, jobs, id),
  createJob: (payload: Job) => createInStorage(KEY, jobs, payload),
  updateJob: (id: string, payload: Partial<Job>) => updateInStorage(KEY, jobs, id, payload),
  deleteJob: (id: string) => deleteFromStorage(KEY, jobs, id),
};
