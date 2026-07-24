import { httpClient } from "../../../services/api/httpClient";
import type { JobDetailResult, PublicJobDetail } from "./jobDetailTypes";
import type { PublicJobListItem } from "./jobsListTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface JobSkillResponse {
  id: number;
  skillId: number;
  skillName: string;
  normalizedName: string;
  category: string | null;
}

interface JobDetailResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  location: string | null;
  jobType: BackendJobType | null;
  workingModel: BackendWorkingModel | null;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
  skills: JobSkillResponse[];
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
}

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";

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

export async function getPublicJobDetail(jobId: string): Promise<JobDetailResult | null> {
  if (!jobId) return null;
  const response = await httpClient.get<ApiResponse<JobDetailResponse>>(`/public/jobs/${jobId}`);
  const job = response.data.data;
  const company = await getPublicCompanyDetailOrNull(job.companyId);
  return {
    job: mapJobDetail(job, company),
    similarJobs: [],
  };
}

async function getPublicCompanyDetailOrNull(companyId: number) {
  try {
    const response = await httpClient.get<ApiResponse<PublicCompanyDetailResponse>>(`/public/companies/${companyId}`);
    return response.data.data;
  } catch {
    return null;
  }
}

function mapJobDetail(job: JobDetailResponse, company: PublicCompanyDetailResponse | null): PublicJobDetail {
  const skills = (job.skills ?? []).map((skill) => skill.skillName);
  return {
    id: String(job.id),
    logo: getInitials(job.companyName),
    title: job.title,
    companyId: String(job.companyId),
    companyName: job.companyName,
    salary: formatSalary(job),
    salaryMax: Number(job.salaryMax ?? job.salaryMin ?? 0),
    location: job.location || "Chưa cập nhật",
    industry: company?.industry || "Chưa cập nhật",
    experienceYears: 0,
    experienceLabel: "Chưa có API",
    level: "Chưa có API",
    jobType: job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills,
    postedAt: formatDate(job.publishedAt),
    deadline: formatDate(job.deadline),
    applicants: getApplicantCount(job),
    status: job.deadline && daysUntil(job.deadline) <= 7 ? "urgent" : "published",
    matchScore: 0,
    companyVerified: company?.status === "VERIFIED",
    companyIndustry: company?.industry || "Chưa cập nhật",
    companySize: company?.companySize || "Chưa cập nhật",
    companyLocation: company?.address || job.location || "Chưa cập nhật",
    companyDescription: company?.description || "Chưa cập nhật mô tả công ty.",
    companyLogoUrl: company?.logoUrl ?? "",
    companyWebsite: company?.websiteUrl || "",
    hiringQuantity: 0,
    views: 0,
    description: job.description || "",
    responsibilities: [],
    requirements: splitContent(job.requirements),
    requiredSkills: skills,
    preferredSkills: [],
    benefits: splitContent(job.benefits),
    workplace: job.location || "Chưa cập nhật",
    workingTime: "Chưa cập nhật",
    recruitmentProcess: [],
    apiStatus: "Đang tuyển",
    publishedAt: formatDate(job.publishedAt),
    updatedAt: "Chưa cập nhật",
    closedAt: "Chưa cập nhật",
    detailStatus: mapDetailStatus(job),
  };
}

function getApplicantCount(job: JobDetailResponse) {
  return Number(job.applicantCount ?? job.applicationCount ?? job.applicants ?? job.totalApplications ?? job.applicationsCount ?? job.applicationTotal ?? job.totalApplicants ?? job.totalApplicantCount ?? 0);
}

function getStatusLabel(status: string) {
  if (status === "ACTIVE") return "Đang tuyển";
  if (status === "DRAFT") return "Bản nháp";
  if (status === "PENDING_APPROVAL") return "Chờ duyệt";
  if (status === "CLOSED") return "Đã đóng";
  if (status === "REJECTED") return "Bị từ chối";
  return "Hết hạn";
}

function mapDetailStatus(job: JobDetailResponse): PublicJobDetail["detailStatus"] {
  if (job.deadline && daysUntil(job.deadline) < 0) return "expired";
  return "open";
}

function splitContent(value?: string | null) {
  if (!value) return [];
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function formatSalary(job: Pick<JobDetailResponse, "salaryMin" | "salaryMax" | "currency">) {
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
