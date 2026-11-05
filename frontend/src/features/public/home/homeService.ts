import { httpClient } from "../../../services/api/httpClient";
import { getPublicJobs } from "../jobs/jobsListService";
import type { PublicJobListItem } from "../jobs/jobsListTypes";
import type { FeaturedHomeCompany, FeaturedHomeJob, HomeData } from "./homeTypes";

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

interface PublicCompanyResponse {
  id: number;
  companyName: string;
  industry: string | null;
  address: string | null;
  status: "PENDING" | "VERIFIED" | "BLOCKED";
  openJobs: number | null;
  companySize: string | null;
  logoUrl: string | null;
}

interface PublicStatsResponse {
  totalJobs?: number | null;
  totalCompanies?: number | null;
  totalStudents?: number | null;
  totalApplications?: number | null;
}

export async function getHomeData(): Promise<HomeData> {
  const [jobsResult, companiesResponse, publicStats] = await Promise.all([
    getPublicJobs({ keyword: "", location: "", jobType: "", workingModel: "", page: 1 }),
    httpClient.get<ApiResponse<PageResponse<PublicCompanyResponse>>>("/public/companies", {
      params: { page: 1, size: 6, sort: "createdAt,desc" },
    }),
    getPublicStats(),
  ]);
  const companiesPage = companiesResponse.data.data;

  return {
    statistics: [
      statistic("jobs", "Việc làm đang tuyển", publicStats?.totalJobs, publicStats),
      statistic("candidates", "Sinh viên đang hoạt động", publicStats?.totalStudents, publicStats),
      statistic("companies", "Công ty đã xác thực", publicStats?.totalCompanies, publicStats),
      statistic("applications", "Đơn ứng tuyển", publicStats?.totalApplications, publicStats),
    ],
    statisticsUnavailable: !publicStats,
    jobs: jobsResult.items.map(mapFeaturedJob),
    industries: [],
    companies: companiesPage.items.map(mapFeaturedCompany),
    articles: [],
  };
}

async function getPublicStats(): Promise<PublicStatsResponse | null> {
  try {
    const response = await httpClient.get<ApiResponse<PublicStatsResponse>>("/public/statistics");
    return response.data.data;
  } catch {
    return null;
  }
}

function statistic(id: string, label: string, value: number | null | undefined, stats: PublicStatsResponse | null) {
  return {
    id, label,
    value: typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : null,
    unavailableReason: stats ? "Chưa có số liệu hợp lệ" : "Không tải được số liệu",
  };
}

function mapFeaturedJob(job: PublicJobListItem): FeaturedHomeJob {
  return {
    id: job.id,
    logo: job.logo,
    title: job.title,
    description: job.description,
    companyName: job.companyName,
    salary: job.salary,
    location: job.location,
    workMode: job.workMode,
    skills: job.skills,
    deadline: job.deadline,
    featuredLabel: "Đang tuyển",
  };
}

function mapFeaturedCompany(company: PublicCompanyResponse): FeaturedHomeCompany {
  return {
    id: String(company.id),
    logo: getInitials(company.companyName),
    logoUrl: company.logoUrl ?? "",
    name: company.companyName,
    industry: company.industry || "Chưa cập nhật",
    size: company.companySize || "Chưa cập nhật",
    location: company.address || "Chưa cập nhật",
    openJobs: company.openJobs ?? null,
    verified: company.status === "VERIFIED",
  };
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
