import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterCandidatesPage } from "./RecruiterCandidatesPage";
import { RecruiterCompanyPage } from "./RecruiterCompanyPage";
import { RecruiterJobsPage } from "./RecruiterJobsPage";

vi.mock("../../services/api/httpClient", () => ({
  AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token",
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
}));
vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ currentUser: { id: "company-test" } }) }));

const envelope = (data: unknown) => ({ data: { success: true, data } });
const job = (id: number, extra: Record<string, unknown> = {}) => ({
  id, companyId: 7, companyName: "Owner", title: `Own job ${id}`, status: "ACTIVE", location: "Hà Nội",
  createdAt: "2026-11-01T10:00:00", updatedAt: "2026-11-01T10:00:00", deadline: "2099-12-31", skills: [], ...extra,
});
const pageOf = (items: unknown[], page: number, size: number, totalItems: number) => ({
  items, page, size, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / size)),
});

function show(element: ReactElement, path = "/") {
  return render(<ToastProvider><MemoryRouter initialEntries={[path]}>{element}</MemoryRouter></ToastProvider>);
}

type Params = { page: number; size: number; status?: string };
const calls = (url: string) => vi.mocked(httpClient.get).mock.calls.filter(([u]) => u === url);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RecruiterCompanyPage owned job list", () => {
  function mockCompany(jobsHandler: (params: Params) => unknown) {
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
      if (url === "/companies/me") return envelope({ id: 7, companyName: "Owner", status: "VERIFIED", revision: 1 });
      if (url === "/companies/me/jobs") return envelope(jobsHandler(config?.params as Params));
      throw new Error(`Unexpected GET ${url}`);
    });
  }

  it("uses /companies/me/jobs with server pagination and ACTIVE scope, never /jobs", async () => {
    mockCompany((p) => pageOf([job(p.page)], p.page, p.size, 230));
    show(<RecruiterCompanyPage />);
    await screen.findByText("Own job 1");
    expect(httpClient.get).toHaveBeenCalledWith("/companies/me/jobs", { params: { page: 1, size: 5, status: "ACTIVE" } });
    await userEvent.click(screen.getByRole("button", { name: /Sau|2/ }));
    await screen.findByText("Own job 2");
    expect(calls("/jobs")).toHaveLength(0);
    expect(calls("/companies/me/jobs").slice(-1)[0][1]).toEqual({ params: { page: 2, size: 5, status: "ACTIVE" } });
  });

  it("shows an empty state for zero jobs and an error state (not empty) on failure", async () => {
    mockCompany((p) => pageOf([], p.page, p.size, 0));
    const first = show(<RecruiterCompanyPage />);
    await screen.findByText("Công ty chưa có tin đang tuyển.");
    first.unmount();

    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope({ id: 7, companyName: "Owner", status: "VERIFIED", revision: 1 });
      throw new Error("Server down");
    });
    show(<RecruiterCompanyPage />);
    await waitFor(() => expect(screen.queryByText("Công ty chưa có tin đang tuyển.")).not.toBeInTheDocument());
  });
});

describe("RecruiterCandidatesPage job filter source", () => {
  const application = {
    id: 91, studentId: 12, studentName: "Student", studentEmail: "s@example.test", companyId: 7, jobId: 1,
    jobTitle: "Own job 1", companyName: "Owner", status: "PENDING", cvFileId: null, cvFileName: null,
    appliedAt: "2026-11-01T10:00:00", updatedAt: "2026-11-01T10:00:00",
  };

  function mockApi(jobsHandler: (params: Params) => unknown) {
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
      if (url === "/companies/me/jobs") return envelope(jobsHandler(config?.params as Params));
      if (url === "/companies/me/applications") return envelope(pageOf([application], 1, 8, 1));
      if (url === "/companies/me/saved-candidates") return envelope(pageOf([], 1, 100, 0));
      throw new Error(`Unexpected GET ${url}`);
    });
  }

  it("loads every owner Job page (>100) and includes Jobs without applications", async () => {
    mockApi((p) => {
      if (p.page === 1) return pageOf(Array.from({ length: 100 }, (_, i) => job(i + 1)), 1, 100, 205);
      if (p.page === 2) return pageOf(Array.from({ length: 100 }, (_, i) => job(i + 101)), 2, 100, 205);
      return pageOf(Array.from({ length: 5 }, (_, i) => job(i + 201, { title: `No applications ${i + 201}` })), 3, 100, 205);
    });
    show(<RecruiterCandidatesPage />);
    await screen.findByText("Student");
    await waitFor(() => expect(calls("/companies/me/jobs")).toHaveLength(3));
    expect(calls("/companies/me/jobs").map(([, c]) => (c as { params: Params }).params)).toEqual([
      { page: 1, size: 100 }, { page: 2, size: 100 }, { page: 3, size: 100 },
    ]);
    const select = await screen.findByLabelText("Vị trí tuyển dụng");
    await waitFor(() => expect(select).toBeEnabled());
    expect(select.querySelectorAll("option")).toHaveLength(206); // "Tất cả" + 205 jobs
    expect(screen.getByRole("option", { name: "No applications 205" })).toBeInTheDocument();
  });

  it("does not scan application history to derive Jobs", async () => {
    mockApi((p) => pageOf([job(1)], p.page, p.size, 1));
    show(<RecruiterCandidatesPage />);
    await screen.findByText("Student");
    const appCalls = calls("/companies/me/applications").map(([, c]) => (c as { params: Params }).params);
    expect(appCalls.every((p) => p.size !== 100)).toBe(true);
    expect(calls("/jobs")).toHaveLength(0);
  });

  it("surfaces a Jobs API failure without fabricating an empty Job list", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") throw new Error("Forbidden");
      if (url === "/companies/me/applications") return envelope(pageOf([application], 1, 8, 1));
      if (url === "/companies/me/saved-candidates") return envelope(pageOf([], 1, 100, 0));
      throw new Error(`Unexpected GET ${url}`);
    });
    show(<RecruiterCandidatesPage />);
    await screen.findByText("Student");
    await waitFor(() => expect(screen.getByLabelText("Vị trí tuyển dụng")).toBeEnabled());
    expect(await screen.findByText(/Không tải được danh sách vị trí/)).toBeInTheDocument();
  });
});

