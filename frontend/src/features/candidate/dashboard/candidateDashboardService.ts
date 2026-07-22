import { httpClient } from "../../../services/api/httpClient";
import type { Job } from "../../../types/domain";
import type {
  CandidateDashboardApplication,
  CandidateDashboardData,
  CandidateDashboardNotification,
} from "./candidateDashboardTypes";

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

interface StudentResponse {
  id: number;
  email: string;
  fullName: string | null;
  location: string | null;
  headline: string | null;
}

interface StudentProfileResponse {
  headline: string | null;
  summary: string | null;
  education: string | null;
  experience: string | null;
  projects: string | null;
  targetPosition: string | null;
  preferredLocation: string | null;
  preferredJobType: string | null;
  profileCompleteness: number | null;
}

interface JobSkillResponse {
  id: number;
  skillName: string;
}

interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  jobType: "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT" | null;
  workingModel: "ONSITE" | "HYBRID" | "REMOTE" | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
  skills: JobSkillResponse[];
  publishedAt: string | null;
  createdAt: string;
}

interface SavedJobResponse {
  savedJobId: number;
  jobId: number;
}

interface ApplicationResponse {
  id: number;
  status: CandidateDashboardApplication["status"];
  jobId: number;
  jobTitle: string;
  companyName: string;
  appliedAt: string;
  updatedAt: string;
}

interface CvFileResponse {
  id: number;
  originalFileName: string;
  fileSize: number;
  active: boolean;
  uploadedAt: string;
}

interface NotificationResponse {
  id: number;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  createdAt: string;
}

interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export async function getCandidateDashboardData(): Promise<CandidateDashboardData> {
  const [
    studentResponse,
    profileResponse,
    jobsResponse,
    savedJobsResponse,
    applicationsResponse,
    cvFilesResponse,
    activeCvResponse,
    notificationsResponse,
    unreadResponse,
  ] = await Promise.all([
    httpClient.get<ApiResponse<StudentResponse>>("/students/me"),
    httpClient.get<ApiResponse<StudentProfileResponse>>("/students/me/profile"),
    httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", { params: { page: 1, size: 4, status: "ACTIVE" } }),
    httpClient.get<ApiResponse<PageResponse<SavedJobResponse>>>("/students/me/saved-jobs", { params: { page: 1, size: 1 } }),
    httpClient.get<ApiResponse<ApplicationResponse[]>>("/students/me/applications"),
    httpClient.get<ApiResponse<CvFileResponse[]>>("/students/me/cv"),
    httpClient.get<ApiResponse<CvFileResponse | null>>("/students/me/cv/active"),
    httpClient.get<ApiResponse<PageResponse<NotificationResponse>>>("/notifications", { params: { page: 1, size: 5 } }),
    httpClient.get<ApiResponse<UnreadNotificationCountResponse>>("/notifications/unread-count"),
  ]);

  const student = studentResponse.data.data;
  const profile = profileResponse.data.data;
  const applications = applicationsResponse.data.data;
  const activeCv = activeCvResponse.data.data;

  return {
    profile: {
      id: String(student.id),
      name: student.fullName || student.email,
      title: student.headline || profile.targetPosition || profile.headline || "Ứng viên",
      location: student.location || profile.preferredLocation || "Chưa cập nhật",
      profileCompletion: profile.profileCompleteness ?? calculateProfileCompletion(student, profile),
    },
    stats: {
      activeJobs: jobsResponse.data.data.totalItems,
      savedJobs: savedJobsResponse.data.data.totalItems,
      applications: applications.length,
      cvs: cvFilesResponse.data.data.length,
    },
    cv: activeCv ? {
      id: String(activeCv.id),
      fileName: activeCv.originalFileName,
      fileSize: formatFileSize(activeCv.fileSize),
      uploadedAt: formatDateTime(activeCv.uploadedAt),
      active: activeCv.active,
    } : null,
    missingProfileItems: buildMissingProfileItems(student, profile),
    jobs: jobsResponse.data.data.items.map(mapJob),
    applications: applications.slice(0, 5).map(mapApplication),
    notifications: notificationsResponse.data.data.items.map(mapNotification),
    unreadNotifications: unreadResponse.data.data.unreadCount,
  };
}

