import type { PublicJobListItem } from "../../public/jobs/jobsListTypes";
import type { RankingScoreFields } from "../../shared/ranking/rankingScoreTypes";

export interface MatchCriterion {
  label: string;
  value: number;
  explanation: string;
}

export interface CandidateRecommendedJob extends Omit<PublicJobListItem, "matchScore">, RankingScoreFields {
  rankPosition?: number | null;
  scoringStrategyLabel?: string | null;
  displayScoreLabel: "Match Score" | "Skill Score" | "Điểm lịch sử";
  displayTierLabel: "Phù hợp tổng thể" | "Đối sánh kỹ năng" | "Kết quả lịch sử";
  displayScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  recommendationReasons: string[];
}

export interface RecommendationRun {
  id: string;
  cvId: string | null;
  sourceType: string;
  algorithm: string;
  algorithmVersion: string;
  totalJobsScanned: number;
  totalRecommended: number;
  status: string;
  errorMessage?: string | null;
  startedAt: string;
  finishedAt: string;
  createdAt: string;
}

export interface RecommendationSummary {
  attemptedRun: RecommendationRun | null;
  successfulRun: RecommendationRun | null;
  hasStaleSuccessfulResults: boolean;
}

export interface CandidateCvOption {
  id: string;
  name: string;
  active: boolean;
  analysisStatus: string;
  ready: boolean;
  readinessReason?: string | null;
  uploadedAt: string;
}

export interface GenerateRecommendationPayload {
  cvId: string;
  threshold: number;
  limit: number;
}

export interface RecommendedJobFilters {
  minDisplayScore: number;
  location: string;
  industry: string;
  salary: string;
  workMode: string;
}
