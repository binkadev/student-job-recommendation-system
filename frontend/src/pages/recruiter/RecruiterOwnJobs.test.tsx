import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterJobsPage } from "./RecruiterJobsPage";

vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const URL = "/companies/me/jobs";
const envelope = (data: unknown) => ({ data: { success: true, data } });
const job = { id: 1, companyId: 7, companyName: "Owner", title: "Confirmed owned role", status: "ACTIVE", skills: [], jobType: "INTERNSHIP", workingModel: "HYBRID", createdAt: "2026-11-01T08:00:00", deadline: "2099-12-31" };
function result(page = 1, total = 130, items = [job]) { return envelope({ page, size: 8, totalItems: total, totalPages: Math.ceil(total / 8), items }); }
type Filters = { page: number; size: number; keyword?: string; status?: string; jobType?: string; workingModel?: string };
let load: (filters: Filters) => Promise<ReturnType<typeof result>>;
beforeEach(() => {
  vi.resetAllMocks(); load = async filters => result(filters.page);
  vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
    if (url === "/companies/me") return envelope({ id: 7, status: "VERIFIED" });
    if (url === URL) return load(config?.params as Filters);
    throw new Error(`Unexpected GET ${url}`);
  });
});
function show() { render(<ToastProvider><MemoryRouter><RecruiterJobsPage /></MemoryRouter></ToastProvider>); }
const pager = () => screen.getByRole("navigation", { name: "Phân trang" });
function deferred() { let resolve!: (value: ReturnType<typeof result>) => void; const promise = new Promise<ReturnType<typeof result>>(r => { resolve = r; }); return { promise, resolve }; }

describe("Owned jobs server pagination (mocked HTTP; 260-row PostgreSQL evidence is separate)", () => {
  it("uses Backend counts and pages beyond 100 without discovery requests or client slicing", async () => {
    show(); await screen.findByText("130 tin tuyển dụng • Trang 1/17");
    expect(httpClient.get).toHaveBeenCalledWith(URL, { params: { page: 1, size: 8, keyword: undefined, status: undefined, jobType: undefined, workingModel: undefined } });
    await userEvent.click(within(pager()).getByRole("button", { name: "Sau" }));
    await screen.findByText("130 tin tuyển dụng • Trang 2/17");
    expect(vi.mocked(httpClient.get).mock.calls.some(([url]) => url === "/jobs")).toBe(false);
    // The singleton page is rendered as returned; no synthetic count from its length.
    expect(screen.getAllByText(job.title).length).toBeGreaterThan(0);
  });

  it("resets page for filters and sends every filter to the server", async () => {
    show(); await screen.findByText("130 tin tuyển dụng • Trang 1/17");
    await userEvent.click(within(pager()).getByRole("button", { name: "Sau" }));
    await screen.findByText("130 tin tuyển dụng • Trang 2/17");
    await userEvent.type(screen.getByLabelText("Từ khóa"), "needle");
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái"), "DRAFT");
    await userEvent.selectOptions(screen.getByLabelText("Loại việc"), "INTERNSHIP");
    await userEvent.selectOptions(screen.getByLabelText("Hình thức"), "REMOTE");
    await waitFor(() => expect(httpClient.get).toHaveBeenLastCalledWith(URL, { params: { page: 1, size: 8, keyword: "needle", status: "DRAFT", jobType: "INTERNSHIP", workingModel: "REMOTE" } }));
  });

  it("retains confirmed rows/count/page on a failed request and recovers only on explicit reload", async () => {
    show(); await screen.findByText("130 tin tuyển dụng • Trang 1/17");
    load = async () => { throw new Error("Offline"); };
    await userEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await screen.findByRole("alert");
    expect(screen.getByText("130 tin tuyển dụng • Trang 1/17")).toBeVisible();
    expect(screen.getAllByText(job.title).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("lần tải thành công gần nhất");
    expect(screen.queryByText("Không có tin tuyển dụng phù hợp.")).not.toBeInTheDocument();
    expect(within(pager()).getByRole("button", { name: "Sau" })).toBeDisabled();
    load = async () => result(1, 131);
    await userEvent.click(screen.getByRole("button", { name: "Thử tải lại" }));
    await screen.findByText("131 tin tuyển dụng • Trang 1/17");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not show fabricated zero/empty states before any successful response", async () => {
    const pending = deferred(); load = () => pending.promise;
    show(); await screen.findByText("Đang tải danh sách...");
    expect(screen.queryByText(/0 tin tuyển dụng/)).not.toBeInTheDocument();
    expect(screen.queryByText("Không có tin tuyển dụng phù hợp.")).not.toBeInTheDocument();
    pending.resolve(result(1, 0, []));
    await screen.findByText("Không có tin tuyển dụng phù hợp.");
    expect(screen.getByText("0 tin tuyển dụng • Trang 1/1")).toBeVisible();
  });

  it("ignores a late stale filter response and labels the retained snapshot while loading", async () => {
    const old = deferred(), latest = deferred();
    load = filters => filters.keyword === "old" ? old.promise : filters.keyword === "new" ? latest.promise : Promise.resolve(result());
    show(); await screen.findByText("130 tin tuyển dụng • Trang 1/17");
    await userEvent.type(screen.getByLabelText("Từ khóa"), "old");
    await userEvent.clear(screen.getByLabelText("Từ khóa")); await userEvent.type(screen.getByLabelText("Từ khóa"), "new");
    expect(screen.getByRole("status")).toHaveTextContent("chưa được xác nhận");
    latest.resolve(result(1, 1, [{ ...job, id: 2, title: "Newest filtered role" }]));
    await screen.findByText("1 tin tuyển dụng • Trang 1/1");
    old.resolve(result(1, 99, [{ ...job, title: "Stale filtered role" }]));
    await waitFor(() => expect(screen.queryByText("Stale filtered role")).not.toBeInTheDocument());
    expect(screen.getByText("1 tin tuyển dụng • Trang 1/1")).toBeVisible();
  });

  it("refreshes and corrects a page that disappeared after a confirmed close", async () => {
    let closed = false;
    load = async filters => closed ? (filters.page === 2 ? result(2, 8, []) : result(1, 8, [{ ...job, id: 2 }])) : result(filters.page, 9);
    vi.mocked(httpClient.delete).mockImplementation(async () => { closed = true; return envelope({ ...job, status: "CLOSED" }); });
    show(); await screen.findByText("9 tin tuyển dụng • Trang 1/2");
    await userEvent.click(within(pager()).getByRole("button", { name: "Sau" }));
    await screen.findByText("9 tin tuyển dụng • Trang 2/2");
    // Responsive table contains the same actions in desktop/mobile presentations.
    await userEvent.click(screen.getAllByRole("button", { name: "Đóng" })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng" }));
    await screen.findByText("8 tin tuyển dụng • Trang 1/1");
    expect(httpClient.delete).toHaveBeenCalledWith("/jobs/1");
  });
});
