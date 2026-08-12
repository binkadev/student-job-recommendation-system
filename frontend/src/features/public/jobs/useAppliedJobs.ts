import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../../services/api/httpClient";

export type JobApplicationState = "NEVER_APPLIED" | "ACTIVE" | "REJECTED_CAN_REAPPLY" | "WITHDRAWN_BLOCKED";

export interface StudentApplication {
  id: number;
  jobId: number;
  status: "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | string;
  appliedAt?: string | null;
  updatedAt?: string | null;
  reviewedAt?: string | null;
  cvFileId?: number | null;
  cvFileName?: string | null;
  coverLetter?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const appliedJobsChangedEvent = "candidate-applied-jobs-changed";

export function getLatestApplication(applications: StudentApplication[], jobId: string): StudentApplication | null {
  return applications
    .filter((application) => String(application.jobId) === jobId)
    .sort((left, right) => {
      const dateDifference = new Date(right.appliedAt ?? 0).getTime() - new Date(left.appliedAt ?? 0).getTime();
      return dateDifference || right.id - left.id;
    })[0] ?? null;
}

export function getApplicationStateForJob(applications: StudentApplication[], jobId: string): JobApplicationState {
  const latest = getLatestApplication(applications, jobId);
  if (!latest) return "NEVER_APPLIED";
  if (latest.status === "REJECTED") return "REJECTED_CAN_REAPPLY";
  if (latest.status === "WITHDRAWN") return "WITHDRAWN_BLOCKED";
  return "ACTIVE";
}

export function canApplyForJob(state: JobApplicationState) {
  return state === "NEVER_APPLIED" || state === "REJECTED_CAN_REAPPLY";
}

export function getApplyButtonLabelForState(state: JobApplicationState) {
  if (state === "REJECTED_CAN_REAPPLY") return "Ứng tuyển lại";
  if (state === "ACTIVE") return "Đã ứng tuyển";
  if (state === "WITHDRAWN_BLOCKED") return "Không thể ứng tuyển";
  return "Ứng tuyển";
}

export function useAppliedJobs() {
  const { currentUser } = useAuth();
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshAppliedJobs = useCallback(async () => {
    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
      setApplications([]);
      return;
    }
    setSyncing(true);
    try {
      const response = await httpClient.get<ApiResponse<StudentApplication[]>>("/students/me/applications");
      setApplications(response.data.data ?? []);
    } catch {
      setApplications([]);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refreshAppliedJobs();
  }, [currentUser?.id, refreshAppliedJobs]);

  useEffect(() => {
    function syncApplications(event: Event) {
      const detail = (event as CustomEvent<{ application?: StudentApplication }>).detail;
      if (!detail?.application) return;
      setApplications((current) => [detail.application!, ...current.filter((item) => item.id !== detail.application!.id)]);
    }

    window.addEventListener(appliedJobsChangedEvent, syncApplications);
    return () => window.removeEventListener(appliedJobsChangedEvent, syncApplications);
  }, []);

  const statesByJob = useMemo(() => {
    const jobIds = new Set(applications.map((application) => String(application.jobId)));
    return new Map(Array.from(jobIds, (jobId) => [jobId, getApplicationStateForJob(applications, jobId)]));
  }, [applications]);

  function applyToJob(application: StudentApplication) {
    setApplications((current) => [application, ...current.filter((item) => item.id !== application.id)]);
    window.dispatchEvent(new CustomEvent(appliedJobsChangedEvent, { detail: { application } }));
  }

  function getApplicationState(jobId: string) {
    return statesByJob.get(jobId) ?? "NEVER_APPLIED";
  }

  return {
    applications,
    syncing,
    getApplicationState,
    canApply: (jobId: string) => canApplyForJob(getApplicationState(jobId)),
    getApplyButtonLabel: (jobId: string) => getApplyButtonLabelForState(getApplicationState(jobId)),
    hasApplied: (jobId: string) => !canApplyForJob(getApplicationState(jobId)),
    applyToJob,
    refreshAppliedJobs,
  };
}
