import type { PublicJobListItem } from "../../public/jobs/jobsListTypes";

export interface MatchCriterion {
  label: string;
  value: number;
  explanation: string;
}

export interface CandidateRecommendedJob extends PublicJobListItem {
  matchScore: number;
  skillScore: number;
  experienceScore: number;
  educationScore: number;
  locationScore: number;
  salaryScore: number;
  workModeScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendationReasons: string[];
}

export interface RecommendedJobFilters {
  minMatch: number;
  location: string;
  industry: string;
  salary: string;
  experience: string;
  workMode: string;
}
