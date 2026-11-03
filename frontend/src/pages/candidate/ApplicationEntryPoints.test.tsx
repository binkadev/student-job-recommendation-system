import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateJobsPage } from "./CandidateJobsPage";
import { JobDetailPage } from "../public/JobDetailPage";
import { CandidateSavedJobsPage } from "../../features/candidate/savedJobs/CandidateSavedJobsPage";
import { httpClient } from "../../services/api/httpClient";

const state = vi.hoisted(() => ({ kind: "REJECTED_CAN_REAPPLY", error: null as string | null }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ currentUser: { id: "4", role: "candidate" }, currentRole: "candidate", isAuthenticated: true }) }));
vi.mock("../../hooks/useToast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../hooks/useSavedJobs", () => ({ useSavedJobs: () => ({ toggleSavedJob: vi.fn() }) }));
vi.mock("../../features/candidate/apply/CandidateApplyFlowModal", () => ({ CandidateApplyFlowModal: () => null }));
vi.mock("../../features/public/jobs/useAppliedJobs", async importOriginal => ({
  ...await importOriginal<typeof import("../../features/public/jobs/useAppliedJobs")>(),
  useAppliedJobs: () => ({
    applications: [{ id: 22, jobId: 11, status: "REJECTED" }], getApplicationState: () => state.kind,
    canApply: () => state.kind === "REJECTED_CAN_REAPPLY" && !state.error,
    getApplyButtonLabel: () => state.error ? "Chưa xác minh ứng tuyển" : state.kind === "REJECTED_CAN_REAPPLY" ? "Ứng tuyển lại" : "Không thể ứng tuyển",
    syncError: state.error, syncing: false, refreshAppliedJobs: vi.fn(),
  }),
}));
vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn() } }));
vi.mock("../../features/public/jobs/jobDetailService", () => ({ getPublicJobDetail: async () => ({ job: {
  id: "11", title: "Lifecycle role", companyId: "3", companyName: "Company", logo: "CO", requiredSkills: [],
  detailStatus: "open", benefits: [], requirements: [], recruitmentProcess: [], description: [], companyWebsite: "", deadline: "31/12/2099",
} }) }));
beforeEach(() => {
  state.kind = "REJECTED_CAN_REAPPLY"; state.error = null;
  const job = { id: 11, jobId: 11, savedJobId: 4, companyId: 3, title: "Lifecycle role", companyName: "Company", status: "ACTIVE", skills: [], deadline: "2099-12-31", createdAt: "2026-11-01", savedAt: "2026-11-01" };
  vi.mocked(httpClient.get).mockImplementation(async url => ({ data: { data: url === "/jobs/11" ? job : { items: [job], page: 1, totalPages: 1, totalItems: 1 } } }));
});
function show(surface: string) {
  const path = surface === "public" ? "/jobs/11" : surface === "detail" ? "/candidate/jobs/11" : surface === "saved" ? "/candidate/jobs/saved" : "/candidate/jobs";
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/jobs/:jobId" element={<JobDetailPage />} />
    <Route path="/candidate/jobs/:jobId" element={<CandidateJobsPage mode="detail" />} />
    <Route path="/candidate/jobs/saved" element={<CandidateSavedJobsPage />} />
    <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
  </Routes></MemoryRouter>);
}
describe("Application lifecycle entry points (mocked APIs and confirmed hook state)", () => {
  it.each(["public", "detail", "saved", "list"])("%s labels rejected history as reapply", async surface => {
    show(surface); expect((await screen.findAllByText("Ứng tuyển lại")).length).toBeGreaterThan(0);
  });
  it.each(["public", "detail"])("%s blocks WITHDRAWN and displays the policy", async surface => {
    state.kind = "WITHDRAWN_BLOCKED"; show(surface);
    const buttons = await screen.findAllByRole("button", { name: "Không thể ứng tuyển" });
    buttons.forEach(button => expect(button).toBeDisabled());
    expect(screen.getByText("Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.")).toBeVisible();
  });
  it("Public detail never interprets unavailable application history as no previous application", async () => {
    state.kind = "UNKNOWN"; state.error = "History unavailable"; show("public");
    const buttons = await screen.findAllByRole("button", { name: "Chưa xác minh ứng tuyển" });
    buttons.forEach(button => expect(button).toBeDisabled());
    expect(screen.getByText("Chưa xác minh được lịch sử ứng tuyển.")).toBeVisible();
  });
});
