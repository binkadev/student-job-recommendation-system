import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../services/api/httpClient";
import { generateRecommendations, getRecommendationRun } from "./recommendedJobsService";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { post: vi.fn(), get: vi.fn() } }));

describe("student recommendation request", () => {
  beforeEach(() => vi.resetAllMocks());

  it("serializes exactly cvId, threshold, and limit", async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { data: {} } });
    await generateRecommendations({ cvId: "12", threshold: 0.1, limit: 20 });
    expect(httpClient.post).toHaveBeenCalledWith("/students/me/recommendations/generate", { cvId: 12, threshold: 0.1, limit: 20 });
  });

  it("keeps the FALLBACK Skill Match explanation accurate when skill coverage is below 100%", () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { data: {
      id: 1,
      results: [{
        id: 1,
        jobId: 1,
        jobTitle: "Backend Developer",
        companyName: "Example Company",
        rankingTier: "FALLBACK",
        tierRankPosition: 1,
        rankingScore: 0.5,
        skillScore: 0.5,
        overallScore: null,
        textScore: null,
        scoringStrategy: "CROSS_LANGUAGE_SKILL_BASED",
        matchedSkills: ["Java"],
        missingSkills: ["Docker"],
      }],
    } } });

    return getRecommendationRun("1").then(({ results }) => {
      const reasons = results[0].recommendationReasons;
      expect(reasons).toContain("Skill Match chỉ thể hiện mức độ đáp ứng các kỹ năng đã khai báo của vị trí, không phải độ phù hợp tổng thể của CV với công việc.");
      expect(reasons).not.toContain("Skill Match 100%");
    });
  });
});
