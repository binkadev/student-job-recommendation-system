import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateApplicationsPage } from "./CandidateApplicationsPage";
import { httpClient } from "../../services/api/httpClient";

const state = vi.hoisted(() => ({ currentUser: { id: "4", role: "candidate" }, toast: vi.fn() }));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => state }));
vi.mock("../../hooks/useToast", () => ({ useToast: () => ({ showToast: state.toast }) }));
vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), patch: vi.fn() } }));
const original = { id: 22, studentId: 2, studentName: "Secondary Student", studentEmail: "synthetic@example.test", jobId: 11, jobTitle: "Lifecycle role", companyId: 3, companyName: "Secondary Company", status: "PENDING", cvFileId: 4, cvFileName: "ready.pdf", coverLetter: "New letter", appliedAt: "2026-11-01T08:00:00", createdAt: "2026-11-01T08:00:00", updatedAt: "2026-11-01T08:00:00", reviewedAt: null };
let application = { ...original };
const envelope = (data: unknown) => ({ data: { success: true, data } });
beforeEach(() => {
  vi.resetAllMocks(); application = { ...original }; state.currentUser = { id: "4", role: "candidate" };
  vi.mocked(httpClient.get).mockImplementation(async url => envelope(url === "/students/me/applications" ? [application] : application));
});
function show(mode: "list" | "detail" | "status") {
  const route = mode === "list" ? "/candidate/applications" : `/candidate/applications/22${mode === "status" ? "/status" : ""}`;
  return render(<MemoryRouter initialEntries={[route]}><Routes><Route path="/candidate/applications" element={<CandidateApplicationsPage mode={mode} />} /><Route path="/candidate/applications/:applicationId/*" element={<CandidateApplicationsPage mode={mode} />} /></Routes></MemoryRouter>);
}
async function confirm() {
  await userEvent.click(await screen.findByRole("button", { name: "Rút đơn ứng tuyển" }));
  return screen.getByRole("dialog", { name: "Rút đơn ứng tuyển" });
}

describe("Student application withdrawal (mocked HTTP; real PostgreSQL/browser tested separately)", () => {
  it.each(["list", "detail", "status"] as const)("%s confirms/cancels and coalesces double click without optimistic status", async mode => {
    show(mode); let complete!: (value: ReturnType<typeof envelope>) => void;
    vi.mocked(httpClient.patch).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    let dialog = await confirm();
    expect(within(dialog).getByText("Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(httpClient.patch).not.toHaveBeenCalled();
    dialog = await confirm(); const button = within(dialog).getByRole("button", { name: "Xác nhận rút đơn" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(httpClient.patch).toHaveBeenCalledWith("/applications/22/status", { status: "WITHDRAWN" });
    expect(button).toBeDisabled(); expect(screen.queryByText("Đã rút", { selector: "span" })).not.toBeInTheDocument();
    expect(state.toast).not.toHaveBeenCalled();
    application = { ...application, status: "WITHDRAWN" };
    await act(async () => { complete(envelope(application)); });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Rút đơn ứng tuyển" })).not.toBeInTheDocument();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Đã rút đơn ứng tuyển" }));
  });

  it.each(["REVIEWED", "ACCEPTED", "REJECTED", "WITHDRAWN"])("never exposes withdrawal for %s in list/detail/status", async status => {
    application.status = status;
    for (const mode of ["list", "detail", "status"] as const) {
      const view = show(mode); await screen.findByRole("heading", { name: "Lifecycle role" });
      expect(screen.queryByRole("button", { name: "Rút đơn ứng tuyển" })).not.toBeInTheDocument(); view.unmount();
    }
  });

  it("retains confirmed state on network failure; explicit GET reconciles an ambiguous commit without another PATCH", async () => {
    show("detail"); vi.mocked(httpClient.patch).mockRejectedValue(new Error("offline"));
    const dialog = await confirm(); await userEvent.click(within(dialog).getByRole("button", { name: "Xác nhận rút đơn" }));
    await within(dialog).findByRole("alert");
    expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    expect(screen.queryByText("Đã rút")).not.toBeInTheDocument();
    application.status = "WITHDRAWN";
    await userEvent.click(within(dialog).getByRole("button", { name: "Tải lại trạng thái" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(httpClient.get).toHaveBeenCalledWith("/students/me/applications/22");
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });

  it("reads Company review after a400 rule rejection without overwriting it", async () => {
    show("status"); const dialog = await confirm();
    application.status = "REVIEWED";
    vi.mocked(httpClient.patch).mockRejectedValue({ response: { status: 400, data: { message: "Invalid application status transition" } } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Xác nhận rút đơn" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByText("Đã xem").length).toBeGreaterThan(0);
    expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  });

  it("retains the last confirmed list on failed reload and does not show a false empty initial state", async () => {
    vi.mocked(httpClient.get).mockRejectedValue(new Error("offline")); show("list");
    await screen.findByRole("alert"); expect(screen.queryByText(/Bạn chưa gửi đơn ứng tuyển nào/)).not.toBeInTheDocument();
    vi.mocked(httpClient.get).mockImplementation(async url => envelope(url === "/students/me/applications" ? [application] : application));
    await userEvent.click(screen.getByRole("button", { name: "Tải lại" })); await screen.findByText("Lifecycle role");
    vi.mocked(httpClient.get).mockRejectedValue(new Error("offline"));
    await userEvent.click(screen.getByRole("button", { name: "Tải lại" })); await screen.findByRole("alert");
    expect(screen.getByText("Lifecycle role")).toBeVisible();
    expect(screen.getByRole("button", { name: "Rút đơn ứng tuyển" })).toBeDisabled();
  });
});
