import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../app/providers/authContext";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { CandidateMessagesPage } from "../../pages/candidate/CandidateMessagesPage";
import { CandidateApplicationsPage } from "../../pages/candidate/CandidateApplicationsPage";
import { RecruiterCandidatesPage } from "../../pages/recruiter/RecruiterCandidatesPage";
import { MessageLauncher } from "./MessageLauncher";
import { httpClient } from "../../services/api/httpClient";
import { advanceSession, AUTH_TOKEN_STORAGE_KEY } from "../../services/auth/sessionVersion";
import type { UserRole } from "../../types/auth";
import type { Conversation, Message } from "./messagingApi";

vi.mock("../../services/api/httpClient", () => ({ AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token", httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const conversation: Conversation = { id: 21, applicationId: 9, companyId: 7, studentId: 4, jobId: 8, lastMessageAt: null, createdAt: "2026-11-12T09:30:00", updatedAt: "2026-11-12T09:30:00" };
const incoming: Message = { id: 1, conversationId: 21, senderUserId: 7, senderRole: "COMPANY", content: "Tin đến đã lưu", isRead: false, createdAt: "2026-11-12T09:30:00" };
const outbound: Message = { ...incoming, id: 2, senderUserId: 4, senderRole: "STUDENT", content: "Tin đi đã lưu" };
const application = { id: 9, companyId: 7, studentId: 4, jobId: 8, jobTitle: "Backend role", companyName: "Synthetic Company", studentName: "Synthetic Student", status: "WITHDRAWN", coverLetter: "History", appliedAt: "2026-11-12T09:00:00", createdAt: "2026-11-12T09:00:00", updatedAt: "2026-11-12T09:00:00", reviewedAt: null, cvFileId: null, cvFileName: null };
const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[], overrides = {}) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: items.length ? 1 : 0, ...overrides });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function auth(role: UserRole = "candidate", id = "4"): AuthContextValue {
  return { currentUser: { id, name: "Synthetic", email: "synthetic@example.test", role }, currentRole: role, isAuthenticated: true, isInitializing: false, login: vi.fn(), logout: vi.fn() };
}
function Navigation() { const navigate = useNavigate(); return <button onClick={() => navigate("/candidate/messages/999")}>Open foreign link</button>; }
function Tree({ initial = "/candidate/messages/21", context = auth() }: { initial?: string; context?: AuthContextValue }) {
  return <AuthContext.Provider value={context}><ToastProvider><MemoryRouter initialEntries={[initial]}><Navigation /><Routes>
    <Route path="/candidate/messages" element={<CandidateMessagesPage />} />
    <Route path="/candidate/messages/:conversationId" element={<CandidateMessagesPage />} />
    <Route path="/recruiter/messages" element={<CandidateMessagesPage role="recruiter" />} />
    <Route path="/recruiter/messages/:conversationId" element={<CandidateMessagesPage role="recruiter" />} />
    <Route path="/candidate/applications/:applicationId" element={<CandidateApplicationsPage mode="detail" />} />
    <Route path="/recruiter/candidates/:candidateId" element={<RecruiterCandidatesPage mode="detail" />} />
    <Route path="/launch" element={<MessageLauncher applicationId={9} role={context.currentRole === "recruiter" ? "recruiter" : "candidate"} />} />
  </Routes></MemoryRouter></ToastProvider></AuthContext.Provider>;
}
function mount(initial = "/candidate/messages/21", context = auth()) { return render(<Tree initial={initial} context={context} />); }
let messages: Message[];
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); localStorage.clear(); advanceSession(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "synthetic-session");
  messages = [incoming, outbound];
  vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
    if (url === "/conversations") return envelope(page([conversation], { page: config?.params.page, size: config?.params.size }));
    if (url === "/conversations/21/messages") return envelope(page(messages, { page: config?.params.page }));
    if (url === "/students/me/applications/9" || url === "/companies/me/applications/9") return envelope(application);
    if (url === "/companies/me/jobs" || url === "/companies/me/saved-candidates") return envelope(page([], { size: 100 }));
    throw new Error("Unexpected GET endpoint");
  });
  vi.mocked(httpClient.post).mockImplementation(async (url, body) => {
    if (url === "/conversations") return envelope(conversation);
    const sent = { ...outbound, id: 3, content: (body as { content: string }).content };
    messages = [...messages, sent];
    return envelope(sent);
  });
  vi.mocked(httpClient.patch).mockImplementation(async () => {
    messages = messages.map(item => item.senderRole === "COMPANY" ? { ...item, isRead: true } : item);
    return envelope({ conversationId: 21, markedCount: 1 });
  });
});

