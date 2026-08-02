import type {
  CandidateRankingApplicationStatus,
  CandidateRankingJob,
  CandidateRankingResult,
  CandidateRankingRun,
  CandidateRankingRunDetail,
  CandidateRankingRunStatus,
} from "./candidateRankingTypes";

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface JobDetailResponse {
  id: number;
  title: string;
  status: string;
  location: string | null;
  jobType: string | null;
  workingModel: string | null;
}

export interface CandidateRankingRunResponse {
  id?: number | string | null;
  jobId?: number | string | null;
  jobTitle?: string | null;
  status?: string | null;
  algorithm?: string | null;
  algorithmVersion?: string | null;
  threshold?: number | string | null;
  requestedLimit?: number | string | null;
  totalApplicationsScanned?: number | string | null;
  eligibleCandidates?: number | string | null;
  skippedNoCv?: number | string | null;
  skippedNotReady?: number | string | null;
  skippedTerminalStatus?: number | string | null;
  totalRanked?: number | string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
}

export interface CandidateRankingRunDetailResponse extends CandidateRankingRunResponse {
  results?: CandidateRankingResultResponse[] | null;
}

export interface CandidateRankingResultResponse {
  id?: number | string | null;
  applicationId?: number | string | null;
  studentId?: number | string | null;
  studentName?: string | null;
  studentEmail?: string | null;
  cvFileId?: number | string | null;
  cvFileName?: string | null;
  applicationStatus?: string | null;
  appliedAt?: string | null;
  score?: number | string | null;
  textScore?: number | string | null;
  skillScore?: number | string | null;
  scoringStrategy?: string | null;
  matchedSkills?: string[] | null;
  missingSkills?: string[] | null;
  reason?: string | null;
  rankPosition?: number | string | null;
  createdAt?: string | null;
}

export function mapRankingRun(run: CandidateRankingRunResponse | null | undefined): CandidateRankingRun {
  return {
    id: toId(run?.id),
    jobId: toId(run?.jobId),
    jobTitle: run?.jobTitle || "Chưa cập nhật",
    status: mapRunStatus(run?.status),
    algorithm: run?.algorithm || "Chưa cập nhật",
    algorithmVersion: run?.algorithmVersion || "Chưa cập nhật",
    startedAt: formatDateTime(run?.startedAt ?? run?.createdAt),
    finishedAt: formatDateTime(run?.finishedAt),
    errorMessage: run?.errorMessage || null,
    totalApplications: toNumber(run?.totalApplicationsScanned),
    eligibleCandidates: toNumber(run?.eligibleCandidates),
    skippedNoCv: toNumber(run?.skippedNoCv),
    skippedNotReady: toNumber(run?.skippedNotReady),
    skippedTerminalStatus: toNumber(run?.skippedTerminalStatus),
    resultCount: toNumber(run?.totalRanked),
  };
}

export function mapRankingResult(result: CandidateRankingResultResponse): CandidateRankingResult {
  return {
    id: toId(result.id ?? result.applicationId),
    applicationId: toId(result.applicationId),
    studentId: toId(result.studentId),
    studentName: result.studentName || "Chưa cập nhật",
    studentEmail: result.studentEmail || "Chưa cập nhật",
    cvFileId: result.cvFileId == null ? null : toId(result.cvFileId),
    cvFileName: result.cvFileName || null,
    rankPosition: toNullableNumber(result.rankPosition),
    score: toNullableNumber(result.score),
    textScore: toNullableNumber(result.textScore),
    skillScore: toNullableNumber(result.skillScore),
    scoringStrategy: result.scoringStrategy || null,
    matchedSkills: normalizeStringArray(result.matchedSkills),
    missingSkills: normalizeStringArray(result.missingSkills),
    reason: result.reason || null,
    applicationStatus: mapApplicationStatus(result.applicationStatus),
  };
}

export function mapRankingRunDetail(run: CandidateRankingRunDetailResponse): CandidateRankingRunDetail {
  return {
    run: mapRankingRun(run),
    results: (run.results ?? []).map(mapRankingResult),
  };
}

export function mapRankingJob(job: JobDetailResponse): CandidateRankingJob {
  return {
    id: String(job.id),
    title: job.title,
    status: job.status,
    location: job.location || "Chưa cập nhật",
    jobType: job.jobType || "Chưa cập nhật",
    workingModel: job.workingModel || "Chưa cập nhật",
  };
}

export function formatScore(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "Chưa có điểm";
  const percent = value <= 1 ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

export function sanitizeErrorMessage(value?: string | null) {
  if (!value) return "Không thể tải dữ liệu xếp hạng ứng viên. Vui lòng thử lại sau.";
  return value.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "[token]").slice(0, 300);
}

function mapRunStatus(status?: string | null): CandidateRankingRunStatus {
  if (status === "PENDING" || status === "PROCESSING" || status === "SUCCESS" || status === "FAILED") return status;
  return "UNKNOWN";
}

function mapApplicationStatus(status?: string | null): CandidateRankingApplicationStatus | "UNKNOWN" {
  if (status === "PENDING" || status === "REVIEWED" || status === "ACCEPTED" || status === "REJECTED" || status === "WITHDRAWN") return status;
  return "UNKNOWN";
}

function normalizeStringArray(value?: string[] | null) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toId(value?: number | string | null) {
  return value == null ? "" : String(value);
}

function toNumber(value?: number | string | null) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toNullableNumber(value?: number | string | null) {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}