describe("Job form limits and skill settings", () => {
  const skills = pageOf([{ id: 5, name: "React", category: "Frontend" }, { id: 6, name: "Java", category: "Backend" }], 1, 100, 2);

  function mockForm(detail?: ReturnType<typeof job>) {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope({ id: 7, status: "VERIFIED" });
      if (url === "/skills") return envelope(skills);
      if (detail && url === `/jobs/${detail.id}`) return envelope(detail);
      throw new Error(`Unexpected GET ${url}`);
    });
  }

  async function fillBasics(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("Tiêu đề"), "React Developer");
    await user.selectOptions(screen.getByLabelText("Địa điểm"), "Hà Nội");
    fireEvent.change(screen.getByLabelText("Mô tả công việc"), { target: { value: "Mô tả" } });
    await user.type(screen.getByLabelText("Hạn nộp"), "2099-12-31");
  }

  it("accepts title up to 255 and content up to 10000 characters (Backend DTO limits)", async () => {
    mockForm();
    vi.mocked(httpClient.post).mockResolvedValue(envelope(job(99)));
    const user = userEvent.setup();
    show(<RecruiterJobsPage mode="create" />);
    await fillBasics(user);
    const title = "T".repeat(255);
    const longText = "d".repeat(10000);
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: title + "overflow" } });
    expect(screen.getByLabelText("Tiêu đề")).toHaveValue(title);
    fireEvent.change(screen.getByLabelText("Mô tả công việc"), { target: { value: longText + "x" } });
    expect(screen.getByLabelText("Mô tả công việc")).toHaveValue(longText);
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith("/jobs", expect.objectContaining({ title, description: longText })));
  });

  it("sends the selected importance and minimum level for each skill", async () => {
    mockForm();
    vi.mocked(httpClient.post).mockResolvedValue(envelope(job(99)));
    const user = userEvent.setup();
    show(<RecruiterJobsPage mode="create" />);
    await fillBasics(user);
    await user.click(await screen.findByRole("checkbox", { name: /React/ }));
    await user.click(screen.getByRole("checkbox", { name: /Java/ }));
    await user.selectOptions(screen.getByLabelText("Mức độ quan trọng - React"), "NICE_TO_HAVE");
    await user.selectOptions(screen.getByLabelText("Trình độ tối thiểu - React"), "ADVANCED");
    await user.selectOptions(screen.getByLabelText("Trình độ tối thiểu - Java"), "INTERMEDIATE");
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalled());
    expect(vi.mocked(httpClient.post).mock.calls[0][1]).toMatchObject({
      skills: [
        { skillId: 5, importance: "NICE_TO_HAVE", minLevel: "ADVANCED" },
        { skillId: 6, importance: "REQUIRED", minLevel: "INTERMEDIATE" },
      ],
    });
  });

  it("preserves existing skill importance/level on edit and sends changes only when edited", async () => {
    const detail = job(42, {
      status: "DRAFT", jobType: "FULL_TIME", workingModel: "ONSITE", description: "Existing",
      skills: [{ id: 1, skillId: 5, skillName: "React", importance: "PREFERRED", minLevel: "ADVANCED" }],
    });
    mockForm(detail);
    vi.mocked(httpClient.put).mockResolvedValue(envelope(detail));
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={["/recruiter/jobs/42/edit"]}>
          <Routes><Route path="/recruiter/jobs/:jobId/edit" element={<RecruiterJobsPage mode="edit" />} /></Routes>
        </MemoryRouter>
      </ToastProvider>,
    );
    expect(await screen.findByLabelText("Mức độ quan trọng - React")).toHaveValue("PREFERRED");
    expect(screen.getByLabelText("Trình độ tối thiểu - React")).toHaveValue("ADVANCED");
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalled());
    expect(vi.mocked(httpClient.put).mock.calls[0][1]).toMatchObject({
      skills: [{ skillId: 5, importance: "PREFERRED", minLevel: "ADVANCED" }],
    });
  });
});
