import { analytics, categories, reports, users } from "../../mocks";
import type { CategoryItem, Report, UserAccount } from "../../types/domain";
import { createInStorage, deleteFromStorage, getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";
import { mockDelay } from "../../utils/mockDelay";

export const mockAdminService = {
  getUsers: (filters?: ListParams) => listFromStorage("users", users, filters, ["name", "email", "role"]),
  getUserById: (id: string) => getByIdFromStorage("users", users, id),
  updateUser: (id: string, payload: Partial<UserAccount>) => updateInStorage("users", users, id, payload),
  getReports: (filters?: ListParams) => listFromStorage("reports", reports, filters, ["type", "reporter", "target"]),
  updateReport: (id: string, payload: Partial<Report>) => updateInStorage("reports", reports, id, payload),
  getCategories: (filters?: ListParams) => listFromStorage("categories", categories, filters, ["name", "type"]),
  createCategory: (payload: CategoryItem) => createInStorage("categories", categories, payload),
  updateCategory: (id: string, payload: Partial<CategoryItem>) => updateInStorage("categories", categories, id, payload),
  deleteCategory: (id: string) => deleteFromStorage("categories", categories, id),
  getAnalytics: () => mockDelay(analytics),
};
