import { httpClient } from "../../../services/api/httpClient";
import type { PublicJobListItem } from "../jobs/jobsListTypes";
import type { CompanyDetailResult, PublicCompanyDetail } from "./companyDetailTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PublicCompanyDetailResponse {
  id: number;
  companyName: string;
  industry: string | null;
  address: string | null;
  websiteUrl: string | null;
  description: string | null;
  status: "PENDING" | "VERIFIED" | "BLOCKED";
  openJobs: number | null;
  createdAt: string;
  updatedAt: string;
  companySize: string | null;
  logoUrl: string | null;
  jobs: CompanyJobSummaryResponse[];
}

interface CompanyJobSummaryResponse {
  id: number;
  title: string;
  location: string | null;
  jobType: BackendJobType | null;
  workingModel: BackendWorkingModel | null;
  status: BackendJobStatus;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
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
  if (!companyId) return null;
  const response = await httpClient.get<ApiResponse<PublicCompanyDetailResponse>>(`/public/companies/${companyId}`);
  const company = response.data.data;
  return {
    company: mapCompany(company),
    jobs: (company.jobs ?? []).map((job) => mapJob(job, company)),
  };
}

function mapCompany(company: PublicCompanyDetailResponse): PublicCompanyDetail {
  return {
    id: String(company.id),
    cover: "bg-slate-950",
    logo: getInitials(company.companyName),
    logoUrl: company.logoUrl ?? "",
    name: company.companyName,
    verified: company.status === "VERIFIED",
    industry: company.industry || "Chưa cập nhật",
    size: company.companySize || "Chưa cập nhật",
    location: company.address || "Chưa cập nhật",
    description: company.description || "Chưa cập nhật mô tả công ty.",
    openJobs: Number(company.openJobs ?? 0),
    website: company.websiteUrl || "Chưa cập nhật",
    address: company.address || "Chưa cập nhật",
    foundedYear: 0,
    mission: company.description || "Chưa cập nhật sứ mệnh công ty.",
    coreValues: [],
    branches: company.address ? [company.address] : ["Chưa cập nhật"],
    benefits: [],
    gallery: [],
  };
}

function mapJob(job: CompanyJobSummaryResponse, company: PublicCompanyDetailResponse): PublicJobListItem {
  return {
    id: String(job.id),
    logo: getInitials(company.companyName),
    title: job.title,
    companyId: String(company.id),
    companyName: company.companyName,
    salary: formatSalary(job),
    salaryMax: Number(job.salaryMax ?? job.salaryMin ?? 0),
    location: job.location || "Chưa cập nhật",
    industry: company.industry || "Chưa cập nhật",
    experienceYears: 0,
    experienceLabel: "Chưa có API",
    level: "Chưa có API",
    jobType: job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills: [],
    postedAt: formatDate(job.publishedAt),
    deadline: formatDate(job.deadline),
    applicants: getApplicantCount(job),
    status: job.deadline && daysUntil(job.deadline) <= 7 ? "urgent" : "published",
    matchScore: 0,
  };
}

function getApplicantCount(job: CompanyJobSummaryResponse) {
  return Number(job.applicantCount ?? job.applicationCount ?? job.applicants ?? job.totalApplications ?? job.applicationsCount ?? job.applicationTotal ?? job.totalApplicants ?? job.totalApplicantCount ?? 0);
}

function formatSalary(job: Pick<CompanyJobSummaryResponse, "salaryMin" | "salaryMax" | "currency">) {
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
