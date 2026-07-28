import { cvs } from "../../mocks";
import type { Cv } from "../../types/domain";
import { createInStorage, deleteFromStorage, getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "cvs";

export const mockCvService = {
  getCvs: (filters?: ListParams) => listFromStorage(KEY, cvs, filters, ["fileName"]),
  getCvById: (id: string) => getByIdFromStorage(KEY, cvs, id),
  createCv: (payload: Cv) => createInStorage(KEY, cvs, payload),
  updateCv: (id: string, payload: Partial<Cv>) => updateInStorage(KEY, cvs, id, payload),
  deleteCv: (id: string) => deleteFromStorage(KEY, cvs, id),
};
