import { httpClient } from "../../services/api/httpClient";

export type RecruitingRole = "candidate" | "recruiter";
export type Kind = "interviews" | "invitations";
export type InterviewStatus = "SCHEDULED" | "CONFIRMED" | "DECLINED" | "COMPLETED" | "CANCELLED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
export type RecordStatus = InterviewStatus | InvitationStatus;
interface RecordBase { id: number; companyId: number; studentId: number; jobId: number; createdAt: string; updatedAt: string }
export interface Interview extends RecordBase {
  applicationId: number; title: string; scheduledAt: string; durationMinutes: number;
  meetingType: "ONLINE" | "ONSITE"; locationOrLink: string; notes: string | null; status: InterviewStatus;
}
export interface Invitation extends RecordBase { message: string | null; status: InvitationStatus }
export type RecruitingRecord = Interview | Invitation;
export interface Page<T> { items: T[]; page: number; size: number; totalItems: number; totalPages: number }
interface Envelope<T> { success: boolean; data: T }
export interface ApplicationRef { id: number; studentId: number; studentName: string | null; jobId: number; jobTitle: string; status: string }
export interface JobRef { id: number; title: string; status: string; deadline: string | null }
export interface CreateInterview {
  applicationId: number; title: string; scheduledAt: string; durationMinutes: number;
  meetingType: "ONLINE" | "ONSITE"; locationOrLink: string; notes: string | null;
}
export interface CreateInvitation { studentId: number; jobId: number; message: string | null }
function unwrap<T>(body: Envelope<T>): T {
  if (!body?.success || body.data == null) throw new Error("Phản hồi không hợp lệ. Hãy tải lại dữ liệu.");
  return body.data;
}
function checkedPage<T>(body: Envelope<Page<T>>) {
  const result = unwrap(body);
  if (!Array.isArray(result.items) || !Number.isSafeInteger(result.page) || result.page < 1
      || !Number.isSafeInteger(result.size) || result.size < 1 || result.size > 100
      || !Number.isSafeInteger(result.totalPages) || result.totalPages < 0
      || !Number.isSafeInteger(result.totalItems) || result.totalItems < 0)
    throw new Error("Không xác nhận được danh sách. Hãy tải lại dữ liệu.");
  return result;
}
export function endpoint(role: RecruitingRole, kind: Kind) { return `/${role === "recruiter" ? "companies" : "students"}/me/${kind}`; }
export async function listRecords(role: RecruitingRole, kind: Kind, page = 1, size = 10, signal?: AbortSignal) {
  return checkedPage((await httpClient.get<Envelope<Page<RecruitingRecord>>>(endpoint(role, kind), { params: { page, size }, signal })).data);
}
// Backend has no detail GET: search only the current principal's bounded pages, without a shared cache.
export async function findRecord(role: RecruitingRole, kind: Kind, id: number, signal?: AbortSignal) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Mã hồ sơ không hợp lệ.");
  for (let page = 1; ; page++) {
    if (signal?.aborted) throw new Error("Đã hủy tải dữ liệu.");
    const result = await listRecords(role, kind, page, 100, signal);
    const found = result.items.find(item => item.id === id);
    if (found) return found;
    if (page >= result.totalPages) throw new Error("Không tìm thấy hồ sơ trong danh sách của bạn.");
  }
}
export async function changeStatus(role: RecruitingRole, kind: Kind, captured: RecruitingRecord, status: RecordStatus, signal?: AbortSignal) {
  const path = `${endpoint(role, kind)}/${captured.id}/${role === "recruiter" ? "status" : "respond"}`;
  return unwrap((await httpClient.patch<Envelope<RecruitingRecord>>(path, { expectedStatus: captured.status, status }, { signal })).data);
}
export async function createInterview(body: CreateInterview, signal?: AbortSignal) {
  return unwrap((await httpClient.post<Envelope<Interview>>(endpoint("recruiter", "interviews"), body, { signal })).data);
}
export async function createInvitation(body: CreateInvitation, signal?: AbortSignal) {
  return unwrap((await httpClient.post<Envelope<Invitation>>(endpoint("recruiter", "invitations"), body, { signal })).data);
}
export async function listApplications(page: number, signal?: AbortSignal) {
  return checkedPage((await httpClient.get<Envelope<Page<ApplicationRef>>>("/companies/me/applications", { params: { page, size: 10 }, signal })).data);
}
export async function ownedApplication(id: number, signal?: AbortSignal) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Chọn đơn ứng tuyển từ danh sách của công ty.");
  return unwrap((await httpClient.get<Envelope<ApplicationRef>>(`/companies/me/applications/${id}`, { signal })).data);
}
export async function listJobs(page: number, signal?: AbortSignal) {
  return checkedPage((await httpClient.get<Envelope<Page<JobRef>>>("/companies/me/jobs", { params: { page, size: 10, status: "ACTIVE" }, signal })).data);
}
export function isInterview(item: RecruitingRecord): item is Interview { return "applicationId" in item; }
export function errorCode(error: unknown) { return (error as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode; }
export function recruitingError(error: unknown) {
  const code = errorCode(error), status = (error as { response?: { status?: number } })?.response?.status;
  if (code === "RECRUITMENT_STATE_CONFLICT") return "Trạng thái đã thay đổi ở phiên khác. Thao tác chưa được xác nhận; hãy tải lại trạng thái rồi chọn lại. Hệ thống không tự gửi lại.";
  if (code === "INVITATION_ALREADY_PENDING") return "Đã có lời mời đang chờ cho ứng viên và công việc này. Nội dung bạn soạn vẫn được giữ; hãy xem lời mời đã gửi.";
  if (status === 401 || status === 403) return "Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã hết hạn.";
  if (status === 404) return "Không tìm thấy hồ sơ trong phạm vi tài khoản hiện tại.";
  if (status === 400) return "Thao tác chưa hợp lệ với trạng thái, thời gian hoặc điều kiện hiện tại. Vui lòng kiểm tra và tải lại dữ liệu khi cần.";
  return error instanceof Error && !('response' in error) && error.message.startsWith("Không tìm thấy hồ sơ") ? error.message : "Không xác nhận được kết quả. Vui lòng kiểm tra kết nối rồi thử tải lại.";
}
