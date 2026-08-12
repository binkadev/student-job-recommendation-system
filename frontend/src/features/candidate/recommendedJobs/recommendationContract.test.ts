import { describe, expect, it } from "vitest";
import { getScorePresentation } from "../../shared/ranking/rankingScoreTypes";
import { getCvReadiness, mapRecommendationScoreFields } from "./recommendedJobsService";

describe("student recommendation V3 contract", () => {
  it("uses Match Score for PRIMARY and Skill Match for FALLBACK", () => {
    const primary = mapRecommendationScoreFields({ id: 1, jobId: 1, jobTitle: "Job", companyName: "Company", rankingTier: "PRIMARY", tierRankPosition: 1, rankingScore: 0.8, overallScore: 0.8, textScore: 0.7, skillScore: 1, scoringStrategy: "SAME_LANGUAGE_HYBRID" });
    const fallback = mapRecommendationScoreFields({ id: 2, jobId: 2, jobTitle: "Job", companyName: "Company", rankingTier: "FALLBACK", tierRankPosition: 1, rankingScore: 1, overallScore: null, textScore: null, skillScore: 1, scoringStrategy: "CROSS_LANGUAGE_SKILL_BASED" });

    expect(getScorePresentation(primary)).toMatchObject({ label: "Match Score", value: 0.8 });
    expect(getScorePresentation(fallback)).toMatchObject({ label: "Skill Match", value: 1 });
    expect(fallback.overallScore).toBeNull();
    expect(fallback.textScore).toBeNull();
  });

  it("keeps null-tier history out of V3 tiers", () => {
    const legacy = mapRecommendationScoreFields({ id: 3, jobId: 3, jobTitle: "Job", companyName: "Company", score: 75, rankingTier: null, tierRankPosition: null });
    expect(legacy).toMatchObject({ rankingTier: null, tierRankPosition: null, legacyResult: true, rankingScore: 0.75 });
    expect(getScorePresentation(legacy).label).toBe("Điểm lịch sử");
  });

  it("accepts READY V3 analysis without extractedText", () => {
    expect(getCvReadiness({
      status: "READY",
      processedText: "normalized cv text",
      extractedText: null,
      languageCode: "vi",
      languageConfidence: 0.92,
      processingVersion: "bilingual-nlp-v2-skills-v1",
    })).toEqual({ status: "READY", ready: true, reason: null });
  });
});
