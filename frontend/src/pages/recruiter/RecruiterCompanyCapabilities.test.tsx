import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterCompanyPage } from "./RecruiterCompanyPage";

const showToast = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useToast", () => ({ useToast: () => ({ showToast }) }));
vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(httpClient.get).mockImplementation(async url => ({ data: { success: true, data: url === "/companies/me/verification-document" ? { submitted: false, revision: 4 } : url === "/companies/me" ? {
    id: 9, companyName: "Doanh nghiệp thử nghiệm", status: "VERIFIED", revision: 4, website: "https://example.invalid", address: "Hà Nội", createdAt: "2026-11-01", updatedAt: "2026-11-01",
  } : { items: [], page: 1, size: 10, totalItems: 0, totalPages: 0 } }, headers: { etag: '"4"' } }));
});
it("keeps supported business fields editable without offering a nonpersisted image upload", async () => {
  render(<MemoryRouter><RecruiterCompanyPage mode="edit" /></MemoryRouter>);
  expect(await screen.findByLabelText("Tên công ty")).toBeEnabled();
  expect(screen.getByLabelText("Mã số thuế")).toBeEnabled();
  expect(screen.getByLabelText("Quy mô công ty")).toBeEnabled();
  expect(screen.getByLabelText("URL logo")).toBeEnabled();
  expect(screen.getByLabelText("URL ảnh bìa")).toBeEnabled();
  expect(screen.getByText(/hiện hỗ trợ ảnh qua URL/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Tải ảnh" })).not.toBeInTheDocument();
  expect(httpClient.put).not.toHaveBeenCalled();
});
it("offers private document selection without an unsupported verification approval action", async () => {
  render(<MemoryRouter><RecruiterCompanyPage mode="verification" /></MemoryRouter>);
  expect(await screen.findByLabelText("Chọn tài liệu xác thực")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Gửi hồ sơ xác thực" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xóa tài liệu" })).not.toBeInTheDocument();
});
it("never emits a successful copy toast when clipboard access fails", async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) } });
  render(<MemoryRouter><RecruiterCompanyPage /></MemoryRouter>);
  await user.click(await screen.findByRole("button", { name: "Copy website" }));
  expect(showToast).toHaveBeenCalledTimes(1);
  expect(showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", title: "Không thể sao chép" }));
});
