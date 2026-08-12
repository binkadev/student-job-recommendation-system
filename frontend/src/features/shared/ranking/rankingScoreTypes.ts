export type RankingTier = "PRIMARY" | "FALLBACK";

export type RecommendationScoringStrategy =
  | "SAME_LANGUAGE_HYBRID"
  | "CROSS_LANGUAGE_SKILL_BASED";

export interface RankingScoreFields {
  rankingTier: RankingTier | null;
  tierRankPosition: number | null;
  rankingScore: number;
  overallScore: number | null;
  textScore: number | null;
  skillScore: number;
  scoringStrategy: RecommendationScoringStrategy | null;
  legacyResult: boolean;
  invalidScoreContract?: boolean;
}

export function formatNormalizedScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Không áp dụng";
  if (value < 0 || value > 1) return "Không hợp lệ";
  return `${Math.round(value * 100)}%`;
}

export function getScorePresentation(result: Pick<RankingScoreFields, "rankingTier" | "overallScore" | "skillScore" | "rankingScore">) {
  if (result.rankingTier === "PRIMARY") {
    return {
      label: "Match Score",
      value: result.overallScore,
      tierLabel: "Phù hợp tổng thể",
      methodLabel: "Đối sánh nội dung và kỹ năng",
    } as const;
  }

  if (result.rankingTier === "FALLBACK") {
    return {
      label: "Skill Score",
      value: result.skillScore,
      tierLabel: "Đối sánh kỹ năng",
      methodLabel: "Đối sánh dựa trên kỹ năng",
    } as const;
  }

  return {
    label: "Điểm lịch sử",
    value: result.rankingScore,
    tierLabel: "Kết quả lịch sử",
    methodLabel: "Kết quả lịch sử chưa có ngữ nghĩa V3",
  } as const;
}

export function normalizeRankingTier(value?: string | null): RankingTier | null {
  if (value === "PRIMARY" || value === "FALLBACK") return value;
  return null;
}

export function normalizeScoringStrategy(value?: string | null): RecommendationScoringStrategy | null {
  if (value === "SAME_LANGUAGE_HYBRID" || value === "CROSS_LANGUAGE_SKILL_BASED") return value;
  return null;
}

export function toNormalizedScore(value?: number | string | null) {
  if (value == null || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score < 0 || score > 1) return null;
  return score;
}

export function toLegacyNormalizedScore(value?: number | string | null) {
  if (value == null || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score >= 0 && score <= 1) return score;
  if (score > 1 && score <= 100) return score / 100;
  return null;
}
