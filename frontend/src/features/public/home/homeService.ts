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

interface PublicJobStatsResponse {
  id: number;
  applicantCount?: number | null;
  applicationCount?: number | null;
  applicants?: number | null;
  totalApplications?: number | null;
  applicationsCount?: number | null;
  applicationTotal?: number | null;
  totalApplicants?: number | null;
  totalApplicantCount?: number | null;
}

interface PublicStatsResponse {
  totalJobs?: number | null;
  jobCount?: number | null;
  jobs?: number | null;
  totalCompanies?: number | null;
  companyCount?: number | null;
  companies?: number | null;
  totalCandidates?: number | null;
  candidateCount?: number | null;
  candidates?: number | null;
  totalStudents?: number | null;
  studentCount?: number | null;
  totalApplications?: number | null;
  applicationCount?: number | null;
  applications?: number | null;
  totalApplicants?: number | null;
}

export async function getHomeData(): Promise<HomeData> {
  const [jobsResult, companiesResponse, publicStats, allJobsForStats] = await Promise.all([
    getPublicJobs({ keyword: "", location: "", jobType: "", workingModel: "", page: 1 }),
    httpClient.get<ApiResponse<PageResponse<PublicCompanyResponse>>>("/public/companies", {
      params: { page: 1, size: 6, sort: "createdAt,desc" },
    }),
    getPublicStats(),
    getAllPublicJobsForStats(1, []),
  ]);
  const companiesPage = companiesResponse.data.data;

  return {
    statistics: [
      { id: "jobs", label: "Việc làm đang tuyển", value: String(getTotalJobs(publicStats, jobsResult.totalItems)) },
      { id: "candidates", label: "Ứng viên", value: String(getTotalCandidates(publicStats)) },
      { id: "companies", label: "Công ty", value: String(getTotalCompanies(publicStats, companiesPage.totalItems)) },
      { id: "applications", label: "Lượt ứng tuyển", value: String(getTotalApplications(publicStats, allJobsForStats)) },
    ],
    jobs: jobsResult.items.map(mapFeaturedJob),
    industries: [],
    companies: companiesPage.items.map(mapFeaturedCompany),
    articles: [],
  };
}

async function getPublicStats(): Promise<PublicStatsResponse | null> {
  const endpoints = ["/public/statistics", "/public/stats", "/public/overview", "/public/dashboard"];
  for (const endpoint of endpoints) {
    try {
      const response = await httpClient.get<ApiResponse<PublicStatsResponse>>(endpoint);
      return response.data.data;
    } catch {
      // Continue to support whichever public stats endpoint the backend exposes.
    }
  }
  return null;
}

async function getAllPublicJobsForStats(page: number, items: PublicJobStatsResponse[]): Promise<PublicJobStatsResponse[]> {
  const response = await httpClient.get<ApiResponse<PageResponse<PublicJobStatsResponse>>>("/jobs", {
    params: { page, size: 100, status: "ACTIVE" },
  });
  const data = response.data.data;
  const nextItems = [...items, ...data.items];
  if (data.page < data.totalPages) return getAllPublicJobsForStats(page + 1, nextItems);
  return nextItems;
}

function getTotalJobs(stats: PublicStatsResponse | null, fallback: number) {
  return Number(stats?.totalJobs ?? stats?.jobCount ?? stats?.jobs ?? fallback);
}

function getTotalCompanies(stats: PublicStatsResponse | null, fallback: number) {
  return Number(stats?.totalCompanies ?? stats?.companyCount ?? stats?.companies ?? fallback);
}

function getTotalCandidates(stats: PublicStatsResponse | null) {
  return Number(stats?.totalCandidates ?? stats?.candidateCount ?? stats?.candidates ?? stats?.totalStudents ?? stats?.studentCount ?? 0);
}

function getTotalApplications(stats: PublicStatsResponse | null, jobs: PublicJobStatsResponse[]) {
  const statsValue = stats?.totalApplications ?? stats?.applicationCount ?? stats?.applications ?? stats?.totalApplicants;
  if (statsValue != null) return Number(statsValue);
  return jobs.reduce((total, job) => total + Number(job.applicantCount ?? job.applicationCount ?? job.applicants ?? job.totalApplications ?? job.applicationsCount ?? job.applicationTotal ?? job.totalApplicants ?? job.totalApplicantCount ?? 0), 0);
}

function mapFeaturedJob(job: PublicJobListItem): FeaturedHomeJob {
  return {
    id: job.id,
    logo: job.logo,
    title: job.title,
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
    openJobs: Number(company.openJobs ?? 0),
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
