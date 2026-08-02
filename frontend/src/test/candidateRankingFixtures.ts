import type { CandidateRankingJob, CandidateRankingResult, CandidateRankingRun, CandidateRankingRunDetail } from "../features/recruiter/candidate-ranking/candidateRankingTypes";

export function makeRun(overrides: Partial<CandidateRankingRun> = {}): CandidateRankingRun {
  return {
    id: "run-1",
    jobId: "42",
    jobTitle: "Frontend Engineer",
    status: "SUCCESS",
    algorithm: "tfidf-cosine-hybrid",
    algorithmVersion: "bilingual-candidate-ranking-v2",
    startedAt: "01/08/2026, 10:00",
    finishedAt: "01/08/2026, 10:01",
    errorMessage: null,
    totalApplications: 4,
    eligibleCandidates: 3,
    skippedNoCv: 1,
    skippedNotReady: 0,
    skippedTerminalStatus: 0,
    resultCount: 2,
    ...overrides,
  };
}

export function makeResult(overrides: Partial<CandidateRankingResult> = {}): CandidateRankingResult {
  return {
    id: "result-1",
    applicationId: "101",
    studentId: "7",
    studentName: "Nguyen An",
    studentEmail: "an@example.com",
    cvFileId: "cv-1",
    cvFileName: "nguyen-an.pdf",
    rankPosition: 1,
    score: 0.875,
    textScore: 0.8,
    skillScore: 1,
    scoringStrategy: "SAME_LANGUAGE_HYBRID",
    matchedSkills: ["React", "TypeScript", "CSS", "Testing Library"],
    missingSkills: ["Docker", "PostgreSQL"],
    reason: "Kỹ năng phù hợp với yêu cầu công việc.",
    applicationStatus: "PENDING",
    ...overrides,
  };
}

export function makeDetail(overrides: { run?: Partial<CandidateRankingRun>; results?: CandidateRankingResult[] } = {}): CandidateRankingRunDetail {
  return { run: makeRun(overrides.run), results: overrides.results ?? [makeResult()] };
}

export const rankingJob: CandidateRankingJob = {
  id: "42",
  title: "Frontend Engineer",
  status: "ACTIVE",
  location: "Ho Chi Minh City",
  jobType: "FULL_TIME",
  workingModel: "HYBRID",
};
