import { httpClient } from "../../../services/api/httpClient";

export type ApplicationStatus = "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  PENDING: "Chờ xử lý", REVIEWED: "Đã xem", ACCEPTED: "Đã nhận", REJECTED: "Từ chối", WITHDRAWN: "Ứng viên rút đơn",
};
export interface SavedCandidate {
  id: number; applicationId: number; applicationStatus: ApplicationStatus; revision: number;
  studentId: number; studentName: string | null; studentEmail: string | null;
  university: string | null; major: string | null; headline: string | null;
  jobId: number; jobTitle: string; cvFileId: number | null; cvFileName: string | null;
  note: string | null; savedAt: string; updatedAt: string;
}
export interface SavedCandidatePage { items: SavedCandidate[]; page: number; size: number; totalItems: number; totalPages: number }
export async function listSavedCandidates(params: { page: number; size: number; keyword?: string; applicationStatus?: string; jobId?: string; studentId?: number }) {
  return (await httpClient.get<{ data: SavedCandidatePage }>("/companies/me/saved-candidates", { params })).data.data;
}
export async function updateSavedNote(candidate: SavedCandidate, note: string) {
  return (await httpClient.patch<{ data: SavedCandidate }>(`/companies/me/saved-candidates/${candidate.id}/note`, { note, revision: candidate.revision })).data.data;
}
export async function removeSavedCandidate(id: number) {
  await httpClient.delete(`/companies/me/saved-candidates/${id}`);
}
