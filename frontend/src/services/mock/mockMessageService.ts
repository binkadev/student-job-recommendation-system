import { conversations } from "../../mocks";
import type { Conversation } from "../../types/domain";
import { getByIdFromStorage, listFromStorage, updateInStorage, type ListParams } from "./baseMockService";

const KEY = "conversations";

export const mockMessageService = {
  getConversations: (filters?: ListParams) => listFromStorage(KEY, conversations, filters, ["participantName", "subject"]),
  getConversationById: (id: string) => getByIdFromStorage(KEY, conversations, id),
  updateConversation: (id: string, payload: Partial<Conversation>) => updateInStorage(KEY, conversations, id, payload),
};
