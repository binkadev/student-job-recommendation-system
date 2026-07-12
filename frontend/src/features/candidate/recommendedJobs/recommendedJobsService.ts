import { getStorageItem, setStorageItem } from "../../../utils/localStorage";
import { withMockDelay } from "../../../utils/mockDelay";
import { recommendedJobs } from "./recommendedJobsMockData";
import type { CandidateRecommendedJob, RecommendedJobFilters } from "./recommendedJobsTypes";

const HIDDEN_KEY = "candidate-hidden-recommended-jobs";
const NOT_INTERESTED_KEY = "candidate-not-interested-jobs";

export function getRecommendedJobState() {
  return {
    hiddenIds: getStorageItem<string[]>(HIDDEN_KEY, []),
    notInterestedIds: getStorageItem<string[]>(NOT_INTERESTED_KEY, []),
  };
}

export function saveRecommendedJobState(hiddenIds: string[], notInterestedIds: string[]) {
  setStorageItem(HIDDEN_KEY, hiddenIds);
  setStorageItem(NOT_INTERESTED_KEY, notInterestedIds);
}

export function getRecommendedJobs(filters: RecommendedJobFilters, hiddenIds: string[]) {
  const filtered = recommendedJobs.filter((job) => {
    const matchHidden = !hiddenIds.includes(job.id);
    const matchScore = job.matchScore >= filters.minMatch;
    const matchLocation = !filters.location || job.location === filters.location;
    const matchIndustry = !filters.industry || job.industry === filters.industry;
    const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
    const matchExperience = !filters.experience || job.experienceLabel.includes(filters.experience);
    const matchSalary = !filters.salary || job.salaryMax >= Number(filters.salary);
    return matchHidden && matchScore && matchLocation && matchIndustry && matchWorkMode && matchExperience && matchSalary;
  });
  return withMockDelay(filtered.sort((a, b) => b.matchScore - a.matchScore));
}

export function getRecommendedFilterOptions(jobs: CandidateRecommendedJob[]) {
  return {
    locations: Array.from(new Set(jobs.map((job) => job.location))),
    industries: Array.from(new Set(jobs.map((job) => job.industry))),
    workModes: Array.from(new Set(jobs.map((job) => job.workMode))),
  };
}

export { recommendedJobs };
