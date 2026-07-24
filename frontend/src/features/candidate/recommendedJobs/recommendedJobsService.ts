import { httpClient } from "../../../services/api/httpClient";
import { getStorageItem, setStorageItem } from "../../../utils/localStorage";
import type { CandidateRecommendedJob, RecommendedJobFilters } from "./recommendedJobsTypes";

const HIDDEN_KEY = "candidate-hidden-recommended-jobs";

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
    notInterestedIds: [],
  };
}

export function saveRecommendedJobState(hiddenIds: string[], notInterestedIds: string[]) {
  setStorageItem(HIDDEN_KEY, hiddenIds);
  void notInterestedIds;
}

export async function getRecommendedJobs(filters: RecommendedJobFilters, hiddenIds: string[]) {
  const jobs = await getAllActiveJobs(1, []);
  const filtered = jobs.map(mapJob).filter((job) => {
    const matchHidden = !hiddenIds.includes(job.id);
    const matchScore = job.matchScore >= filters.minMatch;
    const matchLocation = !filters.location || normalizeLocation(job.location).includes(normalizeLocation(filters.location));
    const matchIndustry = !filters.industry || job.industry === filters.industry;
    const matchWorkMode = !filters.workMode || job.workMode === filters.workMode;
    const matchExperience = !filters.experience || job.experienceLabel.includes(filters.experience);
    const matchSalary = !filters.salary || job.salaryMax >= Number(filters.salary) * 1_000_000;
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
  const experienceLabel = inferExperienceLabel(job.title);
  return {
    id: String(job.id),
    logo: getInitials(job.companyName),
    title: job.title,
    companyId: String(job.companyId),
    companyName: job.companyName,
    salary: formatSalary(job),
    salaryMax: Number(job.salaryMax ?? job.salaryMin ?? 0),
    location: job.location || "Chưa cập nhật",
    industry: job.title,
    experienceYears: inferExperienceYears(experienceLabel),
    experienceLabel,
    level: inferLevel(job.title),
    jobType: job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills,
    postedAt: formatDate(job.publishedAt || job.createdAt),
    deadline: formatDate(job.deadline),
    applicants: 0,
    status: job.deadline && daysUntil(job.deadline) <= 7 ? "urgent" : "published",
    matchScore: score,
    skillScore: skills.length > 0 ? score : 55,
    experienceScore: experienceLabel === "Chưa cập nhật" ? 55 : 70,
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

function inferExperienceLabel(title: string) {
  const normalized = normalizeText(title);
  if (/\b(intern|internship|thuc tap|fresher)\b/.test(normalized)) return "Thực tập";
  if (/\b(junior|0\s*-\s*1|1\s*nam)\b/.test(normalized)) return "0-1 năm";
  if (/\b(1\s*-\s*2|2\s*nam)\b/.test(normalized)) return "1-2 năm";
  if (/\b(senior|lead|manager|5\+|5\s*nam)\b/.test(normalized)) return "5+ năm";
  if (/\b(middle|3\+|3\s*nam|4\s*nam)\b/.test(normalized)) return "3+ năm";
  return "Chưa cập nhật";
}

function inferExperienceYears(label: string) {
  if (label === "Thực tập" || label === "0-1 năm") return 0;
  if (label === "1-2 năm") return 1;
  if (label === "3+ năm") return 3;
  if (label === "5+ năm") return 5;
  return 0;
}

function inferLevel(title: string) {
  const normalized = normalizeText(title);
  if (/\b(intern|internship|thuc tap)\b/.test(normalized)) return "Intern";
  if (/\b(fresher)\b/.test(normalized)) return "Fresher";
  if (/\b(junior)\b/.test(normalized)) return "Junior";
  if (/\b(senior|lead)\b/.test(normalized)) return "Senior";
  if (/\b(middle)\b/.test(normalized)) return "Middle";
  return "Chưa cập nhật";
}

function normalizeLocation(value: string) {
  const normalized = normalizeText(value).replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(hcm|hcmc|ho chi minh|ho chi minh city|sai gon|saigon)\b/.test(normalized)) return "ho chi minh";
  if (/\b(ha noi|hanoi)\b/.test(normalized)) return "ha noi";
  if (/\b(da nang|danang)\b/.test(normalized)) return "da nang";
  return normalized;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatSalary(job: Pick<JobResponse, "salaryMin" | "salaryMax" | "currency">) {
  if (job.salaryMin == null && job.salaryMax == null) return "Thỏa thuận";
  const currency = "đồng";
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
