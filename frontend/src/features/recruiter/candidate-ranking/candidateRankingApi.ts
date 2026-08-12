import { httpClient } from "../../../services/api/httpClient";
import {
  mapRankingJob,
  mapRankingRun,
  mapRankingRunDetail,
  type CandidateRankingRunDetailResponse,
  type CandidateRankingRunResponse,
  type JobDetailResponse,
  type PageResponse,
} from "./candidateRankingMappers";
import type { CandidateRankingJob, CandidateRankingRunDetail } from "./candidateRankingTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

export interface CreateRankingRunPayload {
  threshold: number;
  primaryLimit: number;
  fallbackLimit: number;
}

export async function getCandidateRankingJob(jobId: string): Promise<CandidateRankingJob> {
  const response = await httpClient.get<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`);
  return mapRankingJob(response.data.data);
}

export async function createCandidateRankingRun(jobId: string, payload: CreateRankingRunPayload): Promise<CandidateRankingRunDetail> {
  const response = await httpClient.post<ApiResponse<CandidateRankingRunDetailResponse>>(`/companies/me/jobs/${jobId}/candidate-ranking-runs`, {
    threshold: payload.threshold,
    primaryLimit: payload.primaryLimit,
    fallbackLimit: payload.fallbackLimit,
  });
  return mapRankingRunDetail(response.data.data);
}

export async function getCandidateRankingRuns(jobId: string) {
  const response = await httpClient.get<ApiResponse<PageResponse<CandidateRankingRunResponse>>>(`/companies/me/jobs/${jobId}/candidate-ranking-runs`, {
    params: { page: 1, size: 20 },
  });
  return (response.data.data?.items ?? []).map(mapRankingRun);
}

export async function getCandidateRankingRun(jobId: string, runId: string): Promise<CandidateRankingRunDetail> {
  const response = await httpClient.get<ApiResponse<CandidateRankingRunDetailResponse>>(`/companies/me/jobs/${jobId}/candidate-ranking-runs/${runId}`);
  return mapRankingRunDetail(response.data.data);
}

export async function openCandidateRankingCv(applicationId: string) {
  const response = await httpClient.get<Blob>(`/companies/me/applications/${applicationId}/cv/file`, { responseType: "blob" });
  const blobUrl = window.URL.createObjectURL(response.data);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

export async function saveRankingCandidate(applicationId: string) {
  await httpClient.post<ApiResponse<unknown>>("/companies/me/saved-candidates", {
    applicationId: Number(applicationId),
    note: null,
  });
}

export async function updateRankingApplicationStatus(applicationId: string, status: string) {
  await httpClient.patch<ApiResponse<unknown>>(`/applications/${applicationId}/status`, { status });
}
