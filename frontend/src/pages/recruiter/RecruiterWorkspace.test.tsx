import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterJobsPage } from "./RecruiterJobsPage";
import { RecruiterCandidatesPage } from "./RecruiterCandidatesPage";
import { RecruiterDashboardPage } from "./RecruiterDashboardPage";

vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
// Chart geometry requires a browser; this suite checks data states and actions.
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null, Bar: () => null, BarChart: () => null, CartesianGrid: () => null,
  Cell: () => null, Pie: () => null, PieChart: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

const application = {
  id: 91, studentId: 12, studentName: "Ứng viên thử nghiệm", studentEmail: "student@example.test",
  companyId: 7, jobId: 42, jobTitle: "Frontend Developer", companyName: "IT Company", status: "PENDING",
  cvFileId: null, cvFileName: null, appliedAt: "2026-11-01T10:00:00", updatedAt: "2026-11-01T10:00:00",
};
const job = { id: 42, companyId: 7, companyName: "IT Company", title: "Frontend Developer", status: "ACTIVE", createdAt: "2026-11-01T10:00:00", updatedAt: "2026-11-01T10:00:00", deadline: "2099-12-31", skills: [] };
const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[]) => ({ items, totalItems: items.length, page: 1, size: 100, totalPages: 1 });

function renderPage(element: ReactElement) {
  return render(<ToastProvider><MemoryRouter>{element}</MemoryRouter></ToastProvider>);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === "/companies/me") return envelope({ id: 7, status: "VERIFIED" });
    if (url === "/jobs") return envelope(page([job]));
    if (url === "/skills") return envelope(page([{ id: 5, name: "React", category: "Frontend" }]));
    if (url === "/companies/me/applications") return envelope(page([application]));
    if (url === "/companies/me/saved-candidates") return envelope(page([]));
    throw new Error("Unexpected test endpoint");
  });
});

describe("Recruiter job workspace", () => {
  it("focuses the first invalid field and does not submit an invalid draft", async () => {
    const user = userEvent.setup();
    renderPage(<RecruiterJobsPage mode="create" />);
    await user.click(await screen.findByRole("button", { name: "Lưu nháp" }));
    expect(screen.getByLabelText("Tiêu đề")).toHaveFocus();
    expect(screen.getByLabelText("Tiêu đề")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Vui lòng kiểm tra các trường/)).toHaveAttribute("role", "alert");
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("keeps the draft payload and disables editing while the request is pending", async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.post).mockReturnValue(new Promise(() => undefined));
    renderPage(<RecruiterJobsPage mode="create" />);
    await user.type(await screen.findByLabelText("Tiêu đề"), "React Developer");
    await user.selectOptions(screen.getByLabelText("Địa điểm"), "Hà Nội");
    await user.type(screen.getByLabelText("Mô tả công việc"), "Phát triển giao diện React.");
    await user.type(screen.getByLabelText("Hạn nộp"), "2099-12-31");
    await user.click(await screen.findByRole("checkbox", { name: /React/ }));
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    expect(httpClient.post).toHaveBeenCalledWith("/jobs", expect.objectContaining({
      title: "React Developer", status: "DRAFT", location: "Hà Nội", deadline: "2099-12-31",
      skills: [{ skillId: 5, importance: "REQUIRED", minLevel: "BEGINNER" }],
    }));
    expect(screen.getByLabelText("Tiêu đề")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeDisabled();
  });

  it("shows a load error without showing a successful empty list", async () => {
    vi.mocked(httpClient.get).mockRejectedValue(new Error("Unavailable"));
    renderPage(<RecruiterJobsPage />);
    await screen.findByText(/Không thể tải/);
    expect(screen.queryByText("Không có tin tuyển dụng phù hợp.")).not.toBeInTheDocument();
  });
});

describe("Recruiter application workspace", () => {
  it("retains allowed status transitions and sends the existing PATCH payload", async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.patch).mockResolvedValue(envelope({ ...application, status: "REVIEWED" }));
    renderPage(<RecruiterCandidatesPage />);
    await user.click(await screen.findByRole("button", { name: "Trạng thái" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["REVIEWED", "ACCEPTED", "REJECTED"]);
    await user.click(dialog.getByRole("button", { name: "Cập nhật" }));
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledWith("/applications/91/status", { status: "REVIEWED" }));
  });

  it("labels pipeline counts as current-page data and retains candidate links", async () => {
    renderPage(<RecruiterCandidatesPage mode="pipeline" />);
    await screen.findByText(/Số lượng theo trạng thái trên trang kết quả hiện tại/);
    expect(screen.getByRole("link", { name: "Chi tiết" })).toHaveAttribute("href", "/recruiter/candidates/91");
    expect(screen.getByText("Chưa có CV")).toBeInTheDocument();
  });
});

describe("Recruiter dashboard", () => {
  it("explains the loaded sample and preserves navigation to real workflows", async () => {
    renderPage(<RecruiterDashboardPage />);
    await screen.findByText(/Các số đếm theo trạng thái và biểu đồ/);
    expect(screen.getByRole("link", { name: "Tạo tin tuyển dụng" })).toHaveAttribute("href", "/recruiter/jobs/create");
    expect(screen.getByRole("link", { name: "Xem hồ sơ ứng tuyển" })).toHaveAttribute("href", "/recruiter/candidates");
    expect(screen.getByText(/14 ngày gần nhất từ dữ liệu đã tải/)).toBeInTheDocument();
  });

  it("offers retry on API failure without showing zero statistics as success", async () => {
    vi.mocked(httpClient.get).mockRejectedValue(new Error("Unavailable"));
    renderPage(<RecruiterDashboardPage />);
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeEnabled();
    expect(screen.queryByText("Tin đang tuyển")).not.toBeInTheDocument();
  });
});
