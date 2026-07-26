import type { PublicJobListItem } from "../../public/jobs/jobsListTypes";

export interface MatchCriterion {
  label: string;
  value: number;
  explanation: string;
}

export interface CandidateRecommendedJob extends PublicJobListItem {
  rankPosition?: number | null;
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

export interface CandidateCvOption {
  id: string;
  name: string;
  active: boolean;
  uploadedAt: string;
}

export interface GenerateRecommendationPayload {
  cvId: string;
  threshold: number;
  limit: number;
}

export interface RecommendedJobFilters {
  minMatch: number;
  location: string;
  industry: string;
  salary: string;
  experience: string;
  workMode: string;
}
