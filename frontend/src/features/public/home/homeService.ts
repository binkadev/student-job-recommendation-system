import { httpClient } from "../../../services/api/httpClient";
import type { FeaturedHomeJob, HomeData } from "./homeTypes";

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
  createdAt: string;
}

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";

const WORKING_MODEL_LABELS: Record<BackendWorkingModel, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export async function getHomeData(): Promise<HomeData> {
  const jobsResponse = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: { page: 1, size: 6, status: "ACTIVE" },
  });
  const jobsPage = jobsResponse.data.data;
  const companiesCount = new Set(jobsPage.items.map((job) => job.companyId)).size;

  return {
    statistics: [
      { id: "jobs", label: "Việc làm đang tuyển", value: String(jobsPage.totalItems) },
      { id: "candidates", label: "Ứng viên", value: "0" },
      { id: "companies", label: "Công ty", value: "0" },
      { id: "applications", label: "Lượt ứng tuyển", value: "0" },
    ],
    jobs: jobsPage.items.map(mapFeaturedJob),
    industries: [],
    companies: [],
    articles: [],
  };
}

function mapFeaturedJob(job: JobResponse): FeaturedHomeJob {
  return {
    id: String(job.id),
    logo: getInitials(job.companyName),
    title: job.title,
    companyName: job.companyName,
    salary: formatSalary(job),
    location: job.location || "Chưa cập nhật",
    workMode: job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật",
    skills: (job.skills ?? []).map((skill) => skill.skillName),
    deadline: formatDate(job.deadline),
    featuredLabel: "Đang tuyển",
  };
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
