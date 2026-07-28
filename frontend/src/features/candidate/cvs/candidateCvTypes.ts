export type CandidateCvAnalysisStatus = "success" | "analyzing" | "failed";

export interface CandidateCvItem {
  id: string;
  fileName: string;
  fileType: "PDF" | "DOCX";
  size: string;
  uploadedAt: string;
  updatedAt: string;
  status: CandidateCvAnalysisStatus;
  score: number;
  isDefault: boolean;
  isPublic: boolean;
  recruiterViews: number;
  extractedSkills: string[];
  missingFields: string[];
  warnings: string[];
  analysisConfirmed?: boolean;
}
