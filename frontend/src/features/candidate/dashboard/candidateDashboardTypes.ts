import type { Job } from "../../../types/domain";

export interface CandidateDashboardProfile {
  id: string;
  name: string;
  title: string;
  location: string;
  profileCompletion: number;
}

export interface CandidateDashboardStats {
  activeJobs: number;
  savedJobs: number;
  applications: number;
  cvs: number;
}

export interface CandidateDashboardCv {
  id: string;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  active: boolean;
}

export type CandidateDashboardApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface CandidateDashboardApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  appliedAt: string;
  updatedAt: string;
  status: CandidateDashboardApplicationStatus;
}

export interface CandidateDashboardNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  targetPath: string;
}

export interface CandidateDashboardRecommendation {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  rankPosition: number | null;
  tierRankPosition: number | null;
  rankingTier: "PRIMARY" | "FALLBACK" | null;
  displayScoreLabel: string;
  displayTierLabel: string;
  displayScore: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
}

export interface MissingProfileItem {
  id: string;
  label: string;
  path: string;
}

export interface CandidateDashboardData {
  profile: CandidateDashboardProfile;
  stats: CandidateDashboardStats;
  cv: CandidateDashboardCv | null;
  missingProfileItems: MissingProfileItem[];
  jobs: Job[];
  applications: CandidateDashboardApplication[];
  notifications: CandidateDashboardNotification[];
  unreadNotifications: number;
}
