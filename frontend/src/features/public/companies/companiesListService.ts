import { httpClient } from "../../../services/api/httpClient";
import type { CompaniesListFilters, CompaniesListResult, CompanyFilterOptions, PublicCompanyListItem } from "./companiesListTypes";

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

interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  jobType: BackendJobType | null;
  workingModel: BackendWorkingModel | null;
  status: BackendJobStatus;
}

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

const pageSize = 8;

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

export function getCompanyFilterOptions(): CompanyFilterOptions {
  return {
    locations: [],
    jobTypes: Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    workModes: Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label })),
  };
}

export async function getPublicCompanies(filters: CompaniesListFilters): Promise<CompaniesListResult> {
  const jobsResponse = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: {
      page: 1,
      size: 100,
      keyword: filters.keyword || undefined,
      location: filters.location || undefined,
      jobType: filters.jobType || undefined,
      workingModel: filters.workingModel || undefined,
      status: "ACTIVE",
    },
  });
  const companies = groupCompanies(jobsResponse.data.data.items, filters);
  const totalPages = Math.max(1, Math.ceil(companies.length / pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: companies.slice(start, start + pageSize),
    totalItems: companies.length,
    page,
    pageSize,
    totalPages,
  };
}

function groupCompanies(jobs: JobResponse[], filters: CompaniesListFilters) {
  const keyword = filters.keyword.trim().toLowerCase();
  const groups = jobs.reduce<Record<number, JobResponse[]>>((acc, job) => {
    acc[job.companyId] = [...(acc[job.companyId] ?? []), job];
    return acc;
  }, {});

  return Object.entries(groups)
    .map(([, companyJobs]) => mapCompany(companyJobs))
    .filter((company) => !keyword || company.name.toLowerCase().includes(keyword))
    .sort((left, right) => right.openJobs - left.openJobs || left.name.localeCompare(right.name));
}

function mapCompany(jobs: JobResponse[]): PublicCompanyListItem {
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
    description: "Backend hiện chưa có API public hồ sơ công ty. Thông tin này được tổng hợp từ các tin tuyển dụng đang active.",
    openJobs: jobs.length,
    jobTypes,
    workingModels,
  };
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
