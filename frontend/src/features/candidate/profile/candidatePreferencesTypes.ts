export interface CandidateCareerPreferences {
  desiredPositions: string[];
  industries: string[];
  levels: string[];
  salaryMin: number;
  salaryMax: number;
  currency: "VND" | "USD";
  locations: string[];
  jobTypes: string[];
  workModes: string[];
  availableFrom: string;
  willingToTravel: boolean;
  willingToRelocate: boolean;
  internationalRemote: boolean;
  excludedKeywords: string[];
}

export interface CandidatePreferencesOptions {
  industries: string[];
  levels: string[];
  locations: string[];
  jobTypes: string[];
  workModes: string[];
  currencies: Array<"VND" | "USD">;
}
