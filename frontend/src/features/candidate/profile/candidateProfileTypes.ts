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
