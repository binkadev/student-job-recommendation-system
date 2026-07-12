import { withMockDelay } from "../../../utils/mockDelay";
import { publicJobs } from "./jobsListMockData";
import type { JobsFilterOptions, JobsListFilters, JobsListResult, PublicJobListItem } from "./jobsListTypes";

const pageSize = 6;

export function getJobsFilterOptions(): JobsFilterOptions {
  return {
    locations: Array.from(new Set(publicJobs.map((job) => job.location))),
    industries: Array.from(new Set(publicJobs.map((job) => job.industry))),
    levels: Array.from(new Set(publicJobs.map((job) => job.level))),
    jobTypes: Array.from(new Set(publicJobs.map((job) => job.jobType))),
    workModes: Array.from(new Set(publicJobs.map((job) => job.workMode))),
  };
}

export function getPublicJobs(filters: JobsListFilters): Promise<JobsListResult> {
  const filteredJobs = sortJobs(filterJobs(publicJobs, filters), filters);
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const start = (page - 1) * pageSize;

  return withMockDelay({
    items: filteredJobs.slice(start, start + pageSize),
    totalItems: filteredJobs.length,
    page,
    pageSize,
    totalPages,
  });
}

function filterJobs(jobs: PublicJobListItem[], filters: JobsListFilters) {
  const keyword = filters.keyword.trim().toLowerCase();
  const salaryRangeValue = salaryRange(filters.salary);
  const postedDate = postedDateMin(filters.postedDate);

  return jobs.filter((job) => {
    const searchable = `${job.title} ${job.companyName} ${job.skills.join(" ")}`.toLowerCase();
    const matchKeyword = !keyword || searchable.includes(keyword);
    const matchLocation = !filters.locations.length || filters.locations.includes(job.location);
    const matchIndustry = !filters.industries.length || filters.industries.includes(job.industry);
    const matchSalary = !salaryRangeValue || job.salaryMax >= salaryRangeValue.min && job.salaryMax <= salaryRangeValue.max;
    const matchExperience = matchExperienceFilter(job.experienceYears, filters.experience);
    const matchLevel = !filters.level || job.level === filters.level;
    const matchJobType = !filters.jobType || job.jobType === filters.jobType;
    const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
    const matchPostedDate = postedDate === null || new Date(job.postedAt) >= postedDate;
    const matchFeatured = !filters.featured || job.status === "featured";

    return matchKeyword && matchLocation && matchIndustry && matchSalary && matchExperience && matchLevel && matchJobType && matchWorkMode && matchPostedDate && matchFeatured;
  });
}

function sortJobs(jobs: PublicJobListItem[], filters: JobsListFilters) {
  const nextJobs = [...jobs];
  if (filters.sort === "match") return nextJobs.sort((a, b) => b.matchScore - a.matchScore);
  if (filters.sort === "salary") return nextJobs.sort((a, b) => b.salaryMax - a.salaryMax);
  if (filters.sort === "deadline") return nextJobs.sort((a, b) => a.deadline.localeCompare(b.deadline));
  return nextJobs.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

function salaryRange(value: string) {
  if (value === "under-10") return { min: 0, max: 10 };
  if (value === "10-20") return { min: 10, max: 20 };
  if (value === "20-35") return { min: 20, max: 35 };
  if (value === "over-35") return { min: 35, max: Number.POSITIVE_INFINITY };
  return null;
}

function matchExperienceFilter(experienceYears: number, value: string) {
  if (!value) return true;
  if (value === "intern") return experienceYears === 0;
  if (value === "1") return experienceYears >= 1 && experienceYears < 3;
  if (value === "3") return experienceYears >= 3 && experienceYears < 5;
  if (value === "5") return experienceYears >= 5;
  return true;
}

function postedDateMin(value: string) {
  const now = new Date("2026-07-11T00:00:00");
  if (value === "7-days") {
    now.setDate(now.getDate() - 7);
    return now;
  }
  if (value === "30-days") {
    now.setDate(now.getDate() - 30);
    return now;
  }
  return null;
}
