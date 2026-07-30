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
  skillId: number;
  skillName: string;
  category: string | null;
  importance?: string | null;
  minLevel?: string | null;
}

interface PublicJobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  description?: string | null;
  location: string | null;
  jobType: BackendJobType | null;
  workingModel: BackendWorkingModel | null;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
  skills?: JobSkillResponse[] | null;
  publishedAt: string | null;
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
  const response = await httpClient.get<ApiResponse<PageResponse<PublicJobResponse>>>("/public/jobs", {
    params: {
      page: filters.page,
      size: pageSize,
      keyword: filters.keyword || undefined,
      location: filters.location || undefined,
      jobType: filters.jobType || undefined,
      workingModel: filters.workingModel || undefined,
    },
  });
  const data = response.data.data;
  const items = data.items.map(mapJob);

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
    description: job.description || "",
    companyId: String(job.companyId),
    companyName: job.companyName,
    salary: formatSalary(job),
    salaryMax: Number(job.salaryMax ?? job.salaryMin ?? 0),
    location: job.location || "Chưa cập nhật",
    industry: job.title,
    experienceYears: null,
    experienceLabel: null,
    level: null,
    jobType: job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills,
    postedAt: formatDate(job.publishedAt),
    deadline: formatDate(job.deadline),
    applicants: getApplicantCount(job),
    status: job.deadline && daysUntil(job.deadline) <= 7 ? "urgent" : "published",
    matchScore: 0,
  };
}

function getApplicantCount(job: PublicJobResponse) {
  return Number(job.applicantCount ?? job.applicationCount ?? job.applicants ?? job.totalApplications ?? job.applicationsCount ?? job.applicationTotal ?? job.totalApplicants ?? job.totalApplicantCount ?? 0);
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
