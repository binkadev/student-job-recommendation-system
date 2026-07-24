import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../services/api/httpClient";
import { useLocalStorageState } from "./useLocalStorageState";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface SavedJobResponse {
  jobId: number;
  status?: string | null;
}

export function useSavedJobs() {
  const [savedJobIds, setSavedJobIds] = useLocalStorageState<string[]>("saved-job-ids", []);
  const [syncing, setSyncing] = useState(false);

  const savedSet = useMemo(() => new Set(savedJobIds), [savedJobIds]);

  const refreshSavedJobs = useCallback(async () => {
    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;
    setSyncing(true);
    try {
      const response = await httpClient.get<ApiResponse<PageResponse<SavedJobResponse>>>("/students/me/saved-jobs", {
        params: { page: 1, size: 200 },
      });
      const activeIds = response.data.data.items
        .filter((item) => !item.status || item.status === "ACTIVE")
        .map((item) => String(item.jobId));
      setSavedJobIds(activeIds);
    } finally {
      setSyncing(false);
    }
  }, [setSavedJobIds]);

  useEffect(() => {
    void refreshSavedJobs();
  }, [refreshSavedJobs]);

  async function toggleSavedJob(jobId: string) {
    const currentlySaved = savedSet.has(jobId);
    setSavedJobIds((current) => (currentlySaved ? current.filter((id) => id !== jobId) : Array.from(new Set([...current, jobId]))));

    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;

    try {
      if (currentlySaved) {
        await httpClient.delete<ApiResponse<null>>(`/students/me/saved-jobs/${jobId}`);
      } else {
        await httpClient.post<ApiResponse<SavedJobResponse>>(`/students/me/saved-jobs/${jobId}`);
      }
      await refreshSavedJobs();
    } catch (error) {
      await refreshSavedJobs();
      throw error;
    }
  }

  return {
    savedJobIds,
    syncing,
    isSaved: (jobId: string) => savedSet.has(jobId),
    toggleSavedJob,
    refreshSavedJobs,
  };
}
