export type EntityStatus = "active" | "inactive" | "pending" | "approved" | "rejected" | "draft" | "closed";

export type JobStatus = "draft" | "pending" | "published" | "paused" | "expired" | "rejected" | "closed";
export type ApplicationStatus =
  | "submitted"
  | "viewed"
  | "reviewing"
  | "shortlisted"
  | "interview"
  | "interviewed"
  | "offer"
  | "rejected"
  | "withdrawn";
export type CvStatus = "uploaded" | "analyzing" | "analyzed" | "failed" | "needs_confirmation";
export type InterviewStatus = "pending" | "confirmed" | "declined" | "reschedule_requested" | "completed";
export type NotificationType = "job" | "application" | "interview" | "cv" | "system" | "invitation" | "message";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: "candidate" | "recruiter" | "admin";
  status: EntityStatus;
  createdAt: string;
  lastLoginAt: string;
}

export interface Company {
  id: string;
  name: string;
  logo: string;
  cover: string;
  industry: string;
  size: string;
  location: string;
  website: string;
  address: string;
  description: string;
  benefits: string[];
  openJobs: number;
  verified: boolean;
  status: EntityStatus;
}

export interface Job {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  location: string;
  salary: string;
  industry: string;
  experience: string;
  jobType: string;
  workMode: "Onsite" | "Hybrid" | "Remote";
  level: string;
  skills: string[];
  description: string;
  requirements: string[];
  benefits: string[];
  deadline: string;
  postedAt: string;
  status: JobStatus;
  views: number;
  applicants: number;
  matchScore?: number;
}

export interface Candidate {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  avatar: string;
  desiredPosition: string;
  desiredSalary: string;
  experienceYears: number;
  skills: string[];
  education: string;
  summary: string;
  profileCompletion: number;
  availability: string;
  status: EntityStatus;
}

export interface Recruiter {
  id: string;
  userId: string;
  name: string;
  email: string;
  companyId: string;
  roleTitle: string;
  status: EntityStatus;
}

export interface Cv {
  id: string;
  candidateId: string;
  fileName: string;
  uploadedAt: string;
  status: CvStatus;
  score: number;
  isDefault: boolean;
  isPublic: boolean;
  extractedSkills: string[];
  missingFields: string[];
  warnings: string[];
}

export interface Application {
  id: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  cvId: string;
  cvName: string;
  coverLetter: string;
  appliedAt: string;
  status: ApplicationStatus;
  timeline: Array<{ label: string; at: string; note: string }>;
}

export interface Interview {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  startsAt: string;
  endsAt: string;
  mode: "Online" | "Offline";
  locationOrLink: string;
  interviewer: string;
  status: InterviewStatus;
  note: string;
}

export interface Invitation {
  id: string;
  candidateId: string;
  recruiterId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  message: string;
  sentAt: string;
  status: "pending" | "accepted" | "declined";
}

export interface Message {
  id: string;
  conversationId: string;
  senderName: string;
  body: string;
  sentAt: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participantName: string;
  participantRole: "candidate" | "recruiter" | "admin";
  subject: string;
  unreadCount: number;
  messages: Message[];
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  targetPath: string;
}

export interface Report {
  id: string;
  type: string;
  reporter: string;
  target: string;
  content: string;
  status: "new" | "processing" | "resolved" | "rejected";
  createdAt: string;
  handler?: string;
}

export interface CategoryItem {
  id: string;
  type: "industry" | "jobTitle" | "skill" | "location" | "jobType" | "experienceLevel";
  name: string;
  order: number;
  active: boolean;
}

export interface AnalyticsPoint {
  label: string;
  users: number;
  jobs: number;
  applications: number;
  cvs: number;
}
