import { describe, expect, it } from "vitest";
import {
  formatScore,
  mapRankingResult,
  mapRankingRun,
  mapRankingRunDetail,
  sanitizeErrorMessage,
} from "./candidateRankingMappers";

describe("candidate ranking mappers", () => {
  it("normalizes numeric and string IDs and numeric strings", () => {
    const result = mapRankingResult({
      id: 9,
      applicationId: "101",
      studentId: 7,
      rankingTier: "PRIMARY",
      tierRankPosition: 1,
      rankingScore: "0.75",
      overallScore: "0.75",
      scoringStrategy: "SAME_LANGUAGE_HYBRID",
      textScore: "0.5",
      skillScore: 1,
    });

    expect(result.id).toBe("9");
    expect(result.applicationId).toBe("101");
    expect(result.studentId).toBe("7");
    expect(result.rankingScore).toBe(0.75);
    expect(result.overallScore).toBe(0.75);
    expect(result.textScore).toBe(0.5);
    expect(result.skillScore).toBe(1);
  });

  it("keeps null textScore null", () => {
    expect(mapRankingResult({ textScore: null }).textScore).toBeNull();
  });

  it("maps unknown run and application statuses to UNKNOWN", () => {
    expect(mapRankingRun({ status: "NEW_STATUS" }).status).toBe("UNKNOWN");
    expect(mapRankingResult({ applicationStatus: "ON_HOLD" }).applicationStatus).toBe("UNKNOWN");
  });

  it("preserves Backend rankPosition exactly", () => {
    expect(mapRankingResult({ rankPosition: "7" }).rankPosition).toBe(7);
    expect(mapRankingResult({ rankPosition: 0 }).rankPosition).toBe(0);
    expect(mapRankingResult({ rankPosition: null }).rankPosition).toBeNull();
  });

  it("normalizes skill arrays without inventing values", () => {
    expect(mapRankingResult({ matchedSkills: [" React ", "", "TypeScript"], missingSkills: null })).toMatchObject({
      matchedSkills: ["React", "TypeScript"],
      missingSkills: [],
    });
  });

  it("uses honest fallbacks for missing identity and date fields", () => {
    const result = mapRankingResult({ studentName: null, studentEmail: "", cvFileName: null });
    const run = mapRankingRun({ startedAt: "not-a-date", finishedAt: null });

    expect(result.studentName).toBe("Chưa cập nhật");
    expect(result.studentEmail).toBe("Chưa cập nhật");
    expect(result.cvFileName).toBeNull();
    expect(run.startedAt).toBe("Chưa cập nhật");
    expect(run.finishedAt).toBe("Chưa cập nhật");
  });

  it("formats public scores without changing their meaning", () => {
    expect(formatScore(null)).toBe("Không áp dụng");
    expect(formatScore(0)).toBe("0%");
    expect(formatScore(0.425)).toBe("43%");
    expect(formatScore(1)).toBe("100%");
    expect(formatScore(Number.NaN)).toBe("Không áp dụng");
    expect(formatScore(Number.POSITIVE_INFINITY)).toBe("Không áp dụng");
  });

  it("sanitizes bearer tokens and enforces the existing maximum length", () => {
    const token = "Bearer abc.def_123";
    expect(sanitizeErrorMessage(`Backend rejected ${token}`)).toBe("Backend rejected [token]");
    expect(sanitizeErrorMessage("x".repeat(400))).toHaveLength(300);
  });

  it("preserves Backend result order and never creates rank positions", () => {
    const detail = mapRankingRunDetail({
      id: 4,
      results: [
        { applicationId: 20, rankPosition: 8, score: 0.2 },
        { applicationId: 10, rankPosition: 2, score: 0.9 },
      ],
    });

    expect(detail.results.map((result) => result.applicationId)).toEqual(["20", "10"]);
    expect(detail.results.map((result) => result.rankPosition)).toEqual([8, 2]);
  });

  it("maps a missing history result list to an empty list", () => {
    expect(mapRankingRunDetail({ results: null }).results).toEqual([]);
  });

  it("preserves a null-tier historical result without inventing V3 semantics", () => {
    const result = mapRankingResult({ score: 85, rankingTier: null, tierRankPosition: null });
    expect(result).toMatchObject({ rankingTier: null, tierRankPosition: null, rankingScore: 0.85, legacyResult: true });
  });

  it("maps V3 requested tier limits and leaves V2 limits distinct", () => {
    expect(mapRankingRun({ requestedLimit: null, requestedPrimaryLimit: 50, requestedFallbackLimit: 0 })).toMatchObject({ requestedLimit: null, requestedPrimaryLimit: 50, requestedFallbackLimit: 0 });
    expect(mapRankingRun({ requestedLimit: 20, requestedPrimaryLimit: null, requestedFallbackLimit: null })).toMatchObject({ requestedLimit: 20, requestedPrimaryLimit: null, requestedFallbackLimit: null });
  });
});
