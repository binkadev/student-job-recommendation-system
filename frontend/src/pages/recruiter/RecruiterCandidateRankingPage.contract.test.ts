import { describe, expect, it } from "vitest";
import { isValidCandidateRankingLimits } from "./candidateRankingLimits";

describe("candidate-ranking V3 limits", () => {
  it.each([[50, 0], [0, 50], [100, 0], [0, 100]])("accepts %i/%i", (primary, fallback) => {
    expect(isValidCandidateRankingLimits(primary, fallback)).toBe(true);
  });

  it.each([[0, 0], [60, 60], [101, 0], [-1, 10]])("rejects %i/%i", (primary, fallback) => {
    expect(isValidCandidateRankingLimits(primary, fallback)).toBe(false);
  });
});
