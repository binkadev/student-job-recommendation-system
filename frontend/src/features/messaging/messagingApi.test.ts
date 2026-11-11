import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../services/api/httpClient";
import { contentError, createConversation, findConversation, listConversations, listMessages, markRead, ownedApplication, sendMessage } from "./messagingApi";
vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const conversation = { id: 21, applicationId: 9, companyId: 7, studentId: 4, jobId: 8, lastMessageAt: null, createdAt: "2026-11-12T09:30:00", updatedAt: "2026-11-12T09:30:00" };
const message = { id: 1, conversationId: 21, senderUserId: 4, senderRole: "STUDENT", content: "text", isRead: false, createdAt: "2026-11-12T09:30:00" };
const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[], overrides = {}) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1, ...overrides });
beforeEach(() => vi.resetAllMocks());
describe("Messaging API boundaries", () => {
  it.each([null, { items: null }, page([], { size: 101 }), page([], { page: 0 }), page([], { totalItems: -1 }), page([{ id: 21 }])])("rejects malformed response rather than fabricating an empty inbox (%#)", async invalid => {
    vi.mocked(httpClient.get).mockResolvedValue(envelope(invalid));
    await expect(listConversations()).rejects.toThrow();
  });
  it("rejects failed envelopes even when an empty data page is present", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: { success: false, data: page([]) } });
    await expect(listConversations()).rejects.toThrow();
  });
  it("aborts owner-list traversal before any next page is requested", async () => {
    const abort = new AbortController();
    vi.mocked(httpClient.get).mockImplementation(async () => { abort.abort(); return envelope(page([], { size: 100, totalPages: 10 })); });
    await expect(findConversation(21, abort.signal)).rejects.toThrow(); expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
  it("bounds detail lookup to the initial totalPages even if later activity changes the list", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(envelope(page([], { size: 100, totalPages: 2 })))
      .mockResolvedValueOnce(envelope(page([], { page: 2, size: 100, totalPages: 999 })));
    await expect(findConversation(21)).rejects.toThrow(); expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
  it("posts only DTO fields and uses a bodyless PATCH", async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce(envelope(conversation)).mockResolvedValueOnce(envelope(message));
    vi.mocked(httpClient.patch).mockResolvedValue(envelope({ conversationId: 21, markedCount: 0 }));
    await createConversation(9); await sendMessage(21, "original text"); await markRead(21);
    expect(httpClient.post).toHaveBeenNthCalledWith(1, "/conversations", { applicationId: 9 }, { signal: undefined });
    expect(httpClient.post).toHaveBeenNthCalledWith(2, "/conversations/21/messages", { content: "original text" }, { signal: undefined });
    expect(httpClient.patch).toHaveBeenCalledWith("/conversations/21/read", undefined, { signal: undefined });
  });
  it("rejects mismatched Application metadata and conversations", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(envelope({ id: 99 }));
    await expect(ownedApplication("candidate", 9)).rejects.toThrow();
    vi.mocked(httpClient.post).mockResolvedValue(envelope({ ...conversation, applicationId: 99 }));
    await expect(createConversation(9)).rejects.toThrow();
  });
  it("rejects mismatched conversation message/read responses", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(envelope(page([{ ...message, conversationId: 99 }])));
    await expect(listMessages(21)).rejects.toThrow();
    vi.mocked(httpClient.patch).mockResolvedValue(envelope({ conversationId: 99, markedCount: 5 }));
    await expect(markRead(21)).rejects.toThrow();
  });
  it("validates the exact UTF-16 boundary including Unicode, blank text and NUL", () => {
    const unicode = String.fromCodePoint(0x1F600).repeat(2500);
    expect(contentError(unicode)).toBe(""); expect(contentError(unicode + "x")).not.toBe("");
    expect(contentError(" \n\t")).not.toBe(""); expect(contentError("text" + String.fromCharCode(0))).not.toBe("");
    expect(contentError("  original  ")).toBe("");
  });
});
