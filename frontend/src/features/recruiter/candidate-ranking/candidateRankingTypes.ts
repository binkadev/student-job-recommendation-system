import type { RankingScoreFields } from "../../shared/ranking/rankingScoreTypes";

export type CandidateRankingRunStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "UNKNOWN";
export type CandidateRankingApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";

export interface CandidateRankingRun {
  id: string;
  jobId: string;
  jobTitle: string;
  status: CandidateRankingRunStatus;
  algorithm: string;
  algorithmVersion: string;
  startedAt: string;
  finishedAt: string;
  errorMessage: string | null;
  totalApplications: number;
  eligibleCandidates: number;
  skippedNoCv: number;
  skippedNotReady: number;
  skippedTerminalStatus: number;
  resultCount: number;
}

export interface CandidateRankingResult extends RankingScoreFields {
  id: string;
  applicationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  cvFileId: string | null;
  cvFileName: string | null;
  rankPosition?: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string | null;
  applicationStatus: CandidateRankingApplicationStatus | "UNKNOWN";
}

export interface CandidateRankingRunDetail {
  run: CandidateRankingRun;
  results: CandidateRankingResult[];
}

export interface CandidateRankingJob {
  id: string;
  title: string;
  status: string;
  location: string;
  jobType: string;
  workingModel: string;
}
