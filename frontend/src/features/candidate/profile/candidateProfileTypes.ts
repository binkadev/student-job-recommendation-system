export type PreferredWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";

export const WORKING_MODEL_LABELS: Record<PreferredWorkingModel, string> = {
  ONSITE: "Tại văn phòng",
  HYBRID: "Kết hợp",
  REMOTE: "Từ xa",
};

export interface CandidateProfileHeader {
  avatar: string;
  name: string;
  birthDate: string;
  currentTitle: string;
  location: string;
  address: string;
  email: string;
  phone: string;
  availability: string;
  preferredJobType?: string | null;
  completion: number;
}

export interface CandidateExperience {
  id: string;
  company: string;
  position: string;
  period: string;
  description: string;
  achievements: string[];
  technologies: string[];
}

export interface CandidateEducation {
  id: string;
  school: string;
  major: string;
  degree: string;
  period: string;
  gpa: string;
}

export interface CandidateSkill {
  id: string;
  skillId?: number;
  name: string;
  level: string;
  years: number;
  source?: string;
  storedYears?: number | null;
}

export interface CandidateCertificate {
  id: string;
  name: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  code: string;
  url: string;
}

export interface CandidateProject {
  id: string;
  name: string;
  role: string;
  period: string;
  description: string;
  technologies: string[];
  url: string;
}

export interface CandidateLanguage {
  id: string;
  name: string;
  level: string;
}

export interface CandidateProfileLinks {
  linkedIn: string;
  github: string;
  portfolio: string;
  website: string;
}

export interface CandidateProfileData {
  revision?: number;
  baseline?: { student: Record<string, string | number | null>; profile: Record<string, string | number | null>; manualSkills: string; certificates?: string; languages?: string };
  /** Exact editable scalar fields; Backend stores these sections as plain text. */
  record?: {
    gpa?: number | null;
    educationLevel?: string | null;
    preferredWorkingModel?: PreferredWorkingModel | null;
    major: string | null;
    university: string | null;
    graduationYear: number | null;
    education: string | null;
    experience: string | null;
    projects: string | null;
    preferredLocation: string | null;
  };
  header: CandidateProfileHeader;
  summary: string;
  careerGoal: string;
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  skills: {
    frontend: CandidateSkill[];
    backend: CandidateSkill[];
    tools: CandidateSkill[];
    soft: CandidateSkill[];
  };
  certificates: CandidateCertificate[];
  projects: CandidateProject[];
  languages: CandidateLanguage[];
  links: CandidateProfileLinks;
}