describe("Private messaging workspace (mocked HTTP)", () => {
  it.each(["candidate", "recruiter"] as const)("%s lists bounded owned pages and refreshes only explicitly", async role => {
    vi.mocked(httpClient.get).mockImplementation(async (_url, config) => envelope(page([{ ...conversation, id: config?.params.page === 2 ? 22 : 21 }], { page: config?.params.page, size: 10, totalPages: 2, totalItems: 11 })));
    mount(`/${role}/messages`, auth(role));
    expect(await screen.findByRole("link", { name: "Hội thoại #21" })).toHaveAttribute("href", `/${role}/messages/21`);
    expect(httpClient.post).not.toHaveBeenCalled(); expect(httpClient.patch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Sau" })); await screen.findByRole("link", { name: "Hội thoại #22" });
    expect(httpClient.get).toHaveBeenLastCalledWith("/conversations", expect.objectContaining({ params: { page: 2, size: 10 } }));
    await userEvent.click(screen.getByRole("button", { name: "Tải lại hội thoại" }));
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(3));
  });
  it("uses only paginated owned metadata for a deep link, then retrieves real history", async () => {
    const fallback = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => url === "/conversations" ? envelope(page(config?.params.page === 2 ? [conversation] : [], { page: config?.params.page, size: 100, totalPages: 2, totalItems: 101 })) : fallback(url, config));
    mount(); await screen.findByText(incoming.content);
    expect(httpClient.get).toHaveBeenNthCalledWith(2, "/conversations", expect.objectContaining({ params: { page: 2, size: 100 } }));
    expect(screen.getByRole("link", { name: "Xem đơn ứng tuyển #9" })).toHaveAttribute("href", "/candidate/applications/9");
    expect(within(screen.getByRole("article", { name: "Tin nhắn đã nhận #1" })).getByText(/12\/11\/2026 09:30 \(giờ máy chủ\)/)).toBeVisible();
    expect(screen.getByRole("article", { name: "Tin nhắn đã gửi #2" })).toHaveTextContent("Bạn");
    expect(screen.getByRole("article", { name: "Tin nhắn đã nhận #1" })).toHaveTextContent("Nhà tuyển dụng");
    expect(httpClient.patch).not.toHaveBeenCalled();
    expect(vi.mocked(httpClient.get).mock.calls.some(([url]) => url === "/conversations/21")).toBe(false);
  });
  it("paginates oldest-first and makes the current latest page available", async () => {
    const fallback = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => url.endsWith("/messages") ? envelope(page([{ ...incoming, id: config?.params.page, content: `Trang ${config?.params.page} đã lưu` }], { page: config?.params.page, totalPages: 3, totalItems: 21 })) : fallback(url, config));
    mount(); await screen.findByText("Trang 1 đã lưu");
    await userEvent.click(screen.getByRole("button", { name: "Sau" })); await screen.findByText("Trang 2 đã lưu");
    await userEvent.click(screen.getByRole("button", { name: "Đến trang mới nhất" })); await screen.findByText("Trang 3 đã lưu");
    expect(httpClient.get).toHaveBeenLastCalledWith("/conversations/21/messages", expect.objectContaining({ params: { page: 3, size: 10 } }));
    expect(screen.getByText("Trang 3/3")).toBeVisible();
  });
  it("sends the exact untrimmed content, confirms only after success and suppresses duplicate clicks", async () => {
    const pending = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.post).mockReturnValueOnce(pending.promise);
    mount(); const input = await screen.findByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "  Nội dung nguyên văn\nDòng sau  " } });
    const button = screen.getByRole("button", { name: "Gửi tin nhắn" }); fireEvent.click(button); fireEvent.click(button);
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(httpClient.post).toHaveBeenCalledWith("/conversations/21/messages", { content: "  Nội dung nguyên văn\nDòng sau  " }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.queryByText("Tin nhắn đã được hệ thống xác nhận gửi.")).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    await act(async () => pending.resolve(envelope({ ...outbound, id: 3, content: "  Nội dung nguyên văn\nDòng sau  " })));
    expect(await screen.findByText("Tin nhắn đã được hệ thống xác nhận gửi.")).toBeVisible();
    expect(await screen.findByRole("article", { name: "Tin nhắn đã gửi #3" })).toHaveTextContent("Nội dung nguyên văn");
    expect(input).toHaveValue(""); expect(httpClient.post).toHaveBeenCalledTimes(1);
    expect(localStorage.length).toBe(0);
  });
  it("preserves an uncertain draft, never retries and requires a successful manual history refresh before resending", async () => {
    vi.mocked(httpClient.post).mockRejectedValueOnce(new Error("Network"));
    mount(); const input = await screen.findByRole("textbox", { name: "Nội dung tin nhắn" });
    fireEvent.change(input, { target: { value: "Bản nháp riêng tư" } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác nhận được tin nhắn đã gửi");
    expect(input).toHaveValue("Bản nháp riêng tư");
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Tôi đã kiểm tra/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tải lại lịch sử" }));
    await userEvent.click(await screen.findByRole("button", { name: "Tôi đã kiểm tra lịch sử, cho phép gửi lại" }));
    expect(httpClient.post).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await screen.findByText("Tin nhắn đã được hệ thống xác nhận gửi.");
    expect(httpClient.post).toHaveBeenCalledTimes(2);
  });
  it("an uncertain-send manual refresh opens the newest history page before enabling a deliberate resend", async () => {
    const fallback = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => url.endsWith("/messages") ? envelope(page(messages, { page: config?.params.page, totalItems: 21, totalPages: 3 })) : fallback(url, config));
    vi.mocked(httpClient.post).mockRejectedValueOnce(new Error("Uncertain delivery"));
    mount(); fireEvent.change(await screen.findByRole("textbox"), { target: { value: "newest-page check" } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" })); await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Tải lại lịch sử" }));
    await screen.findByRole("button", { name: "Tôi đã kiểm tra lịch sử, cho phép gửi lại" });
    expect(screen.getByText("Trang 3/3")).toBeVisible();
    expect(httpClient.get).toHaveBeenLastCalledWith("/conversations/21/messages", expect.objectContaining({ params: { page: 3, size: 10 } }));
    expect(screen.getByRole("textbox")).toHaveValue("newest-page check"); expect(httpClient.post).toHaveBeenCalledTimes(1);
  });
  it("Company sends as Company and marks only Student messages read from authoritative history", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(envelope({ ...incoming, id: 3, content: "Company reply" }));
    vi.mocked(httpClient.patch).mockImplementation(async () => {
      messages = messages.map(item => item.senderRole === "STUDENT" ? { ...item, isRead: true } : item);
      return envelope({ conversationId: 21, markedCount: 1 });
    });
    mount("/recruiter/messages/21", auth("recruiter", "7"));
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Company reply" } });
    expect(screen.getByRole("article", { name: "Tin nhắn đã nhận #2" })).toHaveTextContent("Sinh viên");
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    expect(await screen.findByRole("article", { name: "Tin nhắn đã gửi #3" })).toHaveTextContent("Company reply");
    await waitFor(() => expect(screen.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    await waitFor(() => expect(screen.getByRole("article", { name: "Tin nhắn đã nhận #2" })).toHaveTextContent("Bạn đã đánh dấu đã đọc"));
    expect(screen.getByRole("article", { name: "Tin nhắn đã gửi #1" })).toHaveTextContent("Chưa xác nhận người nhận đã đọc");
    expect(httpClient.post).toHaveBeenCalledWith("/conversations/21/messages", { content: "Company reply" }, expect.anything());
    expect(httpClient.patch).toHaveBeenCalledWith("/conversations/21/read", undefined, expect.anything());
  });
  it("a failed manual refresh does not unlock an uncertain send", async () => {
    vi.mocked(httpClient.post).mockRejectedValueOnce({ response: { status: 503 } });
    mount(); fireEvent.change(await screen.findByRole("textbox"), { target: { value: "Keep draft" } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" })); await screen.findByRole("alert");
    vi.mocked(httpClient.get).mockRejectedValueOnce({ response: { status: 503 } });
    await userEvent.click(screen.getByRole("button", { name: "Tải lại lịch sử" }));
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
    expect(screen.getByRole("textbox")).toHaveValue("Keep draft");
    expect(screen.queryByRole("button", { name: /Tôi đã kiểm tra/ })).not.toBeInTheDocument();
    expect(httpClient.post).toHaveBeenCalledTimes(1);
  });
  it.each(["", " \n\t", "x".repeat(5001), "x" + String.fromCharCode(0)])("rejects blank/oversized/NUL content without POST (%#)", async content => {
    mount(); fireEvent.change(await screen.findByRole("textbox"), { target: { value: content } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" })); await screen.findByRole("alert");
    expect(httpClient.post).not.toHaveBeenCalled();
  });
  it("accepts a 5000 UTF-16-unit Unicode boundary without rewriting it", async () => {
    mount(); const content = String.fromCodePoint(0x1F600).repeat(2500);
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: content } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    await screen.findByText("Tin nhắn đã được hệ thống xác nhận gửi.");
    expect(httpClient.post).toHaveBeenCalledWith("/conversations/21/messages", { content }, expect.anything());
  });
  it("uses an explicit bodyless PATCH then authoritative history, leaving outbound unread", async () => {
    mount(); await screen.findByText(incoming.content); expect(httpClient.patch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    await screen.findByText("Đã đánh dấu 1 tin nhắn đến là đã đọc trong hội thoại này.");
    expect(httpClient.patch).toHaveBeenCalledWith("/conversations/21/read", undefined, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(await screen.findByText("Bạn đã đánh dấu đã đọc", { exact: false })).toBeVisible();
    expect(screen.getByRole("article", { name: "Tin nhắn đã gửi #2" })).toHaveTextContent("Chưa xác nhận người nhận đã đọc");
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });
  it("a read failure does not fabricate read success or mutate displayed messages", async () => {
    vi.mocked(httpClient.patch).mockRejectedValueOnce({ response: { status: 503 } });
    mount(); await screen.findByText(incoming.content);
    await userEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("article", { name: "Tin nhắn đã nhận #1" })).toHaveTextContent("Chưa đánh dấu đã đọc");
    expect(screen.queryByText(/Đã đánh dấu 1 tin nhắn/)).not.toBeInTheDocument();
  });
  it("renders private message bodies as text, never executable HTML", async () => {
    messages = [{ ...incoming, content: '<img src=x onerror="alert(1)"><script>evil()</script>' }];
    mount(); expect(await screen.findByText(messages[0].content)).toBeVisible();
    expect(document.querySelector("script")).toBeNull(); expect(document.querySelector("img")).toBeNull();
  });
  it.each([401, 403, 404])("distinguishes HTTP %s metadata denial/missing from an empty inbox", async status => {
    vi.mocked(httpClient.get).mockRejectedValueOnce({ response: { status } });
    mount(); expect(await screen.findByRole("alert")).toHaveTextContent(status === 401 ? "Phiên đăng nhập" : status === 403 ? "không có quyền" : "Không tìm thấy");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa có tin nhắn trong/)).not.toBeInTheDocument(); expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404])("HTTP %s send denial clears private history and blocks more sends", async status => {
    vi.mocked(httpClient.post).mockRejectedValueOnce({ response: { status } });
    mount(); fireEvent.change(await screen.findByRole("textbox"), { target: { value: "draft" } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" })); await screen.findByRole("alert");
    expect(screen.queryByText(incoming.content)).not.toBeInTheDocument(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("treats a history failure distinctly and permits explicit recovery", async () => {
    const fallback = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => { if (url.endsWith("/messages")) throw { response: { status: 403 } }; return fallback(url, config); });
    mount(); expect(await screen.findByRole("alert")).toHaveTextContent("không có quyền");
    expect(screen.queryByText(/Chưa có tin nhắn trong/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi tin nhắn" })).toBeDisabled();
    vi.mocked(httpClient.get).mockImplementation(fallback);
    await userEvent.click(screen.getByRole("button", { name: "Tải lại lịch sử" })); await screen.findByText(incoming.content);
  });
  it("separates loading, failed and confirmed empty conversation lists", async () => {
    const pending = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.get).mockReturnValueOnce(pending.promise);
    mount("/candidate/messages"); expect(screen.queryByText(/Chưa có hội thoại/)).not.toBeInTheDocument();
    await act(async () => pending.reject({ response: { status: 503 } })); await screen.findByRole("alert");
    expect(screen.queryByText(/Chưa có hội thoại/)).not.toBeInTheDocument();
    vi.mocked(httpClient.get).mockResolvedValue(envelope(page([])));
    await userEvent.click(screen.getByRole("button", { name: "Tải lại hội thoại" })); await screen.findByText(/Chưa có hội thoại trong trang này/);
  });
  it("shows an actually empty history without claiming no conversations exist", async () => {
    messages = []; mount(); await screen.findByText("Chưa có tin nhắn trong trang này.");
    expect(screen.getByRole("textbox")).toBeVisible(); expect(httpClient.patch).not.toHaveBeenCalled();
  });
  it.each(["bad", "0", "-1"])("rejects invalid route id %s before HTTP", async id => {
    mount(`/candidate/messages/${id}`); await screen.findByRole("alert"); expect(httpClient.get).not.toHaveBeenCalled();
  });
  it.each(["recruiter", "admin"] as const)("%s cannot mount the Student workspace or make messaging requests", async role => {
    mount("/candidate/messages", auth(role)); await screen.findByRole("alert"); expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("Student cannot mount the Company workspace", async () => {
    mount("/recruiter/messages", auth()); await screen.findByRole("alert"); expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("foreign navigation discards the previous conversation content and draft immediately", async () => {
    mount(); fireEvent.change(await screen.findByRole("textbox"), { target: { value: "private draft" } });
    await userEvent.click(screen.getByRole("button", { name: "Open foreign link" }));
    await screen.findByRole("alert"); expect(screen.queryByText(incoming.content)).not.toBeInTheDocument(); expect(screen.queryByDisplayValue("private draft")).not.toBeInTheDocument();
    expect(vi.mocked(httpClient.get).mock.calls.some(([url]) => url === "/conversations/999/messages")).toBe(false);
  });
  it("account switch aborts old history and never shows prior drafts or late content", async () => {
    const pending = deferred<ReturnType<typeof envelope>>(); const fallback = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => url.endsWith("/messages") ? pending.promise : fallback(url, config));
    const view = mount(); const input = await screen.findByRole("textbox"); fireEvent.change(input, { target: { value: "old-session draft" } });
    const signal = vi.mocked(httpClient.get).mock.calls.find(([url]) => url.endsWith("/messages"))![1]!.signal;
    advanceSession(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "new-session"); vi.mocked(httpClient.get).mockResolvedValue(envelope(page([], { size: 100 })));
    view.rerender(<Tree context={auth("candidate", "99")} />);
    await screen.findByRole("alert"); expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve(envelope(page([{ ...incoming, content: "late private content" }]))));
    expect(screen.queryByText("late private content")).not.toBeInTheDocument(); expect(screen.queryByDisplayValue("old-session draft")).not.toBeInTheDocument();
  });
  it("late send success is discarded after logout/unmount", async () => {
    const pending = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.post).mockReturnValueOnce(pending.promise);
    const view = mount(); fireEvent.change(await screen.findByRole("textbox"), { target: { value: "old draft" } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tin nhắn" }));
    const signal = vi.mocked(httpClient.post).mock.calls[0][2]!.signal;
    advanceSession(); sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    view.rerender(<Tree context={{ ...auth(), currentUser: null, currentRole: null, isAuthenticated: false }} />);
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve(envelope({ ...outbound, id: 3, content: "late sent" })));
    expect(screen.queryByText("late sent")).not.toBeInTheDocument(); expect(screen.queryByText(/hệ thống xác nhận gửi/)).not.toBeInTheDocument();
  });
});

describe("Owned Application messaging entry points", () => {
  it.each(["WITHDRAWN", "REJECTED"])("Student historical %s detail launches only on explicit action with the owned Application ID", async status => {
    const fallback = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => url === "/students/me/applications/9" ? envelope({ ...application, status }) : fallback(url, config));
    mount("/candidate/applications/9"); const button = await screen.findByRole("button", { name: "Nhắn tin" });
    expect(httpClient.post).not.toHaveBeenCalled(); await userEvent.click(button);
    await screen.findByRole("heading", { name: "Hội thoại #21" });
    expect(httpClient.post).toHaveBeenCalledWith("/conversations", { applicationId: 9 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(vi.mocked(httpClient.get).mock.calls.filter(([url]) => url === "/students/me/applications/9")).toHaveLength(2);
  });
  it("Company detail replaces unsupported contact with private in-app messaging", async () => {
    mount("/recruiter/candidates/9", auth("recruiter", "7"));
    const button = await screen.findByRole("button", { name: "Nhắn tin" }); expect(screen.queryByRole("button", { name: "Liên hệ" })).not.toBeInTheDocument();
    expect(httpClient.post).not.toHaveBeenCalled(); await userEvent.click(button);
    await screen.findByRole("heading", { name: "Hội thoại #21" });
    expect(httpClient.get).toHaveBeenCalledWith("/companies/me/applications/9", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(httpClient.post).toHaveBeenCalledWith("/conversations", { applicationId: 9 }, expect.anything());
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
  it("repeated launcher clicks coalesce while pending and reuse Backend conversation IDs", async () => {
    const pending = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.post).mockReturnValueOnce(pending.promise);
    mount("/launch"); const button = screen.getByRole("button", { name: "Nhắn tin" });
    fireEvent.click(button); fireEvent.click(button); await waitFor(() => expect(httpClient.post).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled(); await act(async () => pending.resolve(envelope(conversation)));
    await screen.findByRole("heading", { name: "Hội thoại #21" }); expect(httpClient.post).toHaveBeenCalledTimes(1);
  });
  it("a foreign Application lookup never proceeds to conversation creation", async () => {
    vi.mocked(httpClient.get).mockRejectedValue({ response: { status: 403 } });
    mount("/launch"); await userEvent.click(screen.getByRole("button", { name: "Nhắn tin" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("không có quyền"); expect(httpClient.post).not.toHaveBeenCalled();
  });
  it("does not create a conversation after a session changes during owned Application resolution", async () => {
    const pending = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.get).mockReturnValueOnce(pending.promise);
    const view = mount("/launch"); await userEvent.click(screen.getByRole("button", { name: "Nhắn tin" }));
    advanceSession(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "another-session");
    view.rerender(<Tree initial="/launch" context={auth("candidate", "99")} />);
    await act(async () => pending.resolve(envelope(application)));
    expect(httpClient.post).not.toHaveBeenCalled();
  });
});
