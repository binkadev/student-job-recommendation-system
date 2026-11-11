import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../services/api/httpClient";
import { findRecord, listRecords, createInvitation, changeStatus, type Invitation } from "./recruitingApi";
import { appearsFinished, formatWallTime, safeMeetingUrl, validWallTime } from "./recruitingTime";

vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const item: Invitation = { id: 9, companyId: 2, studentId: 4, jobId: 8, message: null, status: "PENDING", createdAt: "2026-11-11T09:00:00", updatedAt: "2026-11-11T09:00:00" };
const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[]) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1 });
beforeEach(() => vi.resetAllMocks());
describe("Recruiting API boundaries", () => {
  it("searches only owned list pages and never invents a detail endpoint", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(envelope({ ...page([]), totalPages: 2, totalItems: 101 }))
      .mockResolvedValueOnce(envelope({ ...page([item]), page: 2 }));
    expect(await findRecord("candidate", "invitations", 9)).toEqual(item);
    expect(httpClient.get).toHaveBeenNthCalledWith(1, "/students/me/invitations", { params: { page: 1, size: 100 }, signal: undefined });
    expect(httpClient.get).toHaveBeenNthCalledWith(2, "/students/me/invitations", { params: { page: 2, size: 100 }, signal: undefined });
  });
  it.each([null, { items: null }, { ...page([]), totalItems: -1 }])("rejects malformed page data instead of returning an empty list (%s)", async malformed => {
    vi.mocked(httpClient.get).mockResolvedValue(envelope(malformed));
    await expect(listRecords("candidate", "interviews")).rejects.toThrow();
  });
  it("rejects failed envelopes even if data looks empty", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ data: { success: false, data: page([]) } });
    await expect(listRecords("recruiter", "interviews")).rejects.toThrow();
  });
  it("aborts detail traversal before requesting later pages", async () => {
    const abort = new AbortController();
    vi.mocked(httpClient.get).mockImplementation(async () => { abort.abort(); return envelope({ ...page([]), totalPages: 100 }); });
    await expect(findRecord("recruiter", "interviews", 99, abort.signal)).rejects.toThrow();
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
  it("posts only invitation DTO fields and PATCH uses the captured status", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(envelope(item));
    vi.mocked(httpClient.patch).mockResolvedValue(envelope({ ...item, status: "CANCELLED" }));
    await createInvitation({ studentId: 4, jobId: 8, message: null });
    expect(httpClient.post).toHaveBeenCalledWith("/companies/me/invitations", { studentId: 4, jobId: 8, message: null }, { signal: undefined });
    await changeStatus("recruiter", "invitations", item, "CANCELLED");
    expect(httpClient.patch).toHaveBeenCalledWith("/companies/me/invitations/9/status", { expectedStatus: "PENDING", status: "CANCELLED" }, { signal: undefined });
    expect(item.status).toBe("PENDING");
  });
});
describe("Wall-clock and safe meeting URL semantics", () => {
  it("formats server fields verbatim without browser timezone conversion", () => {
    expect(formatWallTime("2027-01-15T09:30:00")).toBe("15/01/2027 09:30 (giờ máy chủ)");
    expect(validWallTime("2027-03-14T02:30:00")).toBe(true); // Wall clock remains valid in a DST gap.
    expect(validWallTime("2028-02-29T10:00:00")).toBe(true);
  });
  it.each(["2027-02-29T10:00:00", "2027-13-01T10:00:00", "2027-01-01T24:00:00", "2027-01-01T10:60:00", "2027-01-01T10:00:00Z"])("rejects invalid or timezone-bearing local timestamp %s", value => expect(validWallTime(value)).toBe(false));
  it("calculates completion across a date boundary using wall-clock fields", () => {
    expect(appearsFinished("2027-01-31T23:30:00", 60, new Date(2027, 1, 1, 0, 29, 59))).toBe(false);
    expect(appearsFinished("2027-01-31T23:30:00", 60, new Date(2027, 1, 1, 0, 30, 0))).toBe(true);
  });
  it.each(["javascript:alert(1)", "https:example.test", "https:///", "https:///example.test", "https://@example.test", "https://user:secret@example.test", "https://example.test/a b", "https://example.test:0", "https://example_test"])("rejects unsafe online meeting URL %s", value => expect(safeMeetingUrl(value)).toBe(false));
  it.each(["https://meet.example.test/room", "http://localhost:8080/room"])("accepts absolute HTTP(S) link %s", value => expect(safeMeetingUrl(value)).toBe(true));
});
