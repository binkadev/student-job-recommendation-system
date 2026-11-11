import { httpClient } from "../../../services/api/httpClient";

export const COMPANY_DOCUMENT_ENDPOINT = "/companies/me/verification-document";
export const VERIFICATION_FILE_LIMIT = 5 * 1024 * 1024;
export interface VerificationDocumentSnapshot { submitted: boolean; revision: number; etag: string }
interface Envelope { success: boolean; data: { submitted: boolean; revision: number } }

export function adminDocumentEndpoint(companyId: number) {
  if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error("Công ty không hợp lệ.");
  return `/admin/companies/${companyId}/verification-document`;
}
function snapshot(data: Envelope, etag: unknown): VerificationDocumentSnapshot {
  const value = data?.data;
  if (!data?.success || typeof value?.submitted !== "boolean" || !Number.isSafeInteger(value?.revision) || value.revision < 0 || etag !== `"${value.revision}"`)
    throw new Error("Không xác nhận được phiên bản tài liệu. Hãy tải lại trạng thái trước khi gửi.");
  return { submitted: value.submitted, revision: value.revision, etag: etag as string };
}
export async function getVerificationDocument(endpoint: string, signal?: AbortSignal) {
  const response = await httpClient.get<Envelope>(endpoint, { signal });
  return snapshot(response.data, response.headers?.etag);
}
export function verificationFileError(file: File) {
  if (!file.size) return "Tệp đang trống. Vui lòng chọn PDF, PNG hoặc JPEG có nội dung.";
  if (file.size > VERIFICATION_FILE_LIMIT) return "Tệp tối đa 5 MiB (5.242.880 byte).";
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || (file.type && !["application/pdf", "image/png", "image/jpeg"].includes(file.type))) return "Chỉ chấp nhận tệp PDF, PNG hoặc JPEG.";
  return "";
}
export async function uploadVerificationDocument(file: File, captured: VerificationDocumentSnapshot, signal?: AbortSignal) {
  const invalid = verificationFileError(file);
  if (invalid) throw new Error(invalid);
  const body = new FormData(); body.append("file", file);
  const response = await httpClient.put<Envelope>(COMPANY_DOCUMENT_ENDPOINT, body, {
    // Remove the client's JSON default; the browser supplies multipart with its boundary.
    headers: { "Content-Type": null, "If-Match": captured.etag }, signal,
  });
  return snapshot(response.data, response.headers?.etag);
}
export async function downloadVerificationDocument(endpoint: string, signal?: AbortSignal) {
  const response = await httpClient.get<Blob>(`${endpoint}/file`, { responseType: "blob", signal });
  if (signal?.aborted) return;
  const blob = response.data;
  if (!(blob instanceof Blob)) throw new Error("Phản hồi tải tài liệu không hợp lệ.");
  const contentType = response.headers?.["content-type"];
  const type = (typeof contentType === "string" ? contentType : blob.type).split(";")[0].trim().toLowerCase();
  const extension = ({ "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" } as Record<string, string>)[type];
  if (!blob.size || blob.size > VERIFICATION_FILE_LIMIT || !extension) throw new Error("Phản hồi tải tài liệu không hợp lệ.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `tai-lieu-xac-thuc.${extension}`;
  try { document.body.appendChild(link); link.click(); }
  finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export function verificationRequestError(error: unknown, fallback: string) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403) return "Bạn không có quyền truy cập tài liệu này hoặc phiên đăng nhập đã hết hạn.";
  if (status === 404) return "Không tìm thấy tài liệu. Tệp có thể chưa được gửi hoặc hiện không còn khả dụng.";
  if (status === 413) return "Tệp vượt quá giới hạn 5 MiB.";
  if (status === 400) return "Tệp hoặc yêu cầu không hợp lệ. Hãy chọn PDF, PNG hoặc JPEG hợp lệ rồi thử lại.";
  return fallback;
}
