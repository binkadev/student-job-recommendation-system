import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "../../../hooks/useLocalStorageState";
import { useAuth } from "../../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../../services/api/httpClient";
import { readStorage } from "../../../utils/localStorage";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ApplicationResponse {
  jobId: number;
}

const appliedJobsChangedEvent = "candidate-applied-jobs-changed";

export function useAppliedJobs() {
  const { currentUser } = useAuth();
  const storageKey = useMemo(() => `applied-job-ids:${currentUser?.id ?? "anonymous"}`, [currentUser?.id]);
  const [appliedJobIds, setAppliedJobIds] = useLocalStorageState<string[]>(storageKey, []);
  const [syncing, setSyncing] = useState(false);
  const appliedSet = useMemo(() => new Set(appliedJobIds), [appliedJobIds]);

  const refreshAppliedJobs = useCallback(async () => {
    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
      setAppliedJobIds([]);
      return;
    }
    setSyncing(true);
    try {
      const response = await httpClient.get<ApiResponse<ApplicationResponse[]>>("/students/me/applications");
      setAppliedJobIds(response.data.data.map((application) => String(application.jobId)));
    } catch {
      setAppliedJobIds([]);
    } finally {
      setSyncing(false);
    }
  }, [setAppliedJobIds]);

  useEffect(() => {
    setAppliedJobIds(readStorage(storageKey, []));
    void refreshAppliedJobs();
  }, [refreshAppliedJobs, setAppliedJobIds, storageKey]);

  useEffect(() => {
    function syncAppliedJobs(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string }>).detail;
      if (!detail?.jobId) return;
      setAppliedJobIds((current) => (current.includes(detail.jobId!) ? current : [...current, detail.jobId!]));
    }

    window.addEventListener(appliedJobsChangedEvent, syncAppliedJobs);
    return () => window.removeEventListener(appliedJobsChangedEvent, syncAppliedJobs);
  }, [setAppliedJobIds]);

  function applyToJob(jobId: string) {
    setAppliedJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]));
    window.dispatchEvent(new CustomEvent(appliedJobsChangedEvent, { detail: { jobId } }));
  }

  return {
    appliedJobIds,
    syncing,
    hasApplied: (jobId: string) => appliedSet.has(jobId),
    applyToJob,
    refreshAppliedJobs,
  };
}
