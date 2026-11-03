import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const pendingJobs = useRef(new Map<string, Promise<void>>());

  const savedSet = useMemo(() => new Set(savedJobIds), [savedJobIds]);

  const refreshSavedJobs = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || currentUser?.role !== "candidate") {
      setSavedJobIds([]);
      setSyncError(null);
      setSyncing(false);
      return;
    }
    setSyncing(true);
    try {
      const data = await getAllSavedJobs();
      const activeIds = data
        .filter((item) => !item.status || item.status === "ACTIVE")
        .map((item) => String(item.jobId));
      if (version !== requestVersion.current) return;
      setSavedJobIds(activeIds);
      setSyncError(null);
    } catch {
      if (version === requestVersion.current) setSyncError("Chưa đồng bộ được việc làm đã lưu. Dữ liệu đã xác nhận được giữ lại; hãy thử tải lại.");
    } finally {
      if (version === requestVersion.current) setSyncing(false);
    }
  }, [currentUser?.role, setSavedJobIds]);

  useEffect(() => {
    const requests = requestVersion;
    setSavedJobIds(readStorage(storageKey, []));
    void refreshSavedJobs();
    return () => { requests.current++; };
  }, [refreshSavedJobs, setSavedJobIds, storageKey]);

  useEffect(() => {
    function syncSavedJobs(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string; saved?: boolean }>).detail;
      if (!detail?.jobId || typeof detail.saved !== "boolean") return;
      requestVersion.current++;
      setSyncing(false);
      setSavedJobIds((current) => {
        if (detail.saved) return current.includes(detail.jobId!) ? current : [...current, detail.jobId!];
        return current.filter((id) => id !== detail.jobId);
      });
    }

    window.addEventListener(savedJobsChangedEvent, syncSavedJobs);
    return () => window.removeEventListener(savedJobsChangedEvent, syncSavedJobs);
  }, [setSavedJobIds]);

  function toggleSavedJob(jobId: string) {
    const pendingKey = `${currentUser?.id ?? "anonymous"}:${jobId}`;
    const pending = pendingJobs.current.get(pendingKey);
    if (pending) return pending;
    const tokenAtStart = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const currentlySaved = savedSet.has(jobId);
    const nextSaved = !currentlySaved;
    const operation = (async () => {
      try {
        if (window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
          if (currentlySaved) {
            await httpClient.delete<ApiResponse<null>>(`/students/me/saved-jobs/${jobId}`);
          } else {
            await httpClient.post<ApiResponse<SavedJobResponse>>(`/students/me/saved-jobs/${jobId}`);
          }
        }
        if (tokenAtStart !== window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) return;
        // Publish only a confirmed mutation; a failed refresh must never erase it.
        setSavedJobIds((current) => (currentlySaved ? current.filter((id) => id !== jobId) : Array.from(new Set([...current, jobId]))));
        setSyncError(null);
        window.dispatchEvent(new CustomEvent(savedJobsChangedEvent, { detail: { jobId, saved: nextSaved } }));
      } catch (error) {
        setSyncError("Không thể cập nhật việc làm đã lưu. Trạng thái trước đó được giữ lại; hãy thử lại khi có kết nối.");
        throw error;
      }
    })();
    const settled = operation.finally(() => { pendingJobs.current.delete(pendingKey); });
    pendingJobs.current.set(pendingKey, settled);
    return settled;
  }

  return {
    savedJobIds,
    syncing,
    syncError,
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
