import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { candidateMenu } from "../../constants/menu";
import { candidateRoutes } from "../../constants/routes";
import { httpClient } from "../../services/api/httpClient";
import { CandidateCvsPage } from "./CandidateCvsPage";
import { CandidateJobsPage } from "./CandidateJobsPage";

vi.mock("../../services/api/httpClient", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../features/public/jobs/useAppliedJobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../features/public/jobs/useAppliedJobs")>()),
  useAppliedJobs: () => ({
    applications: [],
    getApplicationState: () => "NONE",
    canApply: () => true,
    getApplyButtonLabel: () => "Ứng tuyển ngay",
    syncError: null,
    syncing: false,
    refreshAppliedJobs: vi.fn(),
  }),
}));

describe("DATN W1-A — Student Workspace Completion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("1. Student Saved Searches route, navigation, CRUD and Apply Filter", () => {
    it("declares /candidate/jobs/saved-searches in candidateRoutes and candidateMenu", () => {
      expect(candidateRoutes.some((route) => route.path === "/candidate/jobs/saved-searches")).toBe(true);
      const jobsGroup = candidateMenu.find((item) => item.label === "Việc làm");
      expect(jobsGroup?.children?.some((child) => child.path === "/candidate/jobs/saved-searches")).toBe(true);
    });

    it("navigates from /candidate/jobs to /candidate/jobs/saved-searches, performs CRUD, and applies a saved filter back to /candidate/jobs", async () => {
      const savedSearches = [
        {
          id: 7,
          name: "Backend Java Hybrid",
          keyword: "Spring Boot",
          location: "Ho Chi Minh City",
          jobType: "FULL_TIME",
          workingModel: "HYBRID",
          createdAt: "2026-11-10T08:00:00",
          updatedAt: "2026-11-10T09:30:00",
        },
      ];

      vi.mocked(httpClient.get).mockImplementation(async (url) => {
        if (url === "/students/me/saved-searches") {
          return { data: { success: true, message: "OK", data: savedSearches } };
        }
        if (url === "/students/me/saved-jobs") {
          return { data: { success: true, message: "OK", data: { items: [], page: 1, size: 100, totalItems: 0, totalPages: 1 } } };
        }
        if (url === "/jobs") {
          return {
            data: {
              success: true,
              message: "OK",
              data: {
                items: [
                  {
                    id: 101,
                    companyId: 9,
                    companyName: "FPT Software",
                    title: "Java Spring Boot Engineer",
                    location: "Ho Chi Minh City",
                    jobType: "FULL_TIME",
                    workingModel: "HYBRID",
                    status: "ACTIVE",
                    salaryMin: 15000000,
                    salaryMax: 25000000,
                    currency: "VND",
                    deadline: "2099-12-31",
                    skills: [],
                    publishedAt: "2026-11-01T10:00:00",
                    closedAt: null,
                    createdAt: "2026-11-01T10:00:00",
                    updatedAt: "2026-11-01T10:00:00",
                  },
                ],
                page: 1,
                size: 6,
                totalItems: 1,
                totalPages: 1,
              },
            },
          };
        }
        throw new Error(`Unexpected GET ${url}`);
      });

      render(
        <ToastProvider>
          <MemoryRouter initialEntries={["/candidate/jobs"]}>
            <Routes>
              <Route path="/candidate/jobs" element={<CandidateJobsPage mode="list" />} />
              <Route path="/candidate/jobs/saved-searches" element={<CandidateJobsPage mode="saved-searches" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>,
      );

      const savedSearchesLink = await screen.findByRole("link", { name: "Tìm kiếm đã lưu" });
      await userEvent.click(savedSearchesLink);

      expect(await screen.findByText("Backend Java Hybrid")).toBeInTheDocument();
      expect(screen.getByText(/Spring Boot • Ho Chi Minh City • Toàn thời gian • Hybrid/)).toBeInTheDocument();

      const applyButton = screen.getByRole("button", { name: "Áp dụng bộ lọc" });
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Từ khóa")).toHaveValue("Spring Boot");
      });
      expect(screen.getByLabelText("Địa điểm")).toHaveValue("Ho Chi Minh City");
      expect(screen.getByLabelText("Loại hình")).toHaveValue("FULL_TIME");
      expect(screen.getByLabelText("Hình thức")).toHaveValue("HYBRID");

      expect(httpClient.get).toHaveBeenCalledWith(
        "/jobs",
        expect.objectContaining({
          params: expect.objectContaining({
            keyword: "Spring Boot",
            location: "Ho Chi Minh City",
            jobType: "FULL_TIME",
            workingModel: "HYBRID",
            status: "ACTIVE",
          }),
        }),
      );
      expect(await screen.findByText("Java Spring Boot Engineer")).toBeInTheDocument();
    });

    it("supports creating, updating, and deleting saved searches via existing Backend CRUD endpoints", async () => {
      type MockSavedSearchItem = {
        id: number;
        name: string;
        keyword: string | null;
        location: string | null;
        jobType: string | null;
        workingModel: string | null;
        createdAt: string;
        updatedAt: string;
      };

      const items: MockSavedSearchItem[] = [
        {
          id: 9,
          name: "React Internship",
          keyword: "React",
          location: "Hà Nội",
          jobType: "INTERNSHIP",
          workingModel: "REMOTE",
          createdAt: "2026-11-10T08:00:00",
          updatedAt: "2026-11-10T08:00:00",
        },
      ];

      vi.mocked(httpClient.get).mockImplementation(async (url) => {
        if (url === "/students/me/saved-searches") {
          return { data: { success: true, message: "OK", data: [...items] } };
        }
        throw new Error(`Unexpected GET ${url}`);
      });

      vi.mocked(httpClient.post).mockImplementation(async (url, payload) => {
        if (url === "/students/me/saved-searches") {
          const body = payload as Record<string, string | null>;
          const created = {
            id: 10,
            name: String(body.name),
            keyword: body.keyword ?? null,
            location: body.location ?? null,
            jobType: (body.jobType as string | null) ?? null,
            workingModel: (body.workingModel as string | null) ?? null,
            createdAt: "2026-11-10T10:00:00",
            updatedAt: "2026-11-10T10:00:00",
          };
          items.push(created);
          return { data: { success: true, message: "Created", data: created } };
        }
        throw new Error(`Unexpected POST ${url}`);
      });

      vi.mocked(httpClient.put).mockImplementation(async (url, payload) => {
        if (url === "/students/me/saved-searches/9") {
          const body = payload as Record<string, string | null>;
          items[0] = {
            ...items[0],
            name: String(body.name),
            keyword: body.keyword ?? null,
          };
          return { data: { success: true, message: "Updated", data: items[0] } };
        }
        throw new Error(`Unexpected PUT ${url}`);
      });

      vi.mocked(httpClient.delete).mockImplementation(async (url) => {
        if (url === "/students/me/saved-searches/10") {
          const idx = items.findIndex((item) => item.id === 10);
          if (idx >= 0) items.splice(idx, 1);
          return { data: { success: true, message: "Deleted", data: null } };
        }
        throw new Error(`Unexpected DELETE ${url}`);
      });

      render(
        <ToastProvider>
          <MemoryRouter initialEntries={["/candidate/jobs/saved-searches?keyword=NodeJS&location=%C4%90%C3%A0+N%E1%BA%B5ng"]}>
            <Routes>
              <Route path="/candidate/jobs/saved-searches" element={<CandidateJobsPage mode="saved-searches" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>,
      );

      expect(await screen.findByText("React Internship")).toBeInTheDocument();
      expect(screen.getByLabelText("Từ khóa")).toHaveValue("NodeJS");
      expect(screen.getByLabelText("Địa điểm")).toHaveValue("Đà Nẵng");

      await userEvent.type(screen.getByLabelText("Tên bộ lọc"), "NodeJS Da Nang");
      await userEvent.click(screen.getByRole("button", { name: "Lưu tìm kiếm" }));

      expect(await screen.findByText("NodeJS Da Nang")).toBeInTheDocument();
      expect(httpClient.post).toHaveBeenCalledWith("/students/me/saved-searches", {
        name: "NodeJS Da Nang",
        keyword: "NodeJS",
        location: "Đà Nẵng",
        jobType: null,
        workingModel: null,
      });

      const editButtons = screen.getAllByRole("button", { name: "Sửa" });
      await userEvent.click(editButtons[0]);
      const nameInput = screen.getByLabelText("Tên bộ lọc");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "React Frontend Updated");
      await userEvent.click(screen.getByRole("button", { name: "Cập nhật" }));

      expect(await screen.findByText("React Frontend Updated")).toBeInTheDocument();

      const deleteButtons = screen.getAllByRole("button", { name: "Xóa" });
      await userEvent.click(deleteButtons[1]);
      await waitFor(() => {
        expect(screen.queryByText("NodeJS Da Nang")).not.toBeInTheDocument();
      });
    });
  });

  describe("2. CV V2 Analysis Metadata & 3. Deterministic CV Review", () => {
    const mockCv = {
      id: 12,
      originalFileName: "nguyen_van_a_cv_vi.pdf",
      contentType: "application/pdf",
      fileSize: 245760,
      isActive: true,
      deletable: false,
      uploadedAt: "2026-11-10T08:15:00",
      createdAt: "2026-11-10T08:15:00",
      updatedAt: "2026-11-10T08:16:00",
    };

    const mockReadyAnalysis = {
      cvId: 12,
      extractedText: "Nguyễn Văn A\nKỹ năng: Java, Spring Boot, PostgreSQL\nKinh nghiệm phát triển REST API",
      processedText: "nguyen_van_a ky_nang java spring_boot postgresql kinh_nghiem phat_trien rest_api",
      skills: ["java", "postgresql", "rest api", "spring boot"],
      status: "READY",
      analysisError: null,
      languageCode: "vi",
      languageConfidence: 0.9821,
      processingVersion: "bilingual-nlp-v2-skills-v1",
      warnings: ["Trang 2 có bảng phức tạp được chuyển thành văn bản phẳng."],
      analyzedAt: "2026-11-10T08:16:00",
      uploadedAt: "2026-11-10T08:15:00",
      updatedAt: "2026-11-10T08:16:00",
    };

    beforeEach(() => {
      vi.mocked(httpClient.get).mockImplementation(async (url) => {
        if (url === "/students/me/cv") {
          return { data: { success: true, message: "OK", data: [mockCv] } };
        }
        if (url === "/students/me/cv/12") {
          return { data: { success: true, message: "OK", data: mockCv } };
        }
        if (url === "/students/me/cv/12/analysis") {
          return { data: { success: true, message: "OK", data: mockReadyAnalysis } };
        }
        throw new Error(`Unexpected GET ${url}`);
      });
    });

    it("renders persisted V2 analysis metadata (language, confidence, version, warnings, analyzedAt) on /candidate/cvs/:cvId/analysis", async () => {
      render(
        <ToastProvider>
          <MemoryRouter initialEntries={["/candidate/cvs/12/analysis"]}>
            <Routes>
              <Route path="/candidate/cvs/:cvId/analysis" element={<CandidateCvsPage mode="analysis" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>,
      );

      expect(await screen.findByText("Tiếng Việt (vi)")).toBeInTheDocument();
      expect(screen.getByText("98.2% (0.9821)")).toBeInTheDocument();
      expect(screen.getByText("bilingual-nlp-v2-skills-v1")).toBeInTheDocument();
      expect(screen.getByText("Trang 2 có bảng phức tạp được chuyển thành văn bản phẳng.")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Nội dung CV đã xử lý, cuộn để đọc" })).toHaveTextContent(
        "nguyen_van_a ky_nang java spring_boot postgresql",
      );
      expect(screen.getByRole("link", { name: "Đánh giá CV" })).toHaveAttribute("href", "/candidate/cvs/12/review");
    });

    it("renders a meaningfully distinct, deterministic CV Review on /candidate/cvs/:cvId/review without raw text dumps or fake AI scores", async () => {
      render(
        <ToastProvider>
          <MemoryRouter initialEntries={["/candidate/cvs/12/review"]}>
            <Routes>
              <Route path="/candidate/cvs/:cvId/review" element={<CandidateCvsPage mode="review" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>,
      );

      expect(await screen.findByText("Trạng thái sẵn sàng cho gợi ý việc làm V3")).toBeInTheDocument();
      expect(screen.getByText("Đủ điều kiện (Sẵn sàng)")).toBeInTheDocument();
      expect(screen.getByText("bilingual-nlp-v2-skills-v1 (Khớp chuẩn V3)")).toBeInTheDocument();
      expect(screen.getByText("PRIMARY — SAME_LANGUAGE_HYBRID (65% văn bản TF-IDF + 35% kỹ năng)")).toBeInTheDocument();
      expect(screen.getByText("4 kỹ năng")).toBeInTheDocument();
      expect(screen.getByText("1 cảnh báo")).toBeInTheDocument();
      expect(screen.getByText("8 token")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Nội dung CV đã xử lý, cuộn để đọc" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Nội dung CV trích xuất, cuộn để đọc" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Xem phân tích kỹ thuật" })).toHaveAttribute("href", "/candidate/cvs/12/analysis");
    });

    it("routes low-confidence or mixed-language CV snapshots to FALLBACK skill-based matching in CV Review", async () => {
      vi.mocked(httpClient.get).mockImplementation(async (url) => {
        if (url === "/students/me/cv") {
          return { data: { success: true, message: "OK", data: [mockCv] } };
        }
        if (url === "/students/me/cv/12") {
          return { data: { success: true, message: "OK", data: mockCv } };
        }
        if (url === "/students/me/cv/12/analysis") {
          return {
            data: {
              success: true,
              message: "OK",
              data: {
                ...mockReadyAnalysis,
                languageCode: "mixed",
                languageConfidence: 0.52,
                skills: [],
                warnings: [],
              },
            },
          };
        }
        throw new Error(`Unexpected GET ${url}`);
      });

      render(
        <ToastProvider>
          <MemoryRouter initialEntries={["/candidate/cvs/12/review"]}>
            <Routes>
              <Route path="/candidate/cvs/:cvId/review" element={<CandidateCvsPage mode="review" />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>,
      );

      expect(await screen.findByText("Đa ngôn ngữ / Hỗn hợp (mixed)")).toBeInTheDocument();
      expect(screen.getByText("52.0% (0.5200)")).toBeInTheDocument();
      expect(screen.getAllByText("FALLBACK — CROSS_LANGUAGE_SKILL_BASED (100% theo kỹ năng chuẩn hóa)")).toHaveLength(2);
      expect(screen.getByText("0 kỹ năng")).toBeInTheDocument();
      expect(screen.getByText(/Chưa ghi nhận được kỹ năng chuẩn hóa nào từ văn bản CV/)).toBeInTheDocument();
    });
  });
});
