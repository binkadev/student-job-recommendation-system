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
  taxCode: "0109887766",
  industry: "Phát triển phần mềm",
  address: "Tầng 12, Tòa nhà Keangnam, Hà Nội",
  website: "https://saomaitech.example.vn",
  phone: "02439998888",
  email: "hr@saomaitech.example.vn",
  description: "Chuyên xây dựng nền tảng đám mây và hệ thống doanh nghiệp.",
  status: "VERIFIED",
};

const mockJob = {
  id: 42,
  companyId: 7,
  companyName: "Sao Mai Tech Solutions",
  title: "Backend Java Spring Boot Engineer",
  description: "Thiết kế và phát triển RESTful API hiệu năng cao với Java 21 và Spring Boot.",
  requirements: "Nắm vững cấu trúc dữ liệu, SQL, Spring Security và kiểm thử tích hợp.",
  benefits: "Lương tháng 13, bảo hiểm sức khỏe toàn diện và phụ cấp ăn trưa.",
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
  skills: [
    {
      id: 101,
      skillId: 1,
      skillName: "Java",
      normalizedName: "java",
      category: "Backend",
      importance: "REQUIRED",
      minLevel: "ADVANCED",
    },
    {
      id: 102,
      skillId: 2,
      skillName: "Spring Boot",
      normalizedName: "spring boot",
      category: "Framework",
      importance: "PREFERRED",
      minLevel: "INTERMEDIATE",
    },
    {
      id: 103,
      skillId: 3,
      skillName: "Docker",
      normalizedName: "docker",
      category: "DevOps",
      importance: "NICE_TO_HAVE",
      minLevel: "BEGINNER",
    },
  ],
};

