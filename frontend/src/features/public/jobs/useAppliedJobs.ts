import { useLocalStorageState } from "../../../hooks/useLocalStorageState";

export function useAppliedJobs() {
  const [appliedJobIds, setAppliedJobIds] = useLocalStorageState<string[]>("applied-job-ids", []);

  function applyToJob(jobId: string) {
    setAppliedJobIds((current) => (current.includes(jobId) ? current : [...current, jobId]));
  }

  return {
    appliedJobIds,
    hasApplied: (jobId: string) => appliedJobIds.includes(jobId),
    applyToJob,
  };
}
