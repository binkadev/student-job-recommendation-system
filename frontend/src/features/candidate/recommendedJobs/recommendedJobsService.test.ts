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

  it("displays the Backend explanation verbatim for FALLBACK", () => {
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
        reason: "Backend explanation: Java matched; Docker missing.",
      }],
    } } });

    return getRecommendationRun("1").then(({ results }) => {
      const reasons = results[0].recommendationReasons;
      expect(reasons).toEqual(["Backend explanation: Java matched; Docker missing."]);
      expect(reasons).not.toContain("Skill Score 100%");
    });
  });

  it("does not invent an explanation or a global rank when optional evidence is absent", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce({ data: { data: { id: 9, results: [{
      id: 99, jobId: 99, jobTitle: "Job", companyName: "Company", rankingTier: "FALLBACK", tierRankPosition: 3,
      rankingScore: 0, overallScore: null, textScore: null, skillScore: 0, scoringStrategy: "CROSS_LANGUAGE_SKILL_BASED",
    }] } } });
    const { results } = await getRecommendationRun("9");
    expect(results[0].recommendationReasons).toEqual([]);
    expect(results[0].rankPosition).toBeNull();
    expect(results[0].tierRankPosition).toBe(3);
    expect(results[0].overallScore).toBeNull();
  });
});
