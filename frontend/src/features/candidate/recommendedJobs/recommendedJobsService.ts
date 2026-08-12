import { httpClient } from "../../../services/api/httpClient";
import { getCurrentUserStorageScope } from "../../../utils/authStorageScope";
import { getPublicJobDetail } from "../../public/jobs/jobDetailService";
import {
  getScorePresentation,
  normalizeRankingTier,
  normalizeScoringStrategy,
  toLegacyNormalizedScore,
  toNormalizedScore,
  type RankingScoreFields,
} from "../../shared/ranking/rankingScoreTypes";
import type { CandidateCvOption, CandidateRecommendedJob, GenerateRecommendationPayload, RecommendationRun } from "./recommendedJobsTypes";

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
  rankingTier?: string | null;
  tierRankPosition?: number | string | null;
  rankingScore?: number | string | null;
  overallScore?: number | string | null;
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

export interface CvAnalysisResponse {
  status?: string | null;
  extractedText?: string | null;
  processedText?: string | null;
  languageCode?: string | null;
  languageConfidence?: number | string | null;
  processingVersion?: string | null;
  analysisError?: string | null;
}

const CURRENT_PROCESSING_VERSION = "bilingual-nlp-v2-skills-v1";

const recommendedJobStateStoragePrefix = "candidate-recommended-job-state";

export function getRecommendedJobState() {
  return readRecommendedJobState();
}

export function saveRecommendedJobState(hiddenIds: string[], notInterestedIds: string[]) {
  writeRecommendedJobState({
    hiddenIds: Array.from(new Set(hiddenIds)),
    notInterestedIds: Array.from(new Set(notInterestedIds)),
  });
}

const jobDetailCache = new Map<string, ReturnType<typeof getPublicJobDetail>>();

