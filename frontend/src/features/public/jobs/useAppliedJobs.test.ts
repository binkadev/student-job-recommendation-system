import { describe, expect, it } from "vitest";
import { canApplyForJob, getApplicationStateForJob, getApplyButtonLabelForState } from "./useAppliedJobs";

describe("status-aware application state", () => {
  it("allows reapplication only after the latest REJECTED application", () => {
    const applications = [
      { id: 1, jobId: 10, status: "PENDING", appliedAt: "2026-01-01T00:00:00Z" },
      { id: 2, jobId: 10, status: "REJECTED", appliedAt: "2026-02-01T00:00:00Z" },
    ];
    const state = getApplicationStateForJob(applications, "10");
    expect(state).toBe("REJECTED_CAN_REAPPLY");
    expect(canApplyForJob(state)).toBe(true);
    expect(getApplyButtonLabelForState(state)).toBe("Ứng tuyển lại");
  });

  it.each(["PENDING", "REVIEWED", "ACCEPTED", "WITHDRAWN"])('blocks %s', (status) => {
    const state = getApplicationStateForJob([{ id: 1, jobId: 10, status, appliedAt: "2026-02-01T00:00:00Z" }], "10");
    expect(canApplyForJob(state)).toBe(false);
  });
});
