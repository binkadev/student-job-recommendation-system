import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/feedback/ToastProvider";
import { RecruiterDashboardPage } from "../../../pages/recruiter/RecruiterDashboardPage";
import { RecruiterReportsPage } from "../../../pages/recruiter/RecruiterReportsPage";
import { httpClient } from "../../../services/api/httpClient";

vi.mock("../../../services/api/httpClient", () => ({ AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token", httpClient: { get: vi.fn() } }));
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => ({ currentUser: { id: "1" } }) }));
vi.mock("recharts", () => ({ ResponsiveContainer: () => null, Bar: () => null, BarChart: () => null, CartesianGrid: () => null, Cell: () => null, Legend: () => null, Pie: () => null, PieChart: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
const envelope = (data: unknown) => ({ data: { success: true, data } });
const application = { id: 1, status: "PENDING", studentName: "Synthetic", studentEmail: "example@test.invalid", jobId: 1, jobTitle: "Synthetic job", appliedAt: "2026-11-04T10:00:00" };
const summary = { totalApplications: 360, uniqueStudents: 130, statusCounts: { PENDING: 72, REVIEWED: 72, ACCEPTED: 72, REJECTED: 72, WITHDRAWN: 72 }, acceptedRate: 20 };
export const reportFixture = { summary, scope: { from: null, to: null, jobId: null, status: null, keyword: null, timeZone: "UTC" }, trend: [], topJobs: [], topJobLimit: 10,
  applications: { items: [application], page: 1, size: 10, totalItems: 360, totalPages: 36 } };
export const dashboardFixture = { summary, jobCounts: { ACTIVE: 130, DRAFT: 0, PENDING_APPROVAL: 0, CLOSED: 0, REJECTED: 0, EXPIRED: 0 }, totalJobs: 130,
  trend: [], trendFrom: "2026-10-06", trendTo: "2026-11-04", timeZone: "UTC", topJobs: [], expiringJobs: [], expiringJobCount: 0,
  recentApplications: { items: [], page: 1, size: 5, totalItems: 360, totalPages: 72 } };
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.setItem("job-system:auth-token", "analytics-session");
  vi.mocked(httpClient.get).mockImplementation(async url => {
    if (url === "/companies/me/dashboard-summary") return envelope(dashboardFixture);
    if (url === "/companies/me/recruitment-report") return envelope(reportFixture);
    if (url === "/companies/me") return envelope({ id: 1 });
    if (url === "/jobs") return envelope({ items: Array.from({ length: 100 }, (_, i) => ({ id: i + 1, companyId: 1, title: "Synthetic job", status: "ACTIVE" })), totalItems: 260 });
    if (url === "/companies/me/applications") return envelope({ items: Array.from({ length: 100 }, (_, i) => ({ ...application, id: i + 1 })), totalItems: 360 });
    throw new Error("Unexpected endpoint");
  });
});
function mount(page: React.ReactNode) { return render(<ToastProvider><MemoryRouter>{page}</MemoryRouter></ToastProvider>); }
it("Dashboard counts all 130 owned jobs rather than the first 100 returned jobs", async () => {
  mount(<RecruiterDashboardPage />);
  expect(await screen.findByRole("link", { name: /Tin đang tuyển.*130/ })).toBeVisible();
  expect(screen.getByRole("link", { name: "Tạo tin tuyển dụng" })).toHaveAttribute("href", "/recruiter/jobs/create");
});
it("Reports uses all 360 filtered histories rather than 100 loaded applications", async () => {
  mount(<RecruiterReportsPage />);
  const label = await screen.findByText("Đơn trong phạm vi lọc");
  expect(label.parentElement).toHaveTextContent("360");
});
it("submits month, owned Job, status and literal keyword filters before aggregation", async () => {
  mount(<RecruiterReportsPage />); await screen.findByText("Đơn trong phạm vi lọc");
  fireEvent.change(screen.getByLabelText("Từ tháng (UTC)"), { target: { value: "2026-11" } });
  fireEvent.change(screen.getByLabelText("Đến tháng (UTC)"), { target: { value: "2026-11" } });
  fireEvent.change(screen.getByLabelText("Mã Job"), { target: { value: "42" } });
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "REJECTED" } });
  fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "% literal" } });
  fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm báo cáo" }));
  await waitFor(() => expect(httpClient.get).toHaveBeenLastCalledWith("/companies/me/recruitment-report", { params: { from: "2026-11-01", to: "2026-11-30", jobId: "42", status: "REJECTED", keyword: "% literal", page: 1, size: 10 } }));
});
it("retains a labeled confirmed snapshot on failure and disables export until explicit retry", async () => {
  mount(<RecruiterReportsPage />); await screen.findByText("Đơn trong phạm vi lọc");
  vi.mocked(httpClient.get).mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(screen.getByRole("button", { name: "Tải lại báo cáo" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Đơn trong phạm vi lọc").parentElement).toHaveTextContent("360");
  expect(screen.getByText(/snapshot đã xác nhận trước đó/)).toBeVisible();
  expect(screen.getByRole("button", { name: "Xuất toàn bộ CSV theo bộ lọc" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Tải lại báo cáo" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Xuất toàn bộ CSV theo bộ lọc" })).toBeEnabled());
});
it("ignores a late response when status changes and presents real zero as not-applicable rate", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(httpClient.get).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  vi.mocked(httpClient.get).mockResolvedValue(envelope({ ...reportFixture, scope: { ...reportFixture.scope, status: "REJECTED" }, summary: { ...summary, totalApplications: 0, acceptedRate: null } }));
  mount(<RecruiterReportsPage />);
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "REJECTED" } });
  await screen.findByText("Không áp dụng (0 đơn)");
  await act(async () => resolve(envelope(reportFixture)));
  expect(screen.getByText("Đơn trong phạm vi lọc").parentElement).toHaveTextContent("0");
  expect(screen.getByTestId("analytics-scope")).toHaveTextContent("trạng thái REJECTED");
});
it("exports through the authenticated full-filter API without page limits or premature success", async () => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:report") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  mount(<RecruiterReportsPage />); await screen.findByText("Đơn trong phạm vi lọc");
  let resolve!: (value: unknown) => void;
  vi.mocked(httpClient.get).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất toàn bộ CSV theo bộ lọc" }));
  expect(httpClient.get).toHaveBeenLastCalledWith("/companies/me/recruitment-report/export", { params: {} });
  expect(screen.queryByText("Đã xuất 360 đơn theo bộ lọc")).not.toBeInTheDocument();
  await act(async () => resolve(envelope({ csv: "\uFEFFid\r\n1\r\n", rowCount: 360 })));
  expect(await screen.findByText("Đã xuất 360 đơn theo bộ lọc")).toBeVisible();
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});
