import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../app/providers/AuthProvider";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { DashboardHeader } from "../../components/layout/DashboardHeader";
import { MobileSidebar } from "../../components/layout/MobileSidebar";
import { candidateMenu } from "../../constants/menu";
import {
  getCandidateDashboardData,
  getCandidateDashboardRecommendations,
} from "../../features/candidate/dashboard/candidateDashboardService";
import type {
  CandidateDashboardData,
  CandidateDashboardRecommendation,
} from "../../features/candidate/dashboard/candidateDashboardTypes";
import { httpClient } from "../../services/api/httpClient";
import { CandidateDashboardPage } from "./CandidateDashboardPage";

vi.mock("../../services/api/httpClient", () => ({
  AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token",
  AUTH_SESSION_EXPIRED_EVENT: "job-system:auth-session-expired",
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../features/candidate/dashboard/candidateDashboardService", () => ({
  getCandidateDashboardData: vi.fn(),
  getCandidateDashboardRecommendations: vi.fn(),
}));

function buildSampleDashboard(overrides?: Partial<CandidateDashboardData>): CandidateDashboardData {
  return {
    profile: {
      id: "12",
      name: "Nguyễn Minh Khoa",
      title: "Backend Developer Intern / Fresher",
      location: "Thành phố Hồ Chí Minh",
      profileCompletion: 85,
    },
    stats: {
      activeJobs: 28,
      savedJobs: 4,
      applications: 3,
      cvs: 2,
    },
    cv: {
      id: "41",
      fileName: "Nguyen_Minh_Khoa_Backend_CV.pdf",
      fileSize: "124.5 KB",
      uploadedAt: "18/11/2026 09:30",
      active: true,
    },
    missingProfileItems: [
      { id: "projects", label: "Dự án cá nhân", path: "/candidate/profile/edit?section=projects" },
    ],
    jobs: [
      {
        id: "101",
        title: "Java Spring Boot Intern",
        companyId: "5",
        companyName: "NovaTech Digital",
        location: "TP. Hồ Chí Minh",
        salary: "8.000.000 - 12.000.000 đồng",
        industry: "Software",
        experience: null,
        jobType: "Thực tập",
        workMode: "Hybrid",
        level: "Intern",
        skills: ["Java", "Spring Boot", "PostgreSQL"],
        description: "",
        requirements: [],
        benefits: [],
        deadline: "30/11/2026",
        postedAt: "18/11/2026 08:00",
        status: "published",
        views: 0,
        applicants: 0,
      },
    ],
    applications: [
      {
        id: "301",
        jobId: "101",
        jobTitle: "Backend Developer Fresher",
        companyName: "Sao Mai Cloud Lab",
        appliedAt: "17/11/2026 14:20",
        updatedAt: "17/11/2026 16:00",
        status: "REVIEWED",
      },
    ],
    notifications: [
      {
        id: "501",
        title: "Hồ sơ của bạn đã được xem",
        body: "Sao Mai Cloud Lab vừa xem hồ sơ ứng tuyển của bạn.",
        createdAt: "18/11/2026 09:00",
        read: false,
        targetPath: "/candidate/applications/301",
      },
    ],
    unreadNotifications: 1,
    ...overrides,
  };
}

function buildSampleRecommendations(): CandidateDashboardRecommendation[] {
  return [
    {
      id: "1",
      jobId: "101",
      jobTitle: "Java Backend Engineer Intern",
      companyName: "NovaTech Digital",
      rankPosition: 1,
      tierRankPosition: 1,
      rankingTier: "PRIMARY",
      displayScoreLabel: "Match Score",
      displayTierLabel: "Phù hợp tổng thể",
      displayScore: 0.88,
      matchedSkills: ["Java", "Spring Boot"],
      missingSkills: ["Docker"],
      reason: "Khớp tốt kỹ năng Java và Spring Boot theo CV.",
    },
    {
      id: "2",
      jobId: "102",
      jobTitle: "Platform Engineer (EN/VI Cross-Language)",
      companyName: "Bắc Đẩu Software",
      rankPosition: 2,
      tierRankPosition: 1,
      rankingTier: "FALLBACK",
      displayScoreLabel: "Skill Score",
      displayTierLabel: "Đối sánh kỹ năng",
      displayScore: 0.75,
      matchedSkills: ["PostgreSQL"],
      missingSkills: ["Kubernetes"],
      reason: "Đối sánh dựa trên tập kỹ năng chuẩn hóa.",
    },
  ];
}

