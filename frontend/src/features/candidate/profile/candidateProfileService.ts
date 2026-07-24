import { httpClient } from "../../../services/api/httpClient";
import type { CandidateProfileData, CandidateSkill } from "./candidateProfileTypes";

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
  userId: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  studentCode: string | null;
  major: string | null;
  university: string | null;
  graduationYear: number | null;
  location: string | null;
  headline: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StudentProfileResponse {
  id: number;
  studentId: number;
  headline: string | null;
  summary: string | null;
  education: string | null;
  experience: string | null;
  projects: string | null;
  targetPosition: string | null;
  preferredLocation: string | null;
  preferredJobType: BackendJobType | null;
  rawText: string | null;
  processedText: string | null;
  profileCompleteness: number | null;
  updatedAt: string | null;
}

interface StudentSkillResponse {
  studentSkillId: number;
  skillId: number;
  skillName: string;
  normalizedName: string;
  category: string | null;
  proficiencyLevel: BackendSkillLevel;
  yearsOfExperience: number | string | null;
  source: BackendSkillSource;
}

interface SkillResponse {
  id: number;
  name: string;
  normalizedName: string;
  category: string | null;
  description: string | null;
}

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendSkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
type BackendSkillSource = "MANUAL" | "CV_EXTRACTED" | "ADMIN_SEEDED";
type SkillGroup = keyof CandidateProfileData["skills"];

const JOB_TYPE_LABELS: Record<BackendJobType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  CONTRACT: "Hợp đồng",
};

const LEVEL_LABELS: Record<BackendSkillLevel, string> = {
  BEGINNER: "Cơ bản",
  INTERMEDIATE: "Khá",
  ADVANCED: "Tốt",
};

const LEVEL_VALUES: Record<string, BackendSkillLevel> = {
  "co ban": "BEGINNER",
  "beginner": "BEGINNER",
  "kha": "INTERMEDIATE",
  "intermediate": "INTERMEDIATE",
  "tot": "ADVANCED",
  "advanced": "ADVANCED",
};

export async function getCandidateProfileData(): Promise<CandidateProfileData> {
  const [studentResponse, profileResponse, skillsResponse] = await Promise.all([
    httpClient.get<ApiResponse<StudentResponse>>("/students/me"),
    httpClient.get<ApiResponse<StudentProfileResponse>>("/students/me/profile"),
    httpClient.get<ApiResponse<StudentSkillResponse[]>>("/students/me/skills"),
  ]);

  return mapCandidateProfile(
    studentResponse.data.data,
    profileResponse.data.data,
    skillsResponse.data.data,
  );
}

export async function updateCandidateProfileData(profile: CandidateProfileData): Promise<CandidateProfileData> {
  const studentPayload = {
    fullName: emptyToNull(profile.header.name),
    phone: emptyToNull(profile.header.phone),
    location: emptyToNull(profile.header.location),
    headline: emptyToNull(profile.header.currentTitle),
    major: firstEducation(profile)?.major ?? null,
    university: firstEducation(profile)?.school ?? null,
    graduationYear: extractGraduationYear(firstEducation(profile)?.period),
  };

  const profilePayload = {
    summary: emptyToNull(profile.summary),
    education: profile.education.length ? serializeEducation(profile.education) : null,
    experience: profile.experiences.length ? serializeExperiences(profile.experiences) : null,
    projects: profile.projects.length ? serializeProjects(profile.projects) : null,
    targetPosition: emptyToNull(profile.header.currentTitle || profile.careerGoal.slice(0, 255)),
    preferredLocation: emptyToNull(profile.header.location),
    preferredJobType: null as BackendJobType | null,
  };

  await httpClient.put<ApiResponse<StudentResponse>>("/students/me", studentPayload);
  await httpClient.put<ApiResponse<StudentProfileResponse>>("/students/me/profile", profilePayload);
  await updateStudentSkills(profile);

  return getCandidateProfileData();
}

function mapCandidateProfile(
  student: StudentResponse,
  profile: StudentProfileResponse,
  skills: StudentSkillResponse[],
): CandidateProfileData {
  const name = student.fullName || student.email || "Ứng viên";
  const currentTitle = student.headline || profile.targetPosition || profile.headline || "";
  const location = student.location || profile.preferredLocation || "";
  const educationText = profile.education || "";
  const experienceText = profile.experience || "";
  const projectsText = profile.projects || "";

  return {
    header: {
      avatar: getInitials(name),
      name,
      birthDate: "",
      currentTitle,
      location,
      address: location,
      email: student.email,
      phone: student.phone || "",
      availability: profile.preferredJobType ? JOB_TYPE_LABELS[profile.preferredJobType] : "Đang cập nhật",
      completion: profile.profileCompleteness ?? calculateProfileCompleteness(student, profile, skills),
    },
    summary: profile.summary || "",
    careerGoal: profile.targetPosition || currentTitle,
    experiences: experienceText ? [{
      id: "experience-backend",
      company: "Thông tin hồ sơ",
      position: "Kinh nghiệm",
      period: "Cập nhật từ backend",
      description: experienceText,
      achievements: [],
      technologies: [],
    }] : [],
    education: educationText || student.university || student.major ? [{
      id: "education-backend",
      school: student.university || "Thông tin học vấn",
      major: student.major || educationText,
      degree: student.graduationYear ? `Tốt nghiệp ${student.graduationYear}` : "",
      period: student.graduationYear ? `${student.graduationYear}` : "",
      gpa: "",
    }] : [],
    skills: groupStudentSkills(skills),
    certificates: [],
    projects: projectsText ? [{
      id: "project-backend",
      name: "Dự án",
      role: currentTitle || "Ứng viên",
      period: "Cập nhật từ backend",
      description: projectsText,
      technologies: [],
      url: "",
    }] : [],
    languages: [],
    links: {
      linkedIn: "",
      github: "",
      portfolio: "",
      website: "",
    },
  };
}

