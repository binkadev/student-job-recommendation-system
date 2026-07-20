import { getStorageItem, setStorageItem } from "../../../utils/localStorage";
import { httpClient } from "../../../services/api/httpClient";
import type { CandidateRecommendedJob, RecommendedJobFilters } from "./recommendedJobsTypes";

const HIDDEN_KEY = "candidate-hidden-recommended-jobs";
const NOT_INTERESTED_KEY = "candidate-not-interested-jobs";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface JobSkillResponse {
  id: number;
  skillId: number;
  skillName: string;
  normalizedName: string;
  category: string | null;
}

interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  jobType: BackendJobType | null;
  workingModel: BackendWorkingModel | null;
  status: BackendJobStatus;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
  skills: JobSkillResponse[];
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

const JOB_TYPE_LABELS: Record<BackendJobType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  CONTRACT: "Hợp đồng",
};

const WORKING_MODEL_LABELS: Record<BackendWorkingModel, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

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

export async function getRecommendedJobs(filters: RecommendedJobFilters, hiddenIds: string[]) {
  const jobs = await getAllActiveJobs(1, []);
  const filtered = jobs.map(mapJob).filter((job) => {
    const matchHidden = !hiddenIds.includes(job.id);
    const matchScore = job.matchScore >= filters.minMatch;
    const matchLocation = !filters.location || job.location === filters.location;
    const matchIndustry = !filters.industry || job.industry === filters.industry;
    const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
    const matchExperience = !filters.experience || job.experienceLabel.includes(filters.experience);
    const matchSalary = !filters.salary || job.salaryMax >= Number(filters.salary);
    return matchHidden && matchScore && matchLocation && matchIndustry && matchWorkMode && matchExperience && matchSalary;
  });
  return filtered.sort((a, b) => b.matchScore - a.matchScore);
}

export function getRecommendedFilterOptions(jobs: CandidateRecommendedJob[]) {
  return {
    locations: Array.from(new Set(jobs.map((job) => job.location))),
    industries: Array.from(new Set(jobs.map((job) => job.industry))),
    workModes: Array.from(new Set(jobs.map((job) => job.workMode))),
  };
}

async function getAllActiveJobs(page: number, items: JobResponse[]): Promise<JobResponse[]> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page, size: 100, status: "ACTIVE" },
  });
  const data = response.data.data;
  const nextItems = [...items, ...data.items];
  if (data.page < data.totalPages) return getAllActiveJobs(page + 1, nextItems);
  return nextItems;
}

function mapJob(job: JobResponse): CandidateRecommendedJob {
  const skills = (job.skills ?? []).map((skill) => skill.skillName).filter(Boolean);
  const score = calculateDisplayScore(job, skills);
  return {
    id: String(job.id),
    logo: getInitials(job.companyName),
    title: job.title,
    companyId: String(job.companyId),
    companyName: job.companyName,
    salary: formatSalary(job),
    salaryMax: Number(job.salaryMax ?? job.salaryMin ?? 0),
    location: job.location || "Chưa cập nhật",
    industry: "Chưa có API",
    experienceYears: 0,
    experienceLabel: "Chưa có API",
    level: "Chưa có API",
    jobType: job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills,
    postedAt: formatDate(job.publishedAt || job.createdAt),
    deadline: formatDate(job.deadline),
    applicants: 0,
    status: job.deadline && daysUntil(job.deadline) <= 7 ? "urgent" : "published",
    matchScore: score,
    skillScore: skills.length > 0 ? score : 55,
    experienceScore: 55,
    educationScore: 55,
    locationScore: job.location ? 70 : 50,
    salaryScore: job.salaryMin || job.salaryMax ? 70 : 50,
    workModeScore: job.workingModel ? 70 : 50,
    matchedSkills: skills,
    missingSkills: [],
    recommendationReasons: [
      "Công việc đang ACTIVE trong cơ sở dữ liệu.",
      skills.length > 0 ? `Tin tuyển dụng có ${skills.length} kỹ năng đã khai báo.` : "Tin tuyển dụng chưa khai báo kỹ năng.",
      job.workingModel ? `Hình thức làm việc: ${WORKING_MODEL_LABELS[job.workingModel]}.` : "Chưa cập nhật hình thức làm việc.",
    ],
  };
}

function calculateDisplayScore(job: JobResponse, skills: string[]) {
  let score = 55;
  if (skills.length > 0) score += Math.min(20, skills.length * 4);
  if (job.location) score += 5;
  if (job.workingModel) score += 5;
  if (job.salaryMin || job.salaryMax) score += 5;
  return Math.min(90, score);
}

function formatSalary(job: Pick<JobResponse, "salaryMin" | "salaryMax" | "currency">) {
  if (job.salaryMin == null && job.salaryMax == null) return "Thỏa thuận";
  const currency = job.currency || "VND";
  const min = job.salaryMin != null ? formatMoney(job.salaryMin) : "";
  const max = job.salaryMax != null ? formatMoney(job.salaryMax) : "";
  if (min && max) return `${min} - ${max} ${currency}`;
  return `${min || max} ${currency}`;
}

function formatMoney(value: number | string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return new Intl.NumberFormat("vi-VN").format(numberValue);
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function daysUntil(value: string) {
  const target = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(-2)
    .toUpperCase();
  return initials || "CT";
}