export async function getRecommendedJobs() {
  const response = await httpClient.get<ApiResponse<RecommendationResultResponse[]>>("/students/me/recommendation-results/latest");
  const items = response.data.data ?? [];
  return Promise.all(items.map(mapRecommendationResult));
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
    sourceType: run.sourceType ?? "Chưa cập nhật",
    algorithm: run.algorithm ?? "Chưa cập nhật",
    algorithmVersion: run.algorithmVersion ?? "Chưa cập nhật",
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
    const analysis = await getCvAnalysisSummary(cv.id);
    return {
      id: String(cv.id),
      name: cv.originalFileName || cv.fileName || `CV #${cv.id}`,
      active: Boolean(cv.isActive ?? cv.active),
      analysisStatus: analysis.status,
      ready: analysis.ready,
      readinessReason: analysis.reason,
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
  const reason = result.reason || result.explanation || "";
  const scoreFields = mapRecommendationScoreFields(result);
  const presentation = getScorePresentation(scoreFields);
  const jobTitle = result.jobTitle || `Công việc #${result.jobId}`;
  const detail = await getCachedPublicJobDetail(String(result.jobId)).catch(() => null);
  const job = detail?.job;
  const scoringStrategyLabel = getScoringStrategyLabel(scoreFields.scoringStrategy);
  const recommendationReasons = buildRecommendationReasons({
    rankingTier: scoreFields.rankingTier,
    matchedSkills,
    missingSkills,
    jobSkills: job?.skills ?? [],
    textScore: scoreFields.textScore,
    skillScore: scoreFields.skillScore,
    rawReason: reason,
  });

  return {
    id: String(result.jobId),
    logo: job?.logo ?? getInitials(result.companyName),
    title: job?.title ?? jobTitle,
    companyId: job?.companyId,
    companyName: job?.companyName ?? result.companyName ?? "Chưa cập nhật",
    salary: job?.salary ?? "Chưa cập nhật",
    salaryMax: job?.salaryMax ?? 0,
    location: job?.location ?? "Chưa cập nhật",
    industry: job?.industry ?? jobTitle,
    experienceYears: job?.experienceYears ?? null,
    experienceLabel: job?.experienceLabel ?? null,
    level: job?.level ?? null,
    jobType: job?.jobType ?? "Chưa cập nhật",
    workMode: job?.workMode ?? "Chưa cập nhật",
    skills: job?.skills?.length ? job.skills : matchedSkills,
    postedAt: job?.postedAt ?? formatDate(result.createdAt),
    deadline: job?.deadline ?? "Chưa cập nhật",
    applicants: job?.applicants ?? 0,
    status: job?.status ?? "unavailable",
    rankPosition: toInteger(result.rankPosition) ?? scoreFields.tierRankPosition,
    ...scoreFields,
    displayScoreLabel: presentation.label,
    displayTierLabel: presentation.tierLabel,
    displayScore: presentation.value,
    scoringStrategyLabel,
    matchedSkills,
    missingSkills,
    recommendationReasons,
  };
}

export function mapRecommendationScoreFields(result: RecommendationResultResponse): RankingScoreFields {
  const tier = normalizeRankingTier(result.rankingTier);
  const strategy = normalizeScoringStrategy(result.scoringStrategy);
  const tierRankPosition = toInteger(result.tierRankPosition);

  if (tier && strategy && tierRankPosition) {
    const rankingScore = toNormalizedScore(result.rankingScore);
    const overallScore = toNormalizedScore(result.overallScore);
    const textScore = toNormalizedScore(result.textScore);
    const skillScore = toNormalizedScore(result.skillScore);
    const validPrimary = tier === "PRIMARY" && strategy === "SAME_LANGUAGE_HYBRID" && rankingScore != null && overallScore != null && textScore != null && skillScore != null;
    const validFallback = tier === "FALLBACK" && strategy === "CROSS_LANGUAGE_SKILL_BASED" && rankingScore != null && result.overallScore == null && result.textScore == null && skillScore != null;

    if (validPrimary || validFallback) {
      return {
        rankingTier: tier,
        tierRankPosition,
        rankingScore,
        overallScore: tier === "PRIMARY" ? overallScore : null,
        textScore: tier === "PRIMARY" ? textScore : null,
        skillScore,
        scoringStrategy: strategy,
        legacyResult: false,
      };
    }

    console.warn("Invalid recommendation V3 score contract", result);
    return {
      rankingTier: tier,
      tierRankPosition,
      rankingScore: rankingScore ?? 0,
      overallScore: tier === "PRIMARY" ? overallScore : null,
      textScore: tier === "PRIMARY" ? textScore : null,
      skillScore: skillScore ?? 0,
      scoringStrategy: strategy,
      legacyResult: false,
      invalidScoreContract: true,
    };
  }

  const legacyScore = toLegacyNormalizedScore(result.score) ?? toLegacyNormalizedScore(result.rankingScore) ?? toLegacyNormalizedScore(result.skillScore) ?? 0;
  return {
    rankingTier: null,
    tierRankPosition: null,
    rankingScore: legacyScore,
    overallScore: null,
    textScore: null,
    skillScore: toLegacyNormalizedScore(result.skillScore) ?? 0,
    scoringStrategy: strategy,
    legacyResult: true,
  };
}

function getScoringStrategyLabel(strategy: RankingScoreFields["scoringStrategy"]) {
  const normalizedStrategy = strategy;
  if (normalizedStrategy === "CROSS_LANGUAGE_SKILL_BASED") {
    return "Đối sánh kỹ năng khác ngôn ngữ";
  }
  if (normalizedStrategy === "SAME_LANGUAGE_HYBRID") return "Hybrid cùng ngôn ngữ";
  return normalizedStrategy ? normalizedStrategy : "Chưa cập nhật";
}

function buildRecommendationReasons({
  rankingTier,
  matchedSkills,
  missingSkills,
  jobSkills,
  textScore,
  skillScore,
  rawReason,
}: {
  rankingTier: RankingScoreFields["rankingTier"];
  matchedSkills: string[];
  missingSkills: string[];
  jobSkills: string[];
  textScore: number | null;
  skillScore: number | null;
  rawReason: string;
}) {
  const normalizedJobSkills = Array.from(new Set(jobSkills.map((skill) => skill.trim()).filter(Boolean)));
  const normalizedMatchedSkills = Array.from(new Set(matchedSkills.map((skill) => skill.trim()).filter(Boolean)));
  const normalizedMissingSkills = Array.from(new Set(missingSkills.map((skill) => skill.trim()).filter(Boolean)));
  const totalSkills = normalizedJobSkills.length || normalizedMatchedSkills.length + normalizedMissingSkills.length;
  const matchedCount = Math.min(normalizedMatchedSkills.length, totalSkills);
  const reasons: string[] = [];

  if (totalSkills > 0) {
    reasons.push(`Phù hợp ${matchedCount}/${totalSkills} kỹ năng${normalizedMatchedSkills.length ? `: ${normalizedMatchedSkills.join(", ")}.` : "."}`);
  }

  if (normalizedMissingSkills.length) {
    reasons.push(`Còn thiếu ${normalizedMissingSkills.length} kỹ năng: ${normalizedMissingSkills.join(", ")}.`);
  } else {
    reasons.push("Không thiếu kỹ năng bắt buộc.");
  }

  const reasonLower = rawReason.toLowerCase();
  if (rankingTier === "FALLBACK" || textScore == null || reasonLower.includes("text similarity was not used")) {
    reasons.push("Không dùng điểm văn bản vì CV và việc làm khác ngôn ngữ hoặc không đủ an toàn để so sánh cùng ngôn ngữ.");
  } else {
    reasons.push(`Độ tương đồng nội dung: ${Math.round(textScore * 100)}%.`);
  }

  if (rankingTier === "FALLBACK") {
    reasons.push("Skill Match chỉ thể hiện mức độ đáp ứng các kỹ năng đã khai báo của vị trí, không phải độ phù hợp tổng thể của CV với công việc.");
  }

  if (skillScore != null) {
    reasons.push(`Mức phủ kỹ năng: ${Math.round(skillScore * 100)}%.`);
  }

  return reasons;
}

export function getCvReadiness(analysis: CvAnalysisResponse | null | undefined): { status: string; ready: boolean; reason: string | null } {
  const status = analysis?.status ?? "NOT_READY";
  if (status !== "READY") return { status, ready: false, reason: analysis?.analysisError || getCvReadinessReason(status) };
  if (!analysis?.processedText?.trim()) return { status, ready: false, reason: "CV chưa có dữ liệu xử lý." };
  if (!analysis.languageCode?.trim() || !isValidLanguageConfidence(analysis.languageConfidence)) return { status, ready: false, reason: "CV chưa có metadata ngôn ngữ hợp lệ." };
  if (analysis.processingVersion !== CURRENT_PROCESSING_VERSION) return { status, ready: false, reason: "CV cần được phân tích lại bằng phiên bản xử lý hiện tại." };
  return { status, ready: true, reason: null };
}

export async function getCvAnalysisSummary(cvId: number): Promise<{ status: string; ready: boolean; reason: string | null }> {
  try {
    const response = await httpClient.get<ApiResponse<CvAnalysisResponse>>(`/students/me/cv/${cvId}/analysis`);
    const analysis = response.data.data;
    return getCvReadiness(analysis);
  } catch (error) {
    return { status: "ERROR", ready: false, reason: getCvAnalysisErrorReason(error) };
  }
}

function isValidLanguageConfidence(value: number | string | null | undefined) {
  const confidence = Number(value);
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
}

function normalizeStringArray(value?: string[] | null) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function toInteger(value?: number | string | null) {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) return null;
  return numberValue;
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
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

function getCachedPublicJobDetail(jobId: string) {
  const cached = jobDetailCache.get(jobId);
  if (cached) return cached;
  const request = getPublicJobDetail(jobId);
  jobDetailCache.set(jobId, request);
  return request;
}

function readRecommendedJobState() {
  try {
    const raw = window.localStorage.getItem(getRecommendedJobStateStorageKey());
    if (!raw) return { hiddenIds: [], notInterestedIds: [] };
    const parsed = JSON.parse(raw) as { hiddenIds?: unknown; notInterestedIds?: unknown };
    return {
      hiddenIds: normalizeStorageIds(parsed.hiddenIds),
      notInterestedIds: normalizeStorageIds(parsed.notInterestedIds),
    };
  } catch {
    return { hiddenIds: [], notInterestedIds: [] };
  }
}

function writeRecommendedJobState(state: { hiddenIds: string[]; notInterestedIds: string[] }) {
  window.localStorage.setItem(getRecommendedJobStateStorageKey(), JSON.stringify(state));
}

function normalizeStorageIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function getRecommendedJobStateStorageKey() {
  return `${recommendedJobStateStoragePrefix}:${getCurrentUserStorageScope()}`;
}

function getCvReadinessReason(status: string) {
  if (status === "FAILED") return "Phân tích CV thất bại.";
  if (status === "PROCESSING") return "CV đang được phân tích.";
  return "CV chưa sẵn sàng.";
}

function getCvAnalysisErrorReason(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 403) return "Không có quyền xem phân tích CV.";
    if (status === 404) return "Chưa có dữ liệu phân tích CV.";
  }
  return "Không thể tải dữ liệu phân tích CV.";
}
