import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterCandidatesPage } from "./RecruiterCandidatesPage";

vi.mock("../../services/api/httpClient", () => ({
  AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token",
  httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const companyJobs = [
  { id: 42, companyId: 7, title: "Backend Java Engineer" },
  { id: 43, companyId: 7, title: "Frontend React Developer" },
];

const applicantRecord = {
  id: 91,
  studentId: 12,
  studentName: "Nguyễn Văn A",
  studentEmail: "student.a@example.test",
  companyId: 7,
  companyName: "Aurora Tech",
  jobId: 42,
  jobTitle: "Backend Java Engineer",
  status: "PENDING" as const,
  coverLetter: "Kinh nghiệm Spring Boot.",
  cvFileId: 301,
  cvFileName: "cv-a.pdf",
  appliedAt: "2026-11-05T09:00:00",
  reviewedAt: null,
  createdAt: "2026-11-05T09:00:00",
  updatedAt: "2026-11-05T09:00:00",
};

const savedCandidateRecord = {
  id: 501,
  applicationId: 95,
  applicationStatus: "REVIEWED" as const,
  revision: 2,
  studentId: 18,
  studentName: "Trần Thị B",
  studentEmail: "student.b@example.test",
  university: "Đại học Công nghệ",
  major: "Khoa học máy tính",
  headline: "React & TypeScript Intern",
  jobId: 43,
  jobTitle: "Frontend React Developer",
  cvFileId: 309,
  cvFileName: "cv-b.pdf",
  note: "Đã qua vòng hồ sơ, hẹn phỏng vấn.",
  savedAt: "2026-11-06T10:00:00",
  updatedAt: "2026-11-06T10:00:00",
};

const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[], overrides: Record<string, unknown> = {}) => ({
  items,
  totalItems: items.length,
  page: 1,
  size: 10,
  totalPages: 1,
  ...overrides,
});

function renderSearchPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/recruiter/candidate-search"]}>
        <Routes>
          <Route path="/recruiter/candidate-search" element={<RecruiterCandidatesPage mode="search" />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem("job-system:auth-token", "company-token");
});

describe("RecruiterCandidateSearch (/recruiter/candidate-search)", () => {
  it("searches company applicants via /companies/me/applications with server-side filters, pagination, and authorized links", async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") return envelope(page(companyJobs));
      if (url === "/companies/me/applications") return envelope(page([applicantRecord], { size: 8, totalItems: 16, totalPages: 2 }));
      if (url === "/companies/me/saved-candidates") return envelope(page([]));
      throw new Error(`Unexpected GET ${url}`);
    });

    renderSearchPage();

    expect(await screen.findByRole("heading", { name: "Tìm kiếm ứng viên" })).toBeInTheDocument();
    expect(screen.getByTestId("candidate-search-scope-notice")).toHaveTextContent(
      /không có danh bạ sinh viên công khai/i,
    );
    expect(await screen.findByText("Nguyễn Văn A")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Chi tiết" })).toHaveAttribute("href", "/recruiter/candidates/91");
    expect(screen.getByRole("link", { name: "Mời ứng tuyển" })).toHaveAttribute("href", "/recruiter/invitations/create?applicationId=91");
    expect(screen.getByRole("link", { name: "Đánh giá" })).toHaveAttribute(
      "href",
      "/recruiter/candidates/91/evaluation",
    );

    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "Nguyễn" } });
    await user.selectOptions(screen.getByLabelText("Vị trí tuyển dụng"), "42");
    await user.selectOptions(screen.getByLabelText("Trạng thái"), "PENDING");

    await waitFor(() => {
      expect(httpClient.get).toHaveBeenCalledWith(
        "/companies/me/applications",
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            size: 8,
            keyword: "Nguyễn",
            jobId: "42",
            status: "PENDING",
            sort: "appliedAt,desc",
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Sau" }));

    await waitFor(() => {
      expect(httpClient.get).toHaveBeenCalledWith(
        "/companies/me/applications",
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
            keyword: "Nguyễn",
            jobId: "42",
            status: "PENDING",
          }),
        }),
      );
    });
  });

  it("switches to Saved Candidates view and reuses server-side /companies/me/saved-candidates search, filters, and links", async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
      if (url === "/companies/me/jobs") return envelope(page(companyJobs));
      if (url === "/companies/me/applications") return envelope(page([applicantRecord]));
      if (url === "/companies/me/saved-candidates") {
        const requestedPage = Number((config as { params?: { page?: number } } | undefined)?.params?.page ?? 1);
        return envelope(page([savedCandidateRecord], { page: requestedPage, totalItems: 15, totalPages: 2 }));
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    renderSearchPage();

    await screen.findByText("Nguyễn Văn A");
    await user.click(screen.getByRole("button", { name: "Hồ sơ đã lưu" }));

    expect(await screen.findByText("Trần Thị B")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mời ứng tuyển" })).toHaveAttribute("href", "/recruiter/invitations/create?applicationId=95");
    expect(screen.getByText("Đã qua vòng hồ sơ, hẹn phỏng vấn.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chi tiết" })).toHaveAttribute("href", "/recruiter/candidates/95");
    expect(screen.getByRole("link", { name: "Đánh giá" })).toHaveAttribute(
      "href",
      "/recruiter/candidates/95/evaluation",
    );

    fireEvent.change(screen.getByLabelText("Tìm ứng viên đã lưu"), { target: { value: "React" } });
    fireEvent.change(screen.getByLabelText("Trạng thái đơn nguồn"), { target: { value: "REVIEWED" } });
    fireEvent.change(screen.getByLabelText("Mã Job nguồn"), { target: { value: "43" } });

    await waitFor(() => {
      expect(httpClient.get).toHaveBeenCalledWith(
        "/companies/me/saved-candidates",
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            size: 10,
            keyword: "React",
            applicationStatus: "REVIEWED",
            jobId: "43",
          }),
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Sau" }));

    await waitFor(() => {
      expect(httpClient.get).toHaveBeenCalledWith(
        "/companies/me/saved-candidates",
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
            size: 10,
            keyword: "React",
          }),
        }),
      );
    });
  });

  it("handles empty and error states in both Applicants and Saved Candidates views without leaking public endpoints", async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") return envelope(page(companyJobs));
      if (url === "/companies/me/applications") return envelope(page([]));
      if (url === "/companies/me/saved-candidates") throw new Error("Saved candidates service error");
      throw new Error(`Unexpected GET ${url}`);
    });

    renderSearchPage();

    expect(await screen.findByText("Không có hồ sơ ứng tuyển phù hợp.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hồ sơ đã lưu" }));

    expect(await screen.findByText(/Saved candidates service error|Không thể tải/i)).toBeInTheDocument();
    expect(screen.queryByText("Không có hồ sơ đã lưu phù hợp.")).not.toBeInTheDocument();
  });
});
