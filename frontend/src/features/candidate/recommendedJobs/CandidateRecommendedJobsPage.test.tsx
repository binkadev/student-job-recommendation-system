import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CandidateRecommendedJobsPage } from "./CandidateRecommendedJobsPage";
import { getRecommendedJobs } from "./recommendedJobsService";
import type { CandidateRecommendedJob } from "./recommendedJobsTypes";

vi.mock("../../../hooks/useSavedJobs", () => ({ useSavedJobs: () => ({ isSaved: () => false, toggleSavedJob: vi.fn() }) }));
vi.mock("../../../hooks/useToast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../public/jobs/useAppliedJobs", () => ({ useAppliedJobs: () => ({ canApply: () => true, getApplyButtonLabel: () => "Ứng tuyển" }) }));
vi.mock("../apply/CandidateApplyFlowModal", () => ({ CandidateApplyFlowModal: () => null }));
vi.mock("./recommendedJobsService", () => ({
  getRecommendedJobState: () => ({ hiddenIds: [] }),
  getCandidateCvOptions: async () => [],
  getRecommendationRuns: async () => [],
  getRecommendationRun: async () => null,
  getRecommendedJobs: vi.fn(),
  getRecommendedFilterOptions: () => ({ locations: [], industries: [], workModes: [] }),
  generateRecommendations: vi.fn(),
  saveRecommendedJobState: vi.fn(),
}));

function makeJob(fallback = false): CandidateRecommendedJob {
  return {
    id: fallback ? "22" : "11", title: fallback ? "Kỹ sư Java" : "Frontend Developer", companyName: "IT Company",
    logo: "IT", salary: "Thỏa thuận", salaryMax: 0, location: "Hà Nội", industry: "IT", experienceYears: 0,
    experienceLabel: null, level: null, jobType: "FULL_TIME", workMode: "Hybrid", skills: ["Java", "Docker"],
    postedAt: "02/11/2026", deadline: "30/11/2026", applicants: 0, status: "published",
    rankingTier: fallback ? "FALLBACK" : "PRIMARY", rankPosition: fallback ? 9 : 8, tierRankPosition: fallback ? 5 : 3,
    rankingScore: fallback ? 0.95 : 0.4, overallScore: fallback ? null : 0.4, textScore: fallback ? null : 0.3,
    skillScore: fallback ? 0.95 : 0.6, scoringStrategy: fallback ? "CROSS_LANGUAGE_SKILL_BASED" : "SAME_LANGUAGE_HYBRID",
    legacyResult: false, displayScoreLabel: fallback ? "Skill Score" : "Match Score",
    displayTierLabel: fallback ? "Đối sánh kỹ năng" : "Phù hợp tổng thể", displayScore: fallback ? 0.95 : 0.4,
    matchedSkills: ["Java"], missingSkills: ["Docker"], recommendationReasons: ["CV có kỹ năng Java."],
  };
}

describe("Student V3 score presentation", () => {
  beforeEach(() => { vi.mocked(getRecommendedJobs).mockResolvedValue([makeJob(true), makeJob()]); });

  it("keeps PRIMARY first despite a higher FALLBACK skill score and displays Backend ranks", async () => {
    render(<MemoryRouter><CandidateRecommendedJobsPage /></MemoryRouter>);
    await screen.findByText("Frontend Developer");
    const jobs = screen.getAllByRole("link", { name: /Frontend Developer|Kỹ sư Java/ });
    expect(jobs.map((job) => job.textContent)).toEqual(["Frontend Developer", "Kỹ sư Java"]);
    expect(screen.getByText("Thứ hạng #8")).toBeInTheDocument();
    expect(screen.getByText("#3 trong nhóm PRIMARY")).toBeInTheDocument();
    expect(screen.getByText("#5 trong nhóm FALLBACK")).toBeInTheDocument();
    expect(screen.getByText("Mức đáp ứng kỹ năng")).toBeInTheDocument();
    expect(screen.getByText(/Không so sánh trực tiếp điểm giữa hai nhóm/)).toBeInTheDocument();
  });

  it("shows unavailable overall/text scores, matched/missing skills and explanation for FALLBACK", async () => {
    vi.mocked(getRecommendedJobs).mockResolvedValue([makeJob(true)]);
    const user = userEvent.setup();
    render(<MemoryRouter><CandidateRecommendedJobsPage /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Xem phân tích" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Điểm tổng thể").parentElement).toHaveTextContent("Không áp dụng");
    expect(dialog.getByText("Điểm nội dung").parentElement).toHaveTextContent("Không áp dụng");
    expect(dialog.getByText("Java")).toBeInTheDocument();
    expect(dialog.getByText("Docker")).toBeInTheDocument();
    expect(dialog.getByText("CV có kỹ năng Java.")).toBeInTheDocument();
    expect(dialog.getByText(/FALLBACK chỉ đối sánh kỹ năng/)).toBeInTheDocument();
  });
});
