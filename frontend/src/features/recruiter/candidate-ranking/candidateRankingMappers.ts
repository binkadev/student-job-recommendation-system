import type {
  CandidateRankingApplicationStatus,
  CandidateRankingJob,
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

export interface ApplicationResponse {
  id: number;
  status: string;
  studentId: number;
  studentName: string | null;
  studentEmail: string | null;
  jobId: number;
  jobTitle: string;
  cvFileId: number | null;
  cvFileName: string | null;
  appliedAt: string;
  reviewedAt: string | null;
}

export interface SavedCandidateResponse {
  id: number;
  applicationId: number;
  studentId: number;
}

export function buildApplicationRankingDetail(
  jobId: string,
  applications: ApplicationResponse[],
  savedCandidates: SavedCandidateResponse[],
): CandidateRankingRunDetail {
  const savedApplicationIds = new Set(savedCandidates.map((candidate) => String(candidate.applicationId)));
  const eligibleCandidates = applications.filter((application) => Boolean(application.cvFileId)).length;

  return {
    run: {
      id: "",
      jobId,
      jobTitle: applications[0]?.jobTitle ?? "Chưa cập nhật",
      status: "SUCCESS",
      algorithm: "application-list",
      algorithmVersion: "Danh sách ứng viên đã ứng tuyển",
      startedAt: "Chưa có API xếp hạng",
      finishedAt: "Chưa có API xếp hạng",
      errorMessage: null,
      totalApplications: applications.length,
      eligibleCandidates,
      skippedNoCv: applications.length - eligibleCandidates,
      skippedNotReady: 0,
      skippedTerminalStatus: applications.filter((application) => isTerminalStatus(application.status)).length,
      resultCount: applications.length,
    },
    results: applications.map((application, index) => ({
      id: String(application.id),
      applicationId: String(application.id),
      studentId: String(application.studentId),
      studentName: application.studentName || "Chưa cập nhật",
      studentEmail: application.studentEmail || "Chưa cập nhật",
      cvFileId: application.cvFileId == null ? null : String(application.cvFileId),
      cvFileName: application.cvFileName,
      rankPosition: index + 1,
      score: null,
      textScore: null,
      skillScore: null,
      scoringStrategy: null,
      matchedSkills: [],
      missingSkills: [],
      reason: "Backend hiện có API danh sách ứng viên theo tin tuyển dụng. API xếp hạng AI cho recruiter chưa có controller REST để FE gọi.",
      applicationStatus: mapApplicationStatus(application.status),
      saved: savedApplicationIds.has(String(application.id)),
    })),
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
  if (!value) return "Không thể tải dữ liệu ứng viên. Vui lòng thử lại sau.";
  return value.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "[token]").slice(0, 300);
}

export function mapRunStatus(status?: string | null): CandidateRankingRunStatus {
  if (status === "PENDING" || status === "PROCESSING" || status === "SUCCESS" || status === "FAILED") return status;
  return "UNKNOWN";
}

function mapApplicationStatus(status?: string | null): CandidateRankingApplicationStatus | "UNKNOWN" {
  if (status === "PENDING" || status === "REVIEWED" || status === "ACCEPTED" || status === "REJECTED" || status === "WITHDRAWN") return status;
  return "UNKNOWN";
}

function isTerminalStatus(status?: string | null) {
  return status === "ACCEPTED" || status === "REJECTED" || status === "WITHDRAWN";
}
