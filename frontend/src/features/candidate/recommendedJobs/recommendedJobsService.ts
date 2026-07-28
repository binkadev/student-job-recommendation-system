import { httpClient } from "../../../services/api/httpClient";
import { getPublicJobDetail } from "../../public/jobs/jobDetailService";
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
  textScore?: number | string | null;
  skillScore?: number | string | null;
  scoringStrategy?: string | null;
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

interface CvAnalysisResponse {
  status?: string | null;
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
  const jobs = await Promise.all(items.map(mapRecommendationResult));
  return jobs
    .filter((job) => {
      const matchHidden = !hiddenIds.includes(job.id);
      const matchScore = job.matchScore >= filters.minMatch;
      const matchLocation = !filters.location || normalizeText(job.location).includes(normalizeText(filters.location));
      const matchIndustry = !filters.industry || job.industry === filters.industry;
      const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
      const matchSalary = !filters.salary || job.salaryMax >= Number(filters.salary) * 1_000_000;
      return matchHidden && matchScore && matchLocation && matchIndustry && matchWorkMode && matchSalary;
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
  const results = await Promise.all((response.data.data.results ?? []).map(mapRecommendationResult));
  return {
    run: mapRecommendationRun(response.data.data),
    results,
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
  return Promise.all((response.data.data ?? []).map(async (cv) => {
    const analysisStatus = await getCvAnalysisStatus(cv.id);
    return {
      id: String(cv.id),
      name: cv.originalFileName || cv.fileName || `CV #${cv.id}`,
      active: Boolean(cv.isActive ?? cv.active),
      analysisStatus,
      ready: analysisStatus === "READY",
      uploadedAt: formatDateTime(cv.uploadedAt),
    };
  }));
}

export function getRecommendedFilterOptions(jobs: CandidateRecommendedJob[]) {
  return {
    locations: Array.from(new Set(jobs.map((job) => job.location).filter(Boolean))),
    industries: Array.from(new Set(jobs.map((job) => job.industry).filter(Boolean))),
    workModes: Array.from(new Set(jobs.map((job) => job.workMode).filter(Boolean))),
  };
}

async function mapRecommendationResult(result: RecommendationResultResponse): Promise<CandidateRecommendedJob> {
  const matchedSkills = normalizeStringArray(result.matchedSkills ?? result.matchedKeywords);
  const missingSkills = normalizeStringArray(result.missingSkills ?? result.missingKeywords);
  const reason = result.reason || result.explanation;
  const score = toPercent(result.score);
  const textScore = result.textScore == null ? null : toPercent(result.textScore);
  const skillScore = result.skillScore == null ? null : toPercent(result.skillScore);
  const jobTitle = result.jobTitle || `Cong viec #${result.jobId}`;
  const detail = await getPublicJobDetail(String(result.jobId)).catch(() => null);
  const job = detail?.job;

  return {
    id: String(result.jobId),
    logo: job?.logo ?? getInitials(result.companyName),
    title: job?.title ?? jobTitle,
    companyId: job?.companyId,
    companyName: job?.companyName ?? result.companyName ?? "Chua cap nhat",
    salary: job?.salary ?? "Chua cap nhat",
    salaryMax: job?.salaryMax ?? 0,
    location: job?.location ?? "Chua cap nhat",
    industry: job?.industry ?? jobTitle,
    experienceYears: job?.experienceYears ?? null,
    experienceLabel: job?.experienceLabel ?? null,
    level: job?.level ?? null,
    jobType: job?.jobType ?? "Chua cap nhat",
    workMode: job?.workMode ?? "Chua cap nhat",
    skills: job?.skills?.length ? job.skills : matchedSkills,
    postedAt: job?.postedAt ?? formatDate(result.createdAt),
    deadline: job?.deadline ?? "Chua cap nhat",
    applicants: job?.applicants ?? 0,
    status: job?.status ?? "published",
    matchScore: score,
    rankPosition: result.rankPosition ?? null,
    textScore,
    skillScore,
    scoringStrategy: result.scoringStrategy ?? null,
    matchedSkills,
    missingSkills,
    recommendationReasons: reason ? [reason] : [],
  };
}

async function getCvAnalysisStatus(cvId: number) {
  try {
    const response = await httpClient.get<ApiResponse<CvAnalysisResponse>>(`/students/me/cv/${cvId}/analysis`);
    return response.data.data?.status ?? "NOT_READY";
  } catch {
    return "NOT_READY";
  }
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
