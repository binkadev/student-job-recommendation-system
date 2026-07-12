import { notifications } from "../../mocks";
import type { AppNotification } from "../../types/domain";
import { deleteFromStorage, getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "notifications";

export const mockNotificationService = {
  getNotifications: (filters?: ListParams) => listFromStorage(KEY, notifications, filters, ["title", "body"]),
  getNotificationById: (id: string) => getByIdFromStorage(KEY, notifications, id),
  markAsRead: (id: string) => updateInStorage(KEY, notifications, id, { read: true }),
  updateNotification: (id: string, payload: Partial<AppNotification>) => updateInStorage(KEY, notifications, id, payload),
  deleteNotification: (id: string) => deleteFromStorage(KEY, notifications, id),
};
