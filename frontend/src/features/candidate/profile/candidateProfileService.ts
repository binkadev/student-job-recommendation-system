import { httpClient } from "../../../services/api/httpClient";
import { getApiErrorMessage } from "../../../utils/apiErrors";
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

export interface CandidateSkillCatalogItem {
  id: number;
  name: string;
  normalizedName: string;
  category: string | null;
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
  if (!profile.record) throw new Error("Hãy tải lại hồ sơ trước khi lưu để bảo toàn dữ liệu hiện có.");
  const studentPayload = {
    fullName: profile.header.name.trim(),
    phone: profile.header.phone.trim(),
    location: profile.header.location.trim(),
    headline: profile.header.currentTitle.trim(),
    major: profile.record.major ?? "",
    university: profile.record.university ?? "",
    graduationYear: profile.record.graduationYear,
  };

  const profilePayload = {
    // This API treats null as "keep existing" and an empty string as "clear".
    summary: profile.summary.trim(),
    education: profile.record.education ?? "",
    experience: profile.record.experience ?? "",
    projects: profile.record.projects ?? "",
    targetPosition: profile.careerGoal.trim(),
    preferredLocation: profile.record.preferredLocation ?? "",
    preferredJobType: normalizeJobType(profile.header.preferredJobType),
  };

  // Resolve catalog reads before the first write. The three existing APIs are not atomic.
  const catalog = flattenSkillGroups(profile).length ? await getCandidateSkillCatalog() : [];
  const payloadSkills = buildStudentSkillsPayload(profile, catalog);
  let completedWrites = 0;
  try {
    await httpClient.put<ApiResponse<StudentResponse>>("/students/me", studentPayload);
    completedWrites++;
    await httpClient.put<ApiResponse<StudentProfileResponse>>("/students/me/profile", profilePayload);
    completedWrites++;
    await httpClient.put<ApiResponse<StudentSkillResponse[]>>("/students/me/skills", { skills: payloadSkills });
    completedWrites++;
    return await getCandidateProfileData();
  } catch (error) {
    const context = completedWrites === 3
      ? "Các yêu cầu lưu đã thành công nhưng chưa tải lại được hồ sơ. Hãy tải lại trước khi sửa tiếp."
      : completedWrites > 0
        ? "Một phần hồ sơ đã được lưu. Hãy kiểm tra lại dữ liệu trước khi thử lại."
        : "Chưa lưu được hồ sơ.";
    throw new Error(`${context} ${getApiErrorMessage(error)}`);
  }
}

async function getCandidateSkillCatalog(): Promise<CandidateSkillCatalogItem[]> {
  const response = await httpClient.get<ApiResponse<PageResponse<SkillResponse>>>("/skills", {
    params: { page: 1, size: 200 },
  });
  return response.data.data.items.map((skill) => ({
    id: skill.id,
    name: skill.name,
    normalizedName: skill.normalizedName,
    category: skill.category,
  }));
}

function mapCandidateProfile(
  student: StudentResponse,
  profile: StudentProfileResponse,
  skills: StudentSkillResponse[],
): CandidateProfileData {
  const name = student.fullName || student.email || "Ứng viên";
  const currentTitle = student.headline ?? "";
  const location = student.location ?? "";
  const educationText = profile.education || "";
  const experienceText = profile.experience || "";
  const projectsText = profile.projects || "";

  return {
    record: {
      major: student.major,
      university: student.university,
      graduationYear: student.graduationYear,
      education: profile.education,
      experience: profile.experience,
      projects: profile.projects,
      preferredLocation: profile.preferredLocation,
    },
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
      preferredJobType: profile.preferredJobType,
      completion: profile.profileCompleteness ?? calculateProfileCompleteness(student, profile, skills),
    },
    summary: profile.summary || "",
    careerGoal: profile.targetPosition ?? "",
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

export function buildStudentSkillsPayload(profile: Pick<CandidateProfileData, "skills">, catalog: CandidateSkillCatalogItem[]) {
  return flattenSkillGroups(profile)
    .map((skill) => {
      const skillId = skill.skillId ?? findSkillId(skill, catalog);
      const common = {
        proficiencyLevel: mapSkillLevel(skill.level),
        yearsOfExperience: Number.isFinite(skill.years) ? skill.years : 0,
        source: (skill.source as BackendSkillSource | undefined) ?? "MANUAL",
      };
      if (skillId) return { skillId, ...common };
      const skillName = skill.name.trim();
      if (!skillName) return null;
      return { skillName, category: categoryForSkillGroup(skill.group), ...common, source: "MANUAL" as const };
    })
    .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill));

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

function flattenSkillGroups(profile: Pick<CandidateProfileData, "skills">) {
  return (Object.entries(profile.skills) as Array<[SkillGroup, CandidateSkill[]]>).flatMap(([group, skills]) => skills.map((skill) => ({ ...skill, group })));
}

function categoryForSkillGroup(group: SkillGroup) {
  if (group === "frontend") return "Frontend";
  if (group === "backend") return "Backend";
  if (group === "soft") return "Soft Skills";
  return "Tools";
}

function findSkillId(skill: CandidateSkill, catalog: Array<Pick<SkillResponse, "id" | "name" | "normalizedName">>) {
  const normalizedName = normalize(skill.name);
  const match = catalog.find((item) => normalize(item.name) === normalizedName || normalize(item.normalizedName) === normalizedName);
  return match?.id;
}

function mapSkillLevel(value: string): BackendSkillLevel {
  return LEVEL_VALUES[normalize(value)] ?? "BEGINNER";
}

function normalizeJobType(value?: string | null): BackendJobType | null {
  if (value === "FULL_TIME" || value === "PART_TIME" || value === "INTERNSHIP" || value === "CONTRACT") return value;
  return null;
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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