function renderPreview(initialEntry = "/recruiter/jobs/42/preview", mode: "preview" | "detail" | "statistics" = "preview") {
  const routePath =
    mode === "preview"
      ? "/recruiter/jobs/:jobId/preview"
      : mode === "statistics"
        ? "/recruiter/jobs/:jobId/statistics"
        : "/recruiter/jobs/:jobId";
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path={routePath} element={<RecruiterJobsPage mode={mode} />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("DATN W1-B2.1 — Recruiter Job Preview (/recruiter/jobs/:jobId/preview)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loading state and then renders full job details, skills with importance/minLevel, status, and company info", async () => {
    let resolveJob!: (value: ReturnType<typeof envelope>) => void;
    const pendingJob = new Promise<ReturnType<typeof envelope>>((resolve) => {
      resolveJob = resolve;
    });

    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope(mockCompany);
      if (url === "/jobs/42") return pendingJob;
      throw new Error(`Unexpected GET ${url}`);
    });

    renderPreview();
    expect(screen.getByText(/Đang tải dữ liệu/i)).toBeInTheDocument();

    resolveJob(envelope(mockJob));

    expect(await screen.findByRole("heading", { name: "Xem trước tin tuyển dụng" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backend Java Spring Boot Engineer" })).toBeInTheDocument();
    expect(screen.getByText("Tin đang hiển thị công khai cho ứng viên")).toBeInTheDocument();

    // Job content & metadata
    expect(screen.getByText(mockJob.description)).toBeInTheDocument();
    expect(screen.getByText(mockJob.requirements)).toBeInTheDocument();
    expect(screen.getByText(mockJob.benefits)).toBeInTheDocument();
    expect(screen.getAllByText(/18\.000\.000 - 30\.000\.000 đồng/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Toàn thời gian").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hybrid").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đang tuyển").length).toBeGreaterThan(0);

    // Skills, importance, and minimum level
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("Mức độ: Bắt buộc")).toBeInTheDocument();
    expect(screen.getByText("Trình độ: Nâng cao")).toBeInTheDocument();

    expect(screen.getByText("Spring Boot")).toBeInTheDocument();
    expect(screen.getByText("Mức độ: Ưu tiên")).toBeInTheDocument();
    expect(screen.getByText("Trình độ: Trung bình")).toBeInTheDocument();

    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Mức độ: Là điểm cộng")).toBeInTheDocument();
    expect(screen.getByText("Trình độ: Cơ bản")).toBeInTheDocument();

    // Company details
    expect(screen.getAllByText("Sao Mai Tech Solutions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã xác thực").length).toBeGreaterThan(0);
    expect(screen.getByText("Phát triển phần mềm")).toBeInTheDocument();
    expect(screen.getByText("0109887766")).toBeInTheDocument();
    expect(screen.getByText("Tầng 12, Tòa nhà Keangnam, Hà Nội")).toBeInTheDocument();
    expect(screen.getByText("https://saomaitech.example.vn")).toBeInTheDocument();
    expect(screen.getByText("02439998888")).toBeInTheDocument();
    expect(screen.getByText("hr@saomaitech.example.vn")).toBeInTheDocument();
    expect(screen.getByText(mockCompany.description)).toBeInTheDocument();

    // Action links
    expect(screen.getByRole("link", { name: "Chi tiết quản lý" })).toHaveAttribute("href", "/recruiter/jobs/42");
    expect(screen.getByRole("link", { name: "Chuẩn bị chỉnh sửa" })).toHaveAttribute("href", "/recruiter/jobs/42/edit");
    expect(screen.getByRole("link", { name: "Ứng viên phù hợp" })).toHaveAttribute("href", "/recruiter/jobs/42/candidate-ranking");
  });

  it("displays non-public notice when job is DRAFT or company is PENDING", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope({ ...mockCompany, status: "PENDING" });
      if (url === "/jobs/42") return envelope({ ...mockJob, status: "DRAFT", skills: [] });
      throw new Error(`Unexpected GET ${url}`);
    });

    renderPreview();
    expect(await screen.findByText("Tin chưa hiển thị công khai trên cổng tìm việc")).toBeInTheDocument();
    expect(screen.getAllByText("Bản nháp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chờ xác thực").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Sửa tin" })).toHaveAttribute("href", "/recruiter/jobs/42/edit");
    expect(screen.getByText("Tin chưa có kỹ năng yêu cầu.")).toBeInTheDocument();
  });

  it("enforces company ownership and blocks viewing another company's job", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope({ ...mockCompany, id: 7 });
      if (url === "/jobs/99") return envelope({ ...mockJob, id: 99, companyId: 88, title: "Foreign Company Secret Job" });
      throw new Error(`Unexpected GET ${url}`);
    });

    renderPreview("/recruiter/jobs/99/preview");
    expect(await screen.findByText("Bạn không có quyền xem hoặc thao tác tin tuyển dụng của công ty khác.")).toBeInTheDocument();
    expect(screen.queryByText("Foreign Company Secret Job")).not.toBeInTheDocument();
  });

  it("handles missing job (404) and allows retrying after transient API failure", async () => {
    let attempts = 0;
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope(mockCompany);
      if (url === "/jobs/42") {
        attempts += 1;
        if (attempts === 1) {
          throw { response: { status: 404, data: { errorCode: "RESOURCE_NOT_FOUND", message: "Job not found" } } };
        }
        return envelope(mockJob);
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    renderPreview();
    expect(await screen.findByText("Không tìm thấy dữ liệu phù hợp.")).toBeInTheDocument();
    expect(screen.queryByText("Backend Java Spring Boot Engineer")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Backend Java Spring Boot Engineer" })).toBeInTheDocument());
  });

  it("keeps /recruiter/jobs/:jobId/statistics on UnsupportedJobView as scoped", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me") return envelope(mockCompany);
      if (url === "/jobs/42") return envelope(mockJob);
      throw new Error(`Unexpected GET ${url}`);
    });

    renderPreview("/recruiter/jobs/42/statistics", "statistics");
    expect(await screen.findByText("Chưa có dữ liệu thống kê cho tin tuyển dụng này.")).toBeInTheDocument();
  });
});
