import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterJobsPage } from "./RecruiterJobsPage";

vi.mock("../../services/api/httpClient", () => ({
  AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token",
  httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const envelope = (data: unknown) => ({ data: { success: true, message: "OK", data } });

const mockCompany = {
  id: 7,
  companyName: "Sao Mai Tech Solutions",
  status: "VERIFIED",
};

const mockJob = {
  id: 42,
  companyId: 7,
  companyName: "Sao Mai Tech Solutions",
  title: "Backend Java Spring Boot Engineer",
  description: "Phát triển dịch vụ vi mô.",
  requirements: "Java 21, Spring Boot, PostgreSQL.",
  benefits: "Lương tháng 13.",
  location: "Hà Nội",
  jobType: "FULL_TIME",
  workingModel: "HYBRID",
  status: "ACTIVE",
  salaryMin: 18000000,
  salaryMax: 30000000,
  currency: "VND",
  deadline: "2027-06-30",
  publishedAt: "2026-11-01T08:00:00",
  closedAt: null,
  createdAt: "2026-10-28T09:30:00",
  updatedAt: "2026-11-02T14:15:00",
  skills: [],
};

const mockPopulatedReport = {
  scope: {
    from: null,
    to: null,
    jobId: 42,
    status: null,
    keyword: null,
    timeZone: "UTC",
  },
  summary: {
    totalApplications: 125,
    uniqueStudents: 98,
    statusCounts: {
      PENDING: 45,
      REVIEWED: 30,
      ACCEPTED: 20,
      REJECTED: 22,
      WITHDRAWN: 8,
    },
    acceptedRate: 16.0,
  },
  trend: [
    { bucket: "2026-10", applications: 50 },
    { bucket: "2026-11", applications: 75 },
  ],
  topJobs: [],
  topJobLimit: 10,
  applications: {
    items: [
      {
        id: 501,
        studentId: 11,
        studentName: "Nguyễn Minh Khoa",
        studentEmail: "khoa.nguyen@student.edu.vn",
        jobId: 42,
        jobTitle: "Backend Java Spring Boot Engineer",
        status: "ACCEPTED",
        appliedAt: "2026-11-05T09:15:00",
      },
      {
        id: 502,
        studentId: 12,
        studentName: "Trần Thu Hà",
        studentEmail: "ha.tran@student.edu.vn",
        jobId: 42,
        jobTitle: "Backend Java Spring Boot Engineer",
        status: "PENDING",
        appliedAt: "2026-11-06T10:30:00",
      },
    ],
    page: 1,
    size: 10,
    totalItems: 125,
    totalPages: 13,
  },
};

function renderStatistics(initialEntry = "/recruiter/jobs/42/statistics") {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/recruiter/jobs/:jobId/statistics" element={<RecruiterJobsPage mode="statistics" />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("DATN W1-B2.2 — Per-Job Statistics (/recruiter/jobs/:jobId/statistics)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requests /companies/me/recruitment-report with jobId, page=1, size=10 and displays server summary, status counts, trends, and recent applications", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope(mockCompany);
      if (url === "/jobs/42") return envelope(mockJob);
      if (url === "/companies/me/recruitment-report") return envelope(mockPopulatedReport);
      throw new Error(`Unexpected GET ${url}`);
    });

    renderStatistics();

    expect(await screen.findByRole("heading", { name: "Thống kê tin tuyển dụng" })).toBeInTheDocument();
    expect(httpClient.get).toHaveBeenCalledWith("/companies/me/recruitment-report", {
      params: { jobId: 42, page: 1, size: 10 },
    });

    // Server-side KPIs (must use 125 from summary, never 2 from page=1 items)
    expect(await screen.findByTestId("job-stat-total-applications")).toHaveTextContent("125");
    expect(screen.getByTestId("job-stat-unique-students")).toHaveTextContent("98");
    expect(screen.getByTestId("job-stat-accepted-rate")).toHaveTextContent("16.00%");

    // Status counts from server summary
    expect(screen.getByTestId("job-status-count-PENDING")).toHaveTextContent("45");
    expect(screen.getByTestId("job-status-count-REVIEWED")).toHaveTextContent("30");
    expect(screen.getByTestId("job-status-count-ACCEPTED")).toHaveTextContent("20");
    expect(screen.getByTestId("job-status-count-REJECTED")).toHaveTextContent("22");
    expect(screen.getByTestId("job-status-count-WITHDRAWN")).toHaveTextContent("8");

    // Trends
    expect(screen.getByText("2026-10")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("2026-11")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();

    // Recent applications with authorized detail links
    expect(screen.getByText("Nguyễn Minh Khoa")).toBeInTheDocument();
    expect(screen.getByText("khoa.nguyen@student.edu.vn")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#501" })).toHaveAttribute("href", "/recruiter/candidates/501");
    expect(screen.getByRole("link", { name: "#502" })).toHaveAttribute("href", "/recruiter/candidates/502");

    // Must not invent job views or impressions
    expect(screen.queryByText(/lượt xem|impressions|views/i)).not.toBeInTheDocument();
  });

  it("handles zero applications and empty trend/recent-applications gracefully", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope(mockCompany);
      if (url === "/jobs/42") return envelope(mockJob);
      if (url === "/companies/me/recruitment-report") {
        return envelope({
          scope: { from: null, to: null, jobId: 42, status: null, keyword: null, timeZone: "UTC" },
          summary: {
            totalApplications: 0,
            uniqueStudents: 0,
            statusCounts: {},
            acceptedRate: null,
          },
          trend: [],
          applications: { items: [], page: 1, size: 10, totalItems: 0, totalPages: 0 },
        });
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    renderStatistics();

    expect(await screen.findByTestId("job-stat-total-applications")).toHaveTextContent("0");
    expect(screen.getByTestId("job-stat-unique-students")).toHaveTextContent("0");
    expect(screen.getByTestId("job-stat-accepted-rate")).toHaveTextContent("Không áp dụng (0 đơn)");
    expect(screen.getByText("Tin tuyển dụng này chưa có hồ sơ ứng tuyển nào.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có dữ liệu xu hướng ứng tuyển theo kỳ cho tin này.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có hồ sơ ứng tuyển nào cho tin tuyển dụng này.")).toBeInTheDocument();
  });

  it("enforces company ownership and never requests recruitment-report for another company's job", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope({ ...mockCompany, id: 7 });
      if (url === "/jobs/99") return envelope({ ...mockJob, id: 99, companyId: 88, title: "Foreign Company Job" });
      throw new Error(`Unexpected GET ${url}`);
    });

    renderStatistics("/recruiter/jobs/99/statistics");

    expect(await screen.findByText("Bạn không có quyền xem hoặc thao tác tin tuyển dụng của công ty khác.")).toBeInTheDocument();
    expect(httpClient.get).not.toHaveBeenCalledWith("/companies/me/recruitment-report", expect.anything());
    expect(screen.queryByText("Foreign Company Job")).not.toBeInTheDocument();
  });

  it("shows an explicit error state on recruitment-report failure without fabricating zero metrics, and recovers on retry", async () => {
    let reportAttempts = 0;
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope(mockCompany);
      if (url === "/jobs/42") return envelope(mockJob);
      if (url === "/companies/me/recruitment-report") {
        reportAttempts += 1;
        if (reportAttempts === 1) {
          throw new Error("Report service unavailable");
        }
        return envelope(mockPopulatedReport);
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    renderStatistics();

    expect(await screen.findByText("Không thể tải dữ liệu. Vui lòng thử lại.")).toBeInTheDocument();
    expect(screen.queryByTestId("job-stat-total-applications")).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Thử lại" })[0]);
    await waitFor(() => expect(screen.getByTestId("job-stat-total-applications")).toHaveTextContent("125"));
  });
});
