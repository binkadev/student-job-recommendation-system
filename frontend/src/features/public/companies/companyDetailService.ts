import { httpClient } from "../../../services/api/httpClient";
import type { PublicJobListItem } from "../jobs/jobsListTypes";
import type { CompanyDetailResult, PublicCompanyDetail } from "./companyDetailTypes";

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

export async function getPublicCompanyDetail(companyId: string): Promise<CompanyDetailResult | null> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: {
      page: 1,
      size: 100,
      status: "ACTIVE",
    },
  });
  const jobs = response.data.data.items.filter((job) => String(job.companyId) === companyId);
  if (!jobs.length) return null;

  return {
    company: mapCompany(jobs),
    jobs: jobs.map(mapJob),
  };
}

function mapCompany(jobs: JobResponse[]): PublicCompanyDetail {
  const firstJob = jobs[0];
  const locations = unique(jobs.map((job) => job.location).filter((value): value is string => Boolean(value)));
  const jobTypes = unique(jobs.map((job) => job.jobType).filter((value): value is BackendJobType => Boolean(value)).map((value) => JOB_TYPE_LABELS[value]));
  const workingModels = unique(jobs.map((job) => job.workingModel).filter((value): value is BackendWorkingModel => Boolean(value)).map((value) => WORKING_MODEL_LABELS[value]));

  return {
    id: String(firstJob.companyId),
    cover: "bg-slate-950",
    logo: getInitials(firstJob.companyName),
    name: firstJob.companyName,
    verified: false,
    industry: "Chưa có API",
    size: "Chưa có API",
    location: locations[0] || "Chưa cập nhật",
    description: "Backend hiện chưa có API public hồ sơ công ty. Thông tin trang này được tổng hợp từ các tin tuyển dụng active của công ty.",
    openJobs: jobs.length,
    jobTypes,
    workingModels,
    website: "Chưa có API",
    address: locations.join(", ") || "Chưa cập nhật",
    foundedYear: 0,
    mission: "Chưa có API public cho sứ mệnh công ty.",
    coreValues: [],
    branches: locations.length ? locations : ["Chưa cập nhật"],
    benefits: [],
    gallery: [],
  };
}

function mapJob(job: JobResponse): PublicJobListItem {
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
    skills: (job.skills ?? []).map((skill) => skill.skillName),
    postedAt: formatDate(job.publishedAt || job.createdAt),
    deadline: formatDate(job.deadline),
    applicants: 0,
    status: getDisplayStatus(job),
    matchScore: 0,
  };
}

function getDisplayStatus(job: JobResponse): PublicJobListItem["status"] {
  if (job.deadline && daysUntil(job.deadline) <= 7) return "urgent";
  return "published";
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

function unique(values: string[]) {
  return Array.from(new Set(values));
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