function renderDashboard() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <CandidateDashboardPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe("CandidateDashboardPage & Phase A MobileSidebar fixes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders the NOVA MOTION skeleton while dashboard data is loading", () => {
    vi.mocked(getCandidateDashboardData).mockReturnValue(new Promise(() => {}));
    vi.mocked(getCandidateDashboardRecommendations).mockReturnValue(new Promise(() => {}));

    renderDashboard();

    const loadingStatus = screen.getByRole("status", { name: "Đang tải bảng điều khiển ứng viên" });
    expect(loadingStatus).toHaveAttribute("aria-busy", "true");
  });

  it("renders error state when loading dashboard data fails", async () => {
    vi.mocked(getCandidateDashboardData).mockRejectedValueOnce(new Error("Mất kết nối máy chủ"));
    vi.mocked(getCandidateDashboardRecommendations).mockResolvedValueOnce([]);

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể tải dữ liệu. Vui lòng thử lại.");
  });

  it("renders NOVA MOTION dashboard, separates V3 PRIMARY vs FALLBACK score labels, and toggles saved job", async () => {
    const user = userEvent.setup();
    vi.mocked(getCandidateDashboardData).mockResolvedValueOnce(buildSampleDashboard());
    vi.mocked(getCandidateDashboardRecommendations).mockResolvedValueOnce(buildSampleRecommendations());
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { success: true } });
    vi.mocked(httpClient.delete).mockResolvedValueOnce({ data: { success: true } });

    renderDashboard();

    const heading = await screen.findByRole("heading", { level: 1, name: "Xin chào, Nguyễn Minh Khoa" });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem gợi ý việc làm/i })).toHaveAttribute(
      "href",
      "/candidate/jobs/recommended",
    );
    expect(screen.getByRole("link", { name: /Quản lý CV/i })).toHaveAttribute("href", "/candidate/cvs");

    // 4 Bento KPI figures
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // V3 PRIMARY vs FALLBACK separation
    expect(screen.getByText("Phù hợp tổng thể")).toBeInTheDocument();
    expect(screen.getByText("Match Score 88%")).toBeInTheDocument();
    expect(screen.getByText("Đối sánh kỹ năng")).toBeInTheDocument();
    expect(screen.getByText("Skill Score 75%")).toBeInTheDocument();

    // Active CV, missing profile item, application status, and notification
    expect(screen.getAllByText("Nguyen_Minh_Khoa_Backend_CV.pdf").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: /Dự án cá nhân/i })).toHaveAttribute(
      "href",
      "/candidate/profile/edit?section=projects",
    );
    expect(screen.getByText("Đã xem")).toBeInTheDocument();
    expect(screen.getByText("Hồ sơ của bạn đã được xem")).toBeInTheDocument();

    // Save then unsave job
    const saveButton = screen.getByRole("button", { name: "Lưu việc làm" });
    expect(saveButton.className).toContain("min-h-[44px]");
    expect(saveButton.className).toContain("min-w-[44px]");

    await user.click(saveButton);
    expect(httpClient.post).toHaveBeenCalledWith("/students/me/saved-jobs/101");
    expect(await screen.findByText("Đã lưu việc làm")).toBeInTheDocument();

    const unsaveButton = screen.getByRole("button", { name: "Bỏ lưu việc làm" });
    await user.click(unsaveButton);
    expect(httpClient.delete).toHaveBeenCalledWith("/students/me/saved-jobs/101");
    expect(await screen.findByText("Đã bỏ lưu việc làm")).toBeInTheDocument();
  });

  it("renders empty states gracefully when cv, recommendations, jobs, applications, and notifications are empty", async () => {
    vi.mocked(getCandidateDashboardData).mockResolvedValueOnce(
      buildSampleDashboard({
        cv: null,
        missingProfileItems: [],
        jobs: [],
        applications: [],
        notifications: [],
        unreadNotifications: 0,
      }),
    );
    vi.mocked(getCandidateDashboardRecommendations).mockResolvedValueOnce([]);

    renderDashboard();

    await screen.findByRole("heading", { level: 1, name: "Xin chào, Nguyễn Minh Khoa" });
    expect(screen.getByText(/Chưa có lượt gợi ý gần đây/i)).toBeInTheDocument();
    expect(screen.getByText("Chưa có việc làm đang tuyển.")).toBeInTheDocument();
    expect(screen.getByText("Bạn chưa ứng tuyển công việc nào.")).toBeInTheDocument();
    expect(screen.getByText("Bạn chưa có CV đang dùng.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có thông báo.")).toBeInTheDocument();
    expect(screen.getByText("Hồ sơ đã đủ các trường chính.")).toBeInTheDocument();
  });

  it("ensures MobileSidebar open/close touch targets are >=44x44, reserves corner space, and closes on Escape", async () => {
    const user = userEvent.setup();

    function MobileShellFixture() {
      const [open, setOpen] = useState(false);
      return (
        <AuthProvider>
          <MemoryRouter initialEntries={["/candidate/dashboard"]}>
            <DashboardHeader title="Ứng viên" onOpenSidebar={() => setOpen(true)} />
            <MobileSidebar
              open={open}
              title="Ứng viên"
              items={candidateMenu}
              onClose={() => setOpen(false)}
            />
          </MemoryRouter>
        </AuthProvider>
      );
    }

    render(<MobileShellFixture />);

    const openButton = screen.getByRole("button", { name: "Mở menu điều hướng" });
    expect(openButton.className).toContain("min-h-[44px]");
    expect(openButton.className).toContain("min-w-[44px]");

    await user.click(openButton);

    const dialog = screen.getByRole("dialog", { name: "Ứng viên" });
    expect(dialog).toBeInTheDocument();

    const closeButton = within(dialog).getByRole("button", { name: "Đóng menu" });
    expect(closeButton).toHaveFocus();
    expect(closeButton.className).toContain("min-h-[44px]");
    expect(closeButton.className).toContain("min-w-[44px]");

    const headerWrapper = within(dialog).getByText("JobRecommend").closest(".border-b");
    expect(headerWrapper?.className).toContain("pr-[68px]");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });
});
