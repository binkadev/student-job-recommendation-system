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
  sourceType: string;
  algorithm: string;
  algorithmVersion: string;
  totalJobsScanned: number;
  totalRecommended: number;
  status: string;
  createdAt: string;
}

export interface CandidateCvOption {
  id: string;
  name: string;
  active: boolean;
  uploadedAt: string;
}

export interface RecommendedJobFilters {
  minMatch: number;
  location: string;
  industry: string;
  salary: string;
  experience: string;
  workMode: string;
}
