import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateApplyFlowModal } from "./CandidateApplyFlowModal";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../../services/api/httpClient";

const state = vi.hoisted(() => ({ currentUser: { id: "4", role: "candidate" }, toast: vi.fn() }));
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => state }));
vi.mock("../../../hooks/useToast", () => ({ useToast: () => ({ showToast: state.toast }) }));
vi.mock("../../../services/api/httpClient", () => ({ AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token", httpClient: { get: vi.fn(), post: vi.fn() } }));
const job = { id: "11", title: "Lifecycle role", companyName: "Secondary Company" };
const rejected = { id: 22, jobId: 11, status: "REJECTED", appliedAt: "2026-11-01T08:00:00" };
let history = [rejected], status = "ACTIVE", historyError = false;
const envelope = (data: unknown) => ({ data: { success: true, data } });
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "test-only-token");
  history = [{ ...rejected }]; status = "ACTIVE"; historyError = false; state.currentUser = { id: "4", role: "candidate" };
  vi.mocked(httpClient.get).mockImplementation(async url => {
    if (url === "/students/me/applications") { if (historyError) throw new Error("offline history"); return envelope(history); }
    if (url === "/jobs/11") return envelope({ status, deadline: "2099-12-31" });
    if (url === "/students/me/cv") return envelope([{ id: 1, originalFileName: "ready.pdf", isActive: true }, { id: 2, originalFileName: "failed.pdf" }]);
    if (url === "/students/me/cv/1/analysis") return envelope({ status: "READY" });
    if (url === "/students/me/cv/2/analysis") return envelope({ status: "FAILED" });
    throw new Error(`Unexpected GET ${url}`);
  });
});
function show() { return render(<MemoryRouter><CandidateApplyFlowModal job={job} onClose={vi.fn()} /></MemoryRouter>); }
async function review() {
  await screen.findByRole("button", { name: /ready.pdf/ });
  await userEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  await userEvent.type(screen.getByLabelText("Nội dung thư giới thiệu"), "A new letter for a new history row.");
  await userEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Tôi xác nhận thông tin ứng tuyển là chính xác." }));
  return screen.getByRole("button", { name: "Gửi ứng tuyển" });
}

describe("Apply/reapply modal with confirmed application history (HTTP mocks)", () => {
  it("labels reapply, offers only READY CVs and sends exactly one new cover letter/CV mutation", async () => {
    show(); await screen.findByRole("heading", { name: "Ứng tuyển lại Lifecycle role" });
    expect(screen.queryByRole("button", { name: /failed.pdf/ })).not.toBeInTheDocument();
    let complete!: (value: ReturnType<typeof envelope>) => void;
    vi.mocked(httpClient.post).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const submit = await review(); await waitFor(() => expect(submit).toBeEnabled());
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith("/jobs/11/apply", { cvFileId: 1, coverLetter: "A new letter for a new history row." });
    expect(screen.queryByRole("heading", { name: "Ứng tuyển thành công" })).not.toBeInTheDocument();
    history = [{ id: 23, jobId: 11, status: "PENDING", appliedAt: "2026-11-02T08:00:00" }, rejected];
    await act(async () => { complete(envelope(history[0])); });
    await screen.findByRole("heading", { name: "Ứng tuyển thành công" });
    expect(history[1]).toEqual(rejected);
  });

  it.each(["WITHDRAWN", "PENDING"])("cannot submit for latest %s", async applicationStatus => {
    history = [{ ...rejected, status: applicationStatus }]; show(); const submit = await review();
    expect(submit).toBeDisabled(); expect(httpClient.post).not.toHaveBeenCalled();
    if (applicationStatus === "WITHDRAWN") expect(screen.getByText("Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.")).toBeVisible();
  });

  it("blocks unverified history and ineligible Jobs without claiming success", async () => {
    historyError = true; status = "CLOSED"; show(); const submit = await review();
    await screen.findByText("Chưa xác minh được trạng thái ứng tuyển. Hãy tải lại trước khi gửi đơn.");
    expect(submit).toBeDisabled(); expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("preserves the draft on failed POST and reads Backend before enabling a controlled retry", async () => {
    show(); const submit = await review(); await waitFor(() => expect(submit).toBeEnabled());
    vi.mocked(httpClient.post).mockRejectedValue(new Error("offline")); await userEvent.click(submit);
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", title: "Không thể gửi ứng tuyển" })));
    expect(screen.getByText("A new letter for a new history row.")).toBeVisible();
    expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(httpClient.get).mock.calls.filter(([url]) => url === "/students/me/applications").length).toBeGreaterThan(1);
  });
});
