import { httpClient } from "../../../services/api/httpClient";
import type { CandidateCvOption, CandidateRecommendedJob, GenerateRecommendationPayload, RecommendationRun, RecommendedJobFilters } from "./recommendedJobsTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface RecommendationResultResponse {
  id: number;
  jobId: number;
  jobTitle: string;
  companyName: string;
  rankPosition?: number | null;
  score?: number | string | null;
  matchedKeywords?: string[] | null;
  matchedSkills?: string[] | null;
  missingKeywords?: string[] | null;
  missingSkills?: string[] | null;
  reason?: string | null;
  explanation?: string | null;
  createdAt?: string | null;
}

interface RecommendationRunResponse {
  id: number;
  cvId?: number | null;
  sourceType?: string | null;
  algorithm?: string | null;
  algorithmVersion?: string | null;
  totalJobsScanned?: number | null;
  totalRecommended?: number | null;
  status?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
  results?: RecommendationResultResponse[] | null;
}

interface CvFileResponse {
  id: number;
  originalFileName?: string | null;
  fileName?: string | null;
  isActive?: boolean;
  active?: boolean;
  uploadedAt?: string | null;
}

export function getRecommendedJobState() {
  return {
    hiddenIds: [],
    notInterestedIds: [],
  };
}

export function saveRecommendedJobState(hiddenIds: string[], notInterestedIds: string[]) {
  void hiddenIds;
  void notInterestedIds;
}

export async function getRecommendedJobs(filters: RecommendedJobFilters, hiddenIds: string[]) {
  const response = await httpClient.get<ApiResponse<RecommendationResultResponse[]>>("/students/me/recommendation-results/latest");
  const items = response.data.data ?? [];
  return items
    .map(mapRecommendationResult)
    .filter((job) => {
      const matchHidden = !hiddenIds.includes(job.id);
      const matchScore = job.matchScore >= filters.minMatch;
      const matchLocation = !filters.location || normalizeText(job.location).includes(normalizeText(filters.location));
      const matchIndustry = !filters.industry || job.industry === filters.industry;
      const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
      const matchExperience = !filters.experience || job.experienceLabel.includes(filters.experience);
      const matchSalary = !filters.salary || job.salaryMax >= Number(filters.salary) * 1_000_000;
      return matchHidden && matchScore && matchLocation && matchIndustry && matchWorkMode && matchExperience && matchSalary;
    })
    .sort((a, b) => {
      if (a.rankPosition != null && b.rankPosition != null) return a.rankPosition - b.rankPosition;
      return b.matchScore - a.matchScore;
    });
}

export async function getRecommendationRuns(): Promise<RecommendationRun[]> {
  const response = await httpClient.get<ApiResponse<RecommendationRunResponse[]>>("/students/me/recommendation-runs");
  return (response.data.data ?? []).map(mapRecommendationRun);
}

export async function getRecommendationRun(runId: string) {
  const response = await httpClient.get<ApiResponse<RecommendationRunResponse>>(`/students/me/recommendation-runs/${runId}`);
  return {
    run: mapRecommendationRun(response.data.data),
    results: (response.data.data.results ?? []).map(mapRecommendationResult),
  };
}

function mapRecommendationRun(run: RecommendationRunResponse): RecommendationRun {
  return {
    id: String(run.id),
    cvId: run.cvId == null ? null : String(run.cvId),
    sourceType: run.sourceType ?? "Chua cap nhat",
    algorithm: run.algorithm ?? "Chua cap nhat",
    algorithmVersion: run.algorithmVersion ?? "Chua cap nhat",
    totalJobsScanned: run.totalJobsScanned ?? 0,
    totalRecommended: run.totalRecommended ?? 0,
    status: run.status ?? "UNKNOWN",
    errorMessage: run.errorMessage ?? null,
    startedAt: formatDateTime(run.startedAt),
    finishedAt: formatDateTime(run.finishedAt),
    createdAt: formatDateTime(run.createdAt),
  };
}

export async function generateRecommendations(payload: GenerateRecommendationPayload) {
  const response = await httpClient.post<ApiResponse<RecommendationRunResponse>>("/students/me/recommendations/generate", {
    cvId: Number(payload.cvId),
    threshold: payload.threshold,
    limit: payload.limit,
  });
  return response.data.data;
}

export async function getCandidateCvOptions(): Promise<CandidateCvOption[]> {
  const response = await httpClient.get<ApiResponse<CvFileResponse[]>>("/students/me/cv");
  return (response.data.data ?? []).map((cv) => ({
    id: String(cv.id),
    name: cv.originalFileName || cv.fileName || `CV #${cv.id}`,
    active: Boolean(cv.isActive ?? cv.active),
    uploadedAt: formatDateTime(cv.uploadedAt),
  }));
}

export function getRecommendedFilterOptions(jobs: CandidateRecommendedJob[]) {
  return {
    locations: Array.from(new Set(jobs.map((job) => job.location).filter(Boolean))),
    industries: Array.from(new Set(jobs.map((job) => job.industry).filter(Boolean))),
    workModes: Array.from(new Set(jobs.map((job) => job.workMode).filter(Boolean))),
  };
}

function mapRecommendationResult(result: RecommendationResultResponse): CandidateRecommendedJob {
  const matchedSkills = normalizeStringArray(result.matchedSkills ?? result.matchedKeywords);
  const missingSkills = normalizeStringArray(result.missingSkills ?? result.missingKeywords);
  const reason = result.reason || result.explanation;
  const score = toPercent(result.score);
  const jobTitle = result.jobTitle || `Cong viec #${result.jobId}`;

  return {
    id: String(result.jobId),
    logo: getInitials(result.companyName),
    title: jobTitle,
    companyId: undefined,
    companyName: result.companyName || "Chua cap nhat",
    salary: "Chua cap nhat",
    salaryMax: 0,
    location: "Chua cap nhat",
    industry: jobTitle,
    experienceYears: 0,
    experienceLabel: "Chua cap nhat",
    level: "Chua cap nhat",
    jobType: "Chua cap nhat",
    workMode: "Chua cap nhat",
    skills: matchedSkills,
    postedAt: formatDate(result.createdAt),
    deadline: "Chua cap nhat",
    applicants: 0,
    status: "published",
    matchScore: score,
    rankPosition: result.rankPosition ?? null,
    matchedSkills,
    missingSkills,
    recommendationReasons: reason ? [reason] : [],
  };
}

function normalizeStringArray(value?: string[] | null) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toPercent(value?: number | string | null) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return 0;
  const percent = numberValue <= 1 ? numberValue * 100 : numberValue;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return "Chua cap nhat";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chua cap nhat";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getInitials(value?: string | null) {
  const initials = (value || "")
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(-2)
    .toUpperCase();
  return initials || "CT";
}
