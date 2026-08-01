import { httpClient } from "../../../services/api/httpClient";
import {
  buildApplicationRankingDetail,
  mapRankingJob,
  type ApplicationResponse,
  type JobDetailResponse,
  type PageResponse,
  type SavedCandidateResponse,
} from "./candidateRankingMappers";
import type { CandidateRankingJob, CandidateRankingRunDetail } from "./candidateRankingTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

export async function getCandidateRankingJob(jobId: string): Promise<CandidateRankingJob> {
  const response = await httpClient.get<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`);
  return mapRankingJob(response.data.data);
}

export async function getCandidateRankingApplications(jobId: string): Promise<CandidateRankingRunDetail> {
  const [applicationsResponse, savedCandidatesResponse] = await Promise.all([
    httpClient.get<ApiResponse<PageResponse<ApplicationResponse>>>(`/companies/me/jobs/${jobId}/applications`, {
      params: { page: 1, size: 100, sort: "appliedAt,desc" },
    }),
    httpClient.get<ApiResponse<PageResponse<SavedCandidateResponse>>>("/companies/me/saved-candidates", {
      params: { page: 1, size: 200 },
    }),
  ]);

  return buildApplicationRankingDetail(
    jobId,
    applicationsResponse.data.data?.items ?? [],
    savedCandidatesResponse.data.data?.items ?? [],
  );
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
