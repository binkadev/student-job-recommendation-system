import { httpClient } from "../../../services/api/httpClient";
import type { CandidateCertificate, CandidateLanguage, CandidateProfileData, CandidateSkill, PreferredWorkingModel } from "./candidateProfileTypes";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
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
  certificates: Array<{ name: string; issuer: string | null; issuedAt: string | null; expiresAt: string | null; code: string | null; url: string | null }> | null;
  languages: Array<{ name: string; level: string }> | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  gpa: number | null;
  educationLevel: string | null;
  preferredWorkingModel: PreferredWorkingModel | null;
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
  const response = await httpClient.get<ApiResponse<Aggregate>>("/students/me/profile-aggregate");
  return fromAggregate(response.data.data);
}

interface Aggregate { revision: number; student: StudentResponse; profile: StudentProfileResponse; skills: StudentSkillResponse[] }
function fromAggregate(data: Aggregate) { return mapCandidateProfile(data.student, data.profile, data.skills, data.revision); }

export function isProfileConflict(error: unknown) {
  return (error as { response?: { status?: number; data?: { errorCode?: string } } })?.response?.data?.errorCode === "PROFILE_REVISION_CONFLICT";
}

export async function updateCandidateProfileData(profile: CandidateProfileData): Promise<CandidateProfileData> {
  if (!profile.record || !profile.baseline || !Number.isSafeInteger(profile.revision)) throw new Error("Hãy tải lại hồ sơ trước khi lưu để bảo toàn dữ liệu hiện có.");
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
    // Nullable academic/preference fields are cleared explicitly through clearFields.
    githubUrl: profile.links.github.trim() || null,
    linkedinUrl: profile.links.linkedIn.trim() || null,
    portfolioUrl: profile.links.portfolio.trim() || null,
    gpa: profile.record.gpa ?? null,
    educationLevel: profile.record.educationLevel?.trim() || null,
    preferredWorkingModel: profile.record.preferredWorkingModel ?? null,
    summary: profile.summary.trim(),
    education: profile.record.education ?? "",
    experience: profile.record.experience ?? "",
    projects: profile.record.projects ?? "",
    targetPosition: profile.careerGoal.trim(),
    preferredLocation: profile.record.preferredLocation ?? "",
    preferredJobType: normalizeJobType(profile.header.preferredJobType),
  };

  const manualSkills = buildStudentSkillsPayload(profile, []);
  const certificates = certificatePayload(profile.certificates);
  const languages = languagePayload(profile.languages);
  const certificatesChanged = JSON.stringify(certificates) !== profile.baseline.certificates;
  const languagesChanged = JSON.stringify(languages) !== profile.baseline.languages;
  const clearFields = [
    ...(["gpa", "educationLevel", "preferredWorkingModel", "githubUrl", "linkedinUrl", "portfolioUrl"] as const).filter((key) => profilePayload[key] == null && profile.baseline!.profile[key] != null),
    ...(certificatesChanged && !certificates.length ? ["certificates"] : []),
    ...(languagesChanged && !languages.length ? ["languages"] : []),
    ...(studentPayload.graduationYear == null && profile.baseline.student.graduationYear != null ? ["graduationYear"] : []),
    ...(profilePayload.preferredJobType == null && profile.baseline.profile.preferredJobType != null ? ["preferredJobType"] : []),
  ];
  const response = await httpClient.put<ApiResponse<Aggregate>>("/students/me/profile-aggregate", {
    revision: profile.revision,
    student: changedFields(studentPayload, profile.baseline.student),
    profile: changedFields(profilePayload, profile.baseline.profile),
    ...(JSON.stringify(manualSkills) !== profile.baseline.manualSkills ? { manualSkills } : {}),
    ...(certificatesChanged && certificates.length ? { certificates } : {}),
    ...(languagesChanged && languages.length ? { languages } : {}),
    ...(clearFields.length ? { clearFields } : {}),
  });
  return fromAggregate(response.data.data);
}

function changedFields(values: Record<string, string | number | null>, baseline: Record<string, string | number | null>) {
  const comparable = (value: string | number | null | undefined) => typeof value === "string" ? value.trim() : value ?? "";
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== null && comparable(value) !== comparable(baseline[key])));
}

function mapCandidateProfile(
  student: StudentResponse,
  profile: StudentProfileResponse,
  skills: StudentSkillResponse[],
  revision: number,
): CandidateProfileData {
  const name = student.fullName || student.email || "Ứng viên";
  const currentTitle = student.headline ?? "";
  const location = student.location ?? "";
  const educationText = profile.education || "";
  const experienceText = profile.experience || "";
  const projectsText = profile.projects || "";

  const { certificates, languages, ...profileScalars } = profile;
  const mapped: CandidateProfileData = {
    revision,
    record: {
      gpa: profile.gpa ?? null,
      educationLevel: profile.educationLevel ?? null,
      preferredWorkingModel: profile.preferredWorkingModel ?? null,
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
    certificates: (certificates ?? []).map((item, index) => ({
      id: `certificate-${index}`, name: item.name, issuer: item.issuer ?? "", issuedAt: item.issuedAt ?? "",
      expiresAt: item.expiresAt ?? "", code: item.code ?? "", url: item.url ?? "",
    })),
    projects: projectsText ? [{
      id: "project-backend",
      name: "Dự án",
      role: currentTitle || "Ứng viên",
      period: "Cập nhật từ backend",
      description: projectsText,
      technologies: [],
      url: "",
    }] : [],
    languages: (languages ?? []).map((item, index) => ({ ...item, id: `language-${index}` })),
    links: {
      linkedIn: profile.linkedinUrl ?? "",
      github: profile.githubUrl ?? "",
      portfolio: profile.portfolioUrl ?? "",
      website: "",
    },
  };
  mapped.baseline = { student: { ...student }, profile: { ...profileScalars }, manualSkills: JSON.stringify(buildStudentSkillsPayload(mapped, [])), certificates: JSON.stringify(certificatePayload(mapped.certificates)), languages: JSON.stringify(languagePayload(mapped.languages)) };
  return mapped;
}

export function buildStudentSkillsPayload(profile: Pick<CandidateProfileData, "skills">, catalog: CandidateSkillCatalogItem[]) {
  return flattenSkillGroups(profile)
    .filter((skill) => !skill.source || skill.source === "MANUAL")
    .map((skill) => {
      const skillId = skill.skillId ?? findSkillId(skill, catalog);
      const common = {
        proficiencyLevel: mapSkillLevel(skill.level),
        yearsOfExperience: skill.years === 0 && skill.storedYears === null ? null : Number.isFinite(skill.years) ? skill.years : 0,
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
      storedYears: skill.yearsOfExperience == null ? null : Number(skill.yearsOfExperience),
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

function certificatePayload(items: CandidateCertificate[]) {
  return items.map((item) => ({ name: item.name, issuer: item.issuer || null, issuedAt: item.issuedAt || null,
    expiresAt: item.expiresAt || null, code: item.code || null, url: item.url.trim() || null }));
}
function languagePayload(items: CandidateLanguage[]) {
  return items.map((item) => ({ name: item.name, level: item.level }));
}
