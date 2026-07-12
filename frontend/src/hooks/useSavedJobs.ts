import { useMemo } from "react";
import { useLocalStorageState } from "./useLocalStorageState";

export function useSavedJobs() {
  const [savedJobIds, setSavedJobIds] = useLocalStorageState<string[]>("saved-job-ids", ["1", "2", "6", "7", "12", "18"]);

  const savedSet = useMemo(() => new Set(savedJobIds), [savedJobIds]);

  function toggleSavedJob(jobId: string) {
    setSavedJobIds((current) => (current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]));
  }

  return {
    savedJobIds,
    isSaved: (jobId: string) => savedSet.has(jobId),
    toggleSavedJob,
  };
}
