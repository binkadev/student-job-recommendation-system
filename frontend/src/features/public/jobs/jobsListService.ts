import { httpClient } from "../../../services/api/httpClient";
import type { JobsFilterOptions, JobsListFilters, JobsListResult, PublicJobListItem } from "./jobsListTypes";

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

interface PublicJobResponse {
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
  skills?: JobSkillResponse[] | null;
  publishedAt: string | null;
  createdAt?: string | null;
  applicantCount?: number | null;
  applicationCount?: number | null;
  applicants?: number | null;
  totalApplications?: number | null;
  applicationsCount?: number | null;
  applicationTotal?: number | null;
  totalApplicants?: number | null;
  totalApplicantCount?: number | null;
}

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

const pageSize = 6;

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

export function getJobsFilterOptions(): JobsFilterOptions {
  return {
    locations: [],
    jobTypes: Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    workModes: Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label })),
  };
}

export async function getPublicJobs(filters: JobsListFilters): Promise<JobsListResult> {
  const response = await httpClient.get<ApiResponse<PageResponse<PublicJobResponse>>>("/jobs", {
    params: {
      page: filters.page,
      size: pageSize,
      status: "ACTIVE",
      keyword: filters.keyword || undefined,
      location: filters.location || undefined,
      jobType: filters.jobType || undefined,
      workingModel: filters.workingModel || undefined,
    },
  });
  const data = response.data.data;
  const items = data.items.map(mapJob).filter((job) => matchesClientFilters(job, filters));

  return {
    items,
    totalItems: data.totalItems,
    page: data.page,
    pageSize: data.size,
    totalPages: data.totalPages,
  };
}

function mapJob(job: PublicJobResponse): PublicJobListItem {
  const skills = (job.skills ?? []).map((skill) => skill.skillName).filter(Boolean);
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
    experienceYears: inferExperienceYears(job.title),
    experienceLabel: inferExperienceLabel(job.title),
    level: inferLevel(job.title),
    jobType: job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills,
    postedAt: formatDate(job.publishedAt || job.createdAt),
    deadline: formatDate(job.deadline),
    applicants: getApplicantCount(job),
    status: job.deadline && daysUntil(job.deadline) <= 7 ? "urgent" : "published",
    matchScore: 0,
  };
}

function getApplicantCount(job: PublicJobResponse) {
  return Number(job.applicantCount ?? job.applicationCount ?? job.applicants ?? job.totalApplications ?? job.applicationsCount ?? job.applicationTotal ?? job.totalApplicants ?? job.totalApplicantCount ?? 0);
}

function matchesClientFilters(job: PublicJobListItem, filters: JobsListFilters) {
  const keyword = normalizeText(filters.keyword.trim());
  const searchable = normalizeText(`${job.title} ${job.companyName} ${job.skills.join(" ")}`);
  const matchKeyword = !keyword || searchable.includes(keyword);
  const matchLocation = !filters.location || normalizeLocation(job.location).includes(normalizeLocation(filters.location));
  return matchKeyword && matchLocation;
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

function inferExperienceYears(title: string) {
  const label = inferExperienceLabel(title);
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

function formatSalary(job: Pick<PublicJobResponse, "salaryMin" | "salaryMax" | "currency">) {
  if (job.salaryMin == null && job.salaryMax == null) return "Thỏa thuận";
  const min = job.salaryMin != null ? formatMoney(job.salaryMin) : "";
  const max = job.salaryMax != null ? formatMoney(job.salaryMax) : "";
  if (min && max) return `${min} - ${max} đồng`;
  return `${min || max} đồng`;
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
