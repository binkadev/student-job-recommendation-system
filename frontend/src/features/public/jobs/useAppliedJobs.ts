import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "../../../hooks/useLocalStorageState";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../../services/api/httpClient";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface ApplicationResponse {
  jobId: number;
}

export function useAppliedJobs() {
  const [appliedJobIds, setAppliedJobIds] = useLocalStorageState<string[]>("applied-job-ids", []);
  const [syncing, setSyncing] = useState(false);
  const appliedSet = useMemo(() => new Set(appliedJobIds), [appliedJobIds]);

  const refreshAppliedJobs = useCallback(async () => {
    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;
    setSyncing(true);
    try {
      const response = await httpClient.get<ApiResponse<ApplicationResponse[]>>("/students/me/applications");
      setAppliedJobIds(response.data.data.map((application) => String(application.jobId)));
    } finally {
      setSyncing(false);
    }
  }, [setAppliedJobIds]);

  useEffect(() => {
    void refreshAppliedJobs();
  }, [refreshAppliedJobs]);

  function applyToJob(jobId: string) {
    setAppliedJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]));
  }

  return {
    appliedJobIds,
    syncing,
    hasApplied: (jobId: string) => appliedSet.has(jobId),
    applyToJob,
    refreshAppliedJobs,
  };
}