async function updateStudentSkills(profile: CandidateProfileData) {
  const skills = flattenSkills(profile);
  if (!skills.length) {
    await httpClient.put<ApiResponse<StudentSkillResponse[]>>("/students/me/skills", { skills: [] });
    return;
  }

  const catalogResponse = await httpClient.get<ApiResponse<PageResponse<SkillResponse>>>("/skills", {
    params: { page: 1, size: 100 },
  });
  const catalog = catalogResponse.data.data.items;
  const payloadSkills = skills
    .map((skill) => {
      const skillId = skill.skillId ?? findSkillId(skill, catalog);
      if (!skillId) return null;
      return {
        skillId,
        proficiencyLevel: mapSkillLevel(skill.level),
        yearsOfExperience: Number.isFinite(skill.years) ? skill.years : 0,
        source: (skill.source as BackendSkillSource | undefined) ?? "MANUAL",
      };
    })
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

  await httpClient.put<ApiResponse<StudentSkillResponse[]>>("/students/me/skills", { skills: payloadSkills });
}

function groupStudentSkills(skills: StudentSkillResponse[]): CandidateProfileData["skills"] {
  return skills.reduce<CandidateProfileData["skills"]>((groups, skill) => {
    groups[getSkillGroup(skill.category)].push({
      id: String(skill.studentSkillId),
      skillId: skill.skillId,
      name: skill.skillName,
      level: LEVEL_LABELS[skill.proficiencyLevel] ?? skill.proficiencyLevel,
      years: Number(skill.yearsOfExperience ?? 0),
      source: skill.source,
    });
    return groups;
  }, { frontend: [], backend: [], tools: [], soft: [] });
}

function getSkillGroup(category: string | null): SkillGroup {
  const value = normalize(category ?? "");
  if (value.includes("front")) return "frontend";
  if (value.includes("back")) return "backend";
  if (value.includes("soft") || value.includes("mem")) return "soft";
  return "tools";
}

function flattenSkills(profile: CandidateProfileData): CandidateSkill[] {
  return [
    ...profile.skills.frontend,
    ...profile.skills.backend,
    ...profile.skills.tools,
    ...profile.skills.soft,
  ];
}

function findSkillId(skill: CandidateSkill, catalog: SkillResponse[]) {
  const normalizedName = normalize(skill.name);
  const match = catalog.find((item) => normalize(item.name) === normalizedName || normalize(item.normalizedName) === normalizedName);
  return match?.id;
}

function mapSkillLevel(value: string): BackendSkillLevel {
  return LEVEL_VALUES[normalize(value)] ?? "BEGINNER";
}

function serializeExperiences(items: CandidateProfileData["experiences"]) {
  return items
    .map((item) => [item.position, item.company, item.period, item.description].filter(Boolean).join(" - "))
    .join("\n");
}

function serializeEducation(items: CandidateProfileData["education"]) {
  return items
    .map((item) => [item.school, item.major, item.degree, item.period, item.gpa ? `GPA ${item.gpa}` : ""].filter(Boolean).join(" - "))
    .join("\n");
}

function serializeProjects(items: CandidateProfileData["projects"]) {
  return items
    .map((item) => [item.name, item.role, item.period, item.description].filter(Boolean).join(" - "))
    .join("\n");
}

function firstEducation(profile: CandidateProfileData) {
  return profile.education[0];
}

function extractGraduationYear(period?: string) {
  const match = period?.match(/\b(19\d{2}|20\d{2}|2100)\b/g);
  if (!match?.length) return null;
  return Number(match[match.length - 1]);
}

function calculateProfileCompleteness(student: StudentResponse, profile: StudentProfileResponse, skills: StudentSkillResponse[]) {
  const values = [
    student.fullName,
    student.phone,
    student.major,
    student.university,
    student.location,
    student.headline,
    profile.summary,
    profile.education,
    profile.experience,
    profile.projects,
    profile.targetPosition,
    profile.preferredLocation,
    skills.length ? "skills" : "",
  ];
  return Math.round((values.filter(Boolean).length / values.length) * 100);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "UV";
}

function emptyToNull(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
