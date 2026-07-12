import type { PublicJobListItem } from "../../public/jobs/jobsListTypes";

export interface CandidateDashboardProfile {
  id: string;
  name: string;
  title: string;
  location: string;
  profileCompletion: number;
  profileViews: number;
}

export interface CandidateDashboardStats {
  matchedJobs: number;
  savedJobs: number;
  applications: number;
  interviews: number;
}

export interface CandidateDashboardCv {
  id: string;
  fileName: string;
  score: number;
  updatedAt: string;
  isPublic: boolean;
}

export interface CandidateDashboardApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  appliedAt: string;
  status: "submitted" | "reviewing" | "interview" | "offer" | "rejected";
}

export interface CandidateDashboardInterview {
  id: string;
  jobTitle: string;
  companyName: string;
  startsAt: string;
  mode: "Online" | "Offline";
  locationOrLink: string;
  status: "pending" | "confirmed";
}

export interface CandidateDashboardNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  targetPath: string;
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
  recommendedJobs: PublicJobListItem[];
  applications: CandidateDashboardApplication[];
  interviews: CandidateDashboardInterview[];
  notifications: CandidateDashboardNotification[];
}
