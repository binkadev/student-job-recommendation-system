import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { CandidateCvsPage } from "./CandidateCvsPage";

vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), patch: vi.fn() } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(httpClient.get).mockResolvedValue({ data: { data: [
    { id: 1, originalFileName: "active.pdf", isActive: true, deletable: true },
    { id: 2, originalFileName: "other.pdf", isActive: false, deletable: true },
  ] } });
});
const renderPage = () => render(<ToastProvider><MemoryRouter><CandidateCvsPage /></MemoryRouter></ToastProvider>);

describe("CV list activation (mocked HTTP regression)", () => {
  it("reports failed activation and keeps the original active CV", async () => {
    vi.mocked(httpClient.patch).mockRejectedValue(new Error("offline"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Đặt làm CV đang dùng" }));
    expect(await screen.findByText("Không thể đặt CV đang dùng")).toBeInTheDocument();
    expect(screen.queryByText("Đã đặt CV đang dùng")).not.toBeInTheDocument();
    expect(screen.getAllByText("Đang dùng")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Đặt làm CV đang dùng" })).toBeEnabled();
  });

  it("prevents another activation while the first request is pending", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(httpClient.patch).mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    renderPage();
    const button = await screen.findByRole("button", { name: "Đặt làm CV đang dùng" });
    await userEvent.dblClick(button);
    expect(button).toBeDisabled();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("offline")));
    await waitFor(() => expect(button).toBeEnabled());
  });
});
