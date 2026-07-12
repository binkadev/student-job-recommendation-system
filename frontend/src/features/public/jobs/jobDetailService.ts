import { withMockDelay } from "../../../utils/mockDelay";
import { publicJobs } from "./jobsListMockData";
import { publicJobDetails } from "./jobDetailMockData";
import type { JobDetailResult, PublicJobDetail } from "./jobDetailTypes";

export function getPublicJobDetail(jobId: string): Promise<JobDetailResult | null> {
  const job = publicJobDetails.find((item) => item.id === jobId);
  if (!job) return withMockDelay(null);

  return withMockDelay({
    job,
    similarJobs: getSimilarJobs(job),
  });
}

function getSimilarJobs(job: PublicJobDetail) {
  return publicJobs
    .filter((item) => item.id !== job.id)
    .map((item) => ({
      item,
      score: Number(item.industry === job.industry) * 4 + Number(item.location === job.location) * 2 + item.skills.filter((skill) => job.skills.includes(skill)).length * 3,
    }))
    .sort((a, b) => b.score - a.score || b.item.matchScore - a.item.matchScore)
    .slice(0, 4)
    .map(({ item }) => item);
}
