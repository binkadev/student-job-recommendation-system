import { httpClient } from "../../services/api/httpClient";

export type MessagingRole = "candidate" | "recruiter";
export interface Conversation {
  id: number; applicationId: number; companyId: number; studentId: number; jobId: number;
  lastMessageAt: string | null; createdAt: string; updatedAt: string;
}
export interface Message {
  id: number; conversationId: number; senderUserId: number; senderRole: "STUDENT" | "COMPANY";
  content: string; isRead: boolean; createdAt: string;
}
export interface MarkRead { conversationId: number; markedCount: number }
export interface Page<T> { items: T[]; page: number; size: number; totalItems: number; totalPages: number }
interface Envelope<T> { success: boolean; data: T }
export const positiveId = (value: number) => Number.isSafeInteger(value) && value > 0;
function unwrap<T>(body: Envelope<T>): T {
  if (!body?.success || body.data == null) throw new Error("Invalid messaging response");
  return body.data;
}
function checkedConversation(value: Conversation) {
  if (![value?.id, value?.applicationId, value?.companyId, value?.studentId, value?.jobId].every(positiveId)
      || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string"
      || (value.lastMessageAt !== null && typeof value.lastMessageAt !== "string")) throw new Error("Invalid conversation");
  return value;
}
function checkedMessage(value: Message, id: number) {
  if (!positiveId(value?.id) || value.conversationId !== id || !positiveId(value.senderUserId)
      || !["STUDENT", "COMPANY"].includes(value.senderRole) || typeof value.content !== "string"
      || typeof value.isRead !== "boolean" || typeof value.createdAt !== "string") throw new Error("Invalid message");
  return value;
}
function checkedPage<T>(body: Envelope<Page<T>>, page: number, size: number, check: (item: T) => T) {
  const value = unwrap(body);
  if (!Array.isArray(value.items) || value.items.length > size || value.page !== page || value.size !== size
      || !Number.isSafeInteger(value.totalItems) || value.totalItems < 0
      || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0) throw new Error("Invalid message page");
  value.items.forEach(check);
  return value;
}
export async function listConversations(page = 1, size = 10, signal?: AbortSignal) {
  return checkedPage((await httpClient.get<Envelope<Page<Conversation>>>("/conversations", { params: { page, size }, signal })).data, page, size, checkedConversation);
}
// No detail GET exists. Search only owned, bounded pages and stop at the initial page-count snapshot.
// No shared cache; AbortSignal and the view's session guard own every request/result.
export async function findConversation(id: number, signal?: AbortSignal) {
  if (!positiveId(id)) throw new Error("Invalid conversation ID");
  const first = await listConversations(1, 100, signal);
  let result = first;
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    const found = result.items.find(item => item.id === id);
    if (found) return found;
    if (page >= first.totalPages) throw new ConversationNotFound();
    result = await listConversations(page + 1, 100, signal);
  }
}
export class ConversationNotFound extends Error {}
export async function ownedApplication(role: MessagingRole, id: number, signal?: AbortSignal) {
  if (!positiveId(id)) throw new Error("Invalid Application ID");
  const value = unwrap((await httpClient.get<Envelope<{ id: number }>>(`/${role === "candidate" ? "students" : "companies"}/me/applications/${id}`, { signal })).data);
  if (value.id !== id) throw new Error("Invalid Application response");
  return value;
}
export async function createConversation(applicationId: number, signal?: AbortSignal) {
  const value = checkedConversation(unwrap((await httpClient.post<Envelope<Conversation>>("/conversations", { applicationId }, { signal })).data));
  if (value.applicationId !== applicationId) throw new Error("Invalid Application conversation");
  return value;
}
export async function listMessages(id: number, page = 1, signal?: AbortSignal) {
  return checkedPage((await httpClient.get<Envelope<Page<Message>>>(`/conversations/${id}/messages`, { params: { page, size: 10 }, signal })).data, page, 10, item => checkedMessage(item, id));
}
export async function historyPage(id: number, page: number | "latest", signal?: AbortSignal) {
  if (page !== "latest") return listMessages(id, page, signal);
  const first = await listMessages(id, 1, signal);
  signal?.throwIfAborted();
  return first.totalPages > 1 ? listMessages(id, first.totalPages, signal) : first;
}
export async function sendMessage(id: number, content: string, signal?: AbortSignal) {
  return checkedMessage(unwrap((await httpClient.post<Envelope<Message>>(`/conversations/${id}/messages`, { content }, { signal })).data), id);
}
export async function markRead(id: number, signal?: AbortSignal) {
  const value = unwrap((await httpClient.patch<Envelope<MarkRead>>(`/conversations/${id}/read`, undefined, { signal })).data);
  if (value.conversationId !== id || !Number.isSafeInteger(value.markedCount) || value.markedCount < 0) throw new Error("Invalid read result");
  return value;
}
export function contentError(content: string) {
  if (!content.trim()) return "Nhập nội dung tin nhắn, không chỉ khoảng trắng.";
  if (content.length > 5000) return "Tin nhắn tối đa 5.000 ký tự UTF-16.";
  if (content.includes(String.fromCharCode(0))) return "Tin nhắn không được chứa ký tự NUL.";
  return "";
}
export const statusOf = (error: unknown) => (error as { response?: { status?: number } })?.response?.status;
export const accessFailure = (error: unknown) => [401, 403, 404].includes(statusOf(error) ?? 0);
export function messagingError(error: unknown) {
  if (statusOf(error) === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (statusOf(error) === 403) return "Bạn không có quyền truy cập hội thoại hoặc đơn ứng tuyển này.";
  if (statusOf(error) === 404 || error instanceof ConversationNotFound) return "Không tìm thấy hội thoại hoặc đơn ứng tuyển trong tài khoản hiện tại.";
  if (statusOf(error) === 400) return "Dữ liệu chưa hợp lệ. Hãy kiểm tra nội dung và mã hồ sơ rồi tải lại.";
  return "Không tải được dữ liệu tin nhắn. Hãy kiểm tra kết nối và tải lại.";
}