function mapJob(job: JobResponse): Job {
  return {
    id: String(job.id),
    title: job.title,
    companyId: String(job.companyId),
    companyName: job.companyName,
    location: job.location || "Chưa cập nhật",
    salary: formatSalary(job),
    industry: "",
    experience: "",
    jobType: getJobTypeLabel(job.jobType),
    workMode: mapWorkingModel(job.workingModel),
    level: "",
    skills: job.skills.map((skill) => skill.skillName),
    description: "",
    requirements: [],
    benefits: [],
    deadline: formatDate(job.deadline),
    postedAt: formatDateTime(job.publishedAt || job.createdAt),
    status: "published",
    views: 0,
    applicants: 0,
  };
}

function mapApplication(application: ApplicationResponse): CandidateDashboardApplication {
  return {
    id: String(application.id),
    jobId: String(application.jobId),
    jobTitle: application.jobTitle,
    companyName: application.companyName,
    appliedAt: formatDateTime(application.appliedAt),
    updatedAt: formatDateTime(application.updatedAt),
    status: application.status,
  };
}

function mapNotification(notification: NotificationResponse): CandidateDashboardNotification {
  return {
    id: String(notification.id),
    title: notification.title,
    body: notification.message,
    createdAt: formatDateTime(notification.createdAt),
    read: notification.isRead,
    targetPath: resolveNotificationPath(notification),
  };
}

function resolveNotificationPath(notification: NotificationResponse) {
  if (notification.referenceType === "APPLICATION" && notification.referenceId) {
    return `/candidate/applications/${notification.referenceId}`;
  }
  if (notification.referenceType === "JOB" && notification.referenceId) {
    return `/candidate/jobs/${notification.referenceId}`;
  }
  return "/candidate/notifications";
}

function buildMissingProfileItems(student: StudentResponse, profile: StudentProfileResponse) {
  return [
    !student.fullName ? { id: "name", label: "Họ tên", path: "/candidate/profile/edit?section=personal" } : null,
    !student.location && !profile.preferredLocation ? { id: "location", label: "Địa điểm", path: "/candidate/profile/edit?section=personal" } : null,
    !profile.summary ? { id: "summary", label: "Giới thiệu", path: "/candidate/profile/edit?section=summary" } : null,
    !profile.education ? { id: "education", label: "Học vấn", path: "/candidate/profile/edit?section=education" } : null,
    !profile.experience ? { id: "experience", label: "Kinh nghiệm", path: "/candidate/profile/edit?section=experience" } : null,
    !profile.targetPosition ? { id: "target", label: "Vị trí mong muốn", path: "/candidate/profile/preferences" } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function calculateProfileCompletion(student: StudentResponse, profile: StudentProfileResponse) {
  const values = [
    student.fullName,
    student.location,
    student.headline,
    profile.summary,
    profile.education,
    profile.experience,
    profile.projects,
    profile.targetPosition,
  ];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

function formatSalary(job: Pick<JobResponse, "salaryMin" | "salaryMax" | "currency">) {
  const currency = "đồng";
  const min = toNumber(job.salaryMin);
  const max = toNumber(job.salaryMax);
  if (min && max) return `${formatMoney(min)} - ${formatMoney(max)} ${currency}`;
  if (min) return `Từ ${formatMoney(min)} ${currency}`;
  if (max) return `Đến ${formatMoney(max)} ${currency}`;
  return "Thỏa thuận";
}

function getJobTypeLabel(value: JobResponse["jobType"]) {
  if (value === "FULL_TIME") return "Toàn thời gian";
  if (value === "PART_TIME") return "Bán thời gian";
  if (value === "INTERNSHIP") return "Thực tập";
  if (value === "CONTRACT") return "Hợp đồng";
  return "Chưa cập nhật";
}

function mapWorkingModel(value: JobResponse["workingModel"]): Job["workMode"] {
  if (value === "REMOTE") return "Remote";
  if (value === "HYBRID") return "Hybrid";
  return "Onsite";
}

function toNumber(value: number | string | null) {
  if (value === null) return 0;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
