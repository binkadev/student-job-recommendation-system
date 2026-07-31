import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../services/api/httpClient";
import { useAuth } from "./useAuth";
import { readStorage } from "../utils/localStorage";
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

const savedJobsChangedEvent = "candidate-saved-jobs-changed";

export function useSavedJobs() {
  const { currentUser } = useAuth();
  const storageKey = useMemo(() => `saved-job-ids:${currentUser?.id ?? "anonymous"}`, [currentUser?.id]);
  const [savedJobIds, setSavedJobIds] = useLocalStorageState<string[]>(storageKey, []);
  const [syncing, setSyncing] = useState(false);

  const savedSet = useMemo(() => new Set(savedJobIds), [savedJobIds]);

  const refreshSavedJobs = useCallback(async () => {
    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
      setSavedJobIds([]);
      return;
    }
    setSyncing(true);
    try {
      const data = await getAllSavedJobs();
      const activeIds = data
        .filter((item) => !item.status || item.status === "ACTIVE")
        .map((item) => String(item.jobId));
      setSavedJobIds(activeIds);
    } catch {
      setSavedJobIds([]);
    } finally {
      setSyncing(false);
    }
  }, [setSavedJobIds]);

  useEffect(() => {
    setSavedJobIds(readStorage(storageKey, []));
    void refreshSavedJobs();
  }, [refreshSavedJobs, setSavedJobIds, storageKey]);

  useEffect(() => {
    function syncSavedJobs(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string; saved?: boolean }>).detail;
      if (!detail?.jobId || typeof detail.saved !== "boolean") return;
      setSavedJobIds((current) => {
        if (detail.saved) return current.includes(detail.jobId!) ? current : [...current, detail.jobId!];
        return current.filter((id) => id !== detail.jobId);
      });
    }

    window.addEventListener(savedJobsChangedEvent, syncSavedJobs);
    return () => window.removeEventListener(savedJobsChangedEvent, syncSavedJobs);
  }, [setSavedJobIds]);

  async function toggleSavedJob(jobId: string) {
    const currentlySaved = savedSet.has(jobId);
    const nextSaved = !currentlySaved;
    setSavedJobIds((current) => (currentlySaved ? current.filter((id) => id !== jobId) : Array.from(new Set([...current, jobId]))));
    window.dispatchEvent(new CustomEvent(savedJobsChangedEvent, { detail: { jobId, saved: nextSaved } }));

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

async function getAllSavedJobs(page = 1, items: SavedJobResponse[] = []): Promise<SavedJobResponse[]> {
  const response = await httpClient.get<ApiResponse<PageResponse<SavedJobResponse>>>("/students/me/saved-jobs", {
    params: { page, size: 100 },
  });
  const data = response.data.data;
  const nextItems = [...items, ...data.items];
  if (data.page < data.totalPages) return getAllSavedJobs(page + 1, nextItems);
  return nextItems;
}
