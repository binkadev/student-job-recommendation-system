import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { getCompanyJobActions } from "../../features/recruiter/jobModerationActions";
import { RecruiterJobsPage } from "./RecruiterJobsPage";

vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const envelope = (data: unknown) => ({ data: { data, success: true } });
let companyStatus = "VERIFIED";
let job = { id: 42, companyId: 7, companyName: "Synthetic Company", title: "Java Intern", status: "DRAFT", description: "Develop services with a mentor.", requirements: "Java", benefits: "Mentoring", location: "Hà Nội", jobType: "INTERNSHIP", workingModel: "HYBRID", salaryMin: null, salaryMax: null, currency: "VND", deadline: "2099-12-31", skills: [], createdAt: "2026-01-01T00:00:00" };
beforeEach(() => {
  vi.resetAllMocks(); companyStatus = "VERIFIED"; job = { ...job, status: "DRAFT", title: "Java Intern" };
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === "/companies/me") return envelope({ id: 7, status: companyStatus });
    if (url === "/jobs/42") return envelope({ ...job });
    if (url === "/companies/me/jobs") return envelope({ items: [{ ...job }], totalPages: 1, totalItems: 1, page: 1, size: 8 });
    if (url === "/skills") return envelope({ items: [] });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.mocked(httpClient.put).mockImplementation(async (_, payload) => { job = { ...job, ...payload as object }; return envelope(job); });
  vi.mocked(httpClient.patch).mockImplementation(async (_, payload) => { job = { ...job, ...payload as object }; return envelope(job); });
});
function renderPage(mode: "list" | "edit" | "create" = "list") {
  return render(<ToastProvider><MemoryRouter initialEntries={["/recruiter/jobs/42/edit"]}><Routes>
    <Route path="/recruiter/jobs/:jobId/edit" element={<RecruiterJobsPage mode={mode} />} />
  </Routes></MemoryRouter></ToastProvider>);
}

describe("Company moderation presentation (Backend remains authoritative)", () => {
  it.each(["PENDING", "VERIFIED", "BLOCKED"])("maps allowed actions for %s across every Job status", (company) => {
    for (const status of ["DRAFT", "PENDING_APPROVAL", "ACTIVE", "CLOSED", "REJECTED", "EXPIRED"]) {
      const actions = getCompanyJobActions(status, company);
      expect(actions.edit).toBe(status === "DRAFT");
      expect(actions.submit).toBe(status === "DRAFT" && company === "VERIFIED");
      expect(actions.withdraw).toBe(status === "PENDING_APPROVAL");
      expect(actions.returnToDraft).toBe(["CLOSED", "REJECTED", "EXPIRED"].includes(status));
      expect(actions.close).toBe(status !== "CLOSED");
    }
  });

  it.each(["PENDING", "BLOCKED"])("keeps DRAFT editing available and disables submission for %s", async (state) => {
    companyStatus = state; renderPage("edit");
    await screen.findByLabelText("Tiêu đề");
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Gửi duyệt" })).toBeDisabled();
  });

  it.each(["PENDING", "BLOCKED"])("allows creating a DRAFT before %s verification is resolved", async (state) => {
    companyStatus = state; renderPage("create");
    await screen.findByLabelText("Tiêu đề");
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tạo tin" })).toBeDisabled();
  });

  it("can submit an unchanged DRAFT without an unnecessary content write", async () => {
    renderPage("edit");
    await screen.findByLabelText("Tiêu đề");
    await userEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledWith("/jobs/42/status", { status: "PENDING_APPROVAL" }));
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("does not show content editing for an ACTIVE deep link or write without confirmation", async () => {
    job.status = "ACTIVE"; renderPage("edit");
    await screen.findByRole("heading", { name: "Chuẩn bị chỉnh sửa tin" });
    expect(screen.queryByLabelText("Tiêu đề")).not.toBeInTheDocument();
    expect(httpClient.put).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Đóng tin để chỉnh sửa" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(httpClient.patch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng" }));
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledWith("/jobs/42/status", { status: "CLOSED" }));
    await userEvent.click(await screen.findByRole("button", { name: "Đưa về nháp" }));
    await screen.findByLabelText("Tiêu đề");
    expect(job.status).toBe("DRAFT");
  });

  it("submits content without a smuggled status, then shows the actual pending state", async () => {
    renderPage("edit");
    await userEvent.type(await screen.findByLabelText("Tiêu đề"), " updated");
    await userEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalled());
    expect(vi.mocked(httpClient.put).mock.calls[0][1]).not.toHaveProperty("status");
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledWith("/jobs/42/status", { status: "PENDING_APPROVAL" }));
    await screen.findByRole("button", { name: "Rút về nháp" });
    expect(screen.queryByLabelText("Tiêu đề")).not.toBeInTheDocument();
  });
});
