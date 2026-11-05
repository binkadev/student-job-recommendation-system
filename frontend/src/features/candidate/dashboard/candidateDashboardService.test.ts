import { beforeEach, expect, it, vi } from "vitest";
import { httpClient } from "../../../services/api/httpClient";
import { getCandidateDashboardData } from "./candidateDashboardService";
vi.mock("../../../services/api/httpClient", () => ({ httpClient: { get: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(httpClient.get).mockImplementation(async url => ({ data: { data:
    url === "/students/me" ? { id: 1, fullName: "Student", email: "student@test.invalid" } :
    url === "/students/me/profile" ? { profileCompleteness: 60 } :
    url === "/public/jobs" ? { totalItems: 900, items: [] } :
    url === "/students/me/saved-jobs" ? { totalItems: 180, items: [] } :
    url === "/students/me/applications" ? Array.from({ length: 150 }, (_, id) => ({ id, jobId: 1, jobTitle: "Synthetic", status: "REJECTED", appliedAt: "2026-11-01T00:00:00", updatedAt: "2026-11-01T00:00:00" })) :
    url === "/students/me/cv" ? [{ id: 1 }, { id: 2 }] : url === "/students/me/cv/active" ? null :
    url === "/notifications" ? { totalItems: 50, items: [] } : { unreadCount: 42 } } }));
});
it("uses public/saved server totals and complete owned histories, separately from recent slices", async () => {
  const data = await getCandidateDashboardData();
  expect(data.stats).toEqual({ activeJobs: 900, savedJobs: 180, applications: 150, cvs: 2 });
  expect(data.applications).toHaveLength(5);
  expect(data.unreadNotifications).toBe(42);
});
it("propagates a source failure instead of publishing fabricated zero statistics", async () => {
  vi.mocked(httpClient.get).mockRejectedValueOnce(new Error("Offline"));
  await expect(getCandidateDashboardData()).rejects.toThrow("Offline");
});
