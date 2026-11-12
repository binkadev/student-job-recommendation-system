import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../app/providers/authContext";
import { CandidateInterviewsPage } from "../../pages/candidate/CandidateInterviewsPage";
import { CandidateInvitationsPage } from "../../pages/candidate/CandidateInvitationsPage";
import { RecruiterInterviewsPage } from "../../pages/recruiter/RecruiterInterviewsPage";
import { RecruiterInvitationsPage } from "../../pages/recruiter/RecruiterInvitationsPage";
import { InvitationLauncher } from "./InvitationLauncher";
import { httpClient } from "../../services/api/httpClient";
import { advanceSession, AUTH_TOKEN_STORAGE_KEY } from "../../services/auth/sessionVersion";
import type { Interview, Invitation } from "./recruitingApi";
import type { UserRole } from "../../types/auth";

vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const baseInterview: Interview = { id: 21, applicationId: 9, companyId: 7, studentId: 4, jobId: 8, title: "Phỏng vấn Backend thật", scheduledAt: "2099-11-20T09:30:00", durationMinutes: 60, meetingType: "ONLINE", locationOrLink: "https://meet.example.test/real", notes: "Ghi chú đã lưu", status: "SCHEDULED", createdAt: "2026-11-11T10:00:00", updatedAt: "2026-11-11T10:00:00" };
const baseInvitation: Invitation = { id: 31, companyId: 7, studentId: 4, jobId: 8, message: "Mời bạn ứng tuyển Backend", status: "PENDING", createdAt: "2026-11-11T10:00:00", updatedAt: "2026-11-11T10:00:00" };
const application = { id: 9, studentId: 4, studentName: "Ứng viên được phép", jobId: 8, jobTitle: "Backend Intern", status: "REVIEWED" };
const job = { id: 18, title: "Công việc công ty", status: "ACTIVE", deadline: "2099-12-31" };
const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[], overrides = {}) => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1, ...overrides });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let interview: Interview, invitation: Invitation;
function auth(role: UserRole = "recruiter", id = "7"): AuthContextValue {
  return { currentUser: { id, name: "Synthetic user", email: "synthetic@example.test", role }, currentRole: role, isAuthenticated: true, isInitializing: false, login: vi.fn(), logout: vi.fn() };
}
function Tree({ initial, context }: { initial: string; context: AuthContextValue }) {
  return <AuthContext.Provider value={context}><MemoryRouter initialEntries={[initial]}><Routes>
    <Route path="/recruiter/interviews" element={<RecruiterInterviewsPage />} />
    <Route path="/recruiter/interviews/create" element={<RecruiterInterviewsPage mode="create" />} />
    <Route path="/recruiter/interviews/:interviewId" element={<RecruiterInterviewsPage mode="detail" />} />
    <Route path="/recruiter/invitations" element={<RecruiterInvitationsPage />} />
    <Route path="/recruiter/invitations/create" element={<RecruiterInvitationsPage mode="create" />} />
    <Route path="/recruiter/invitations/:invitationId" element={<RecruiterInvitationsPage mode="detail" />} />
    <Route path="/candidate/interviews" element={<CandidateInterviewsPage />} />
    <Route path="/candidate/interviews/:interviewId" element={<CandidateInterviewsPage mode="detail" />} />
    <Route path="/candidate/invitations" element={<CandidateInvitationsPage />} />
    <Route path="/candidate/invitations/:invitationId" element={<CandidateInvitationsPage mode="detail" />} />
  </Routes></MemoryRouter></AuthContext.Provider>;
}
function mount(initial = "/recruiter/interviews", context = auth()) { return render(<Tree initial={initial} context={context} />); }
function pagination(config?: { params?: unknown }) { return config?.params as { page: number; size: number } | undefined; }
async function chooseAction(name: string) {
  await userEvent.click(await screen.findByRole("button", { name }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận thực hiện" }));
}
async function fillInterview() {
  await screen.findByRole("option", { name: /Ứng viên được phép/ });
  fireEvent.change(screen.getByLabelText("Đơn ứng tuyển"), { target: { value: "9" } });
  fireEvent.change(screen.getByLabelText("Tiêu đề phỏng vấn"), { target: { value: "Lịch mới" } });
  fireEvent.change(screen.getByLabelText("Ngày giờ phỏng vấn (giờ máy chủ)"), { target: { value: "2099-11-20T09:30:00" } });
  fireEvent.change(screen.getByLabelText("Liên kết cuộc họp"), { target: { value: "https://meet.example.test/new" } });
  fireEvent.change(screen.getByLabelText("Ghi chú phỏng vấn"), { target: { value: "Bản nháp riêng" } });
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "account-A");
  interview = { ...baseInterview }; invitation = { ...baseInvitation };
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    const path = String(url);
    if (path.endsWith("/interviews")) return envelope(page([interview]));
    if (path.endsWith("/invitations")) return envelope(page([invitation]));
    if (path === "/companies/me/applications/9") return envelope(application);
    if (path === "/companies/me/applications") return envelope(page([application]));
    if (path === "/companies/me/jobs") return envelope(page([job]));
    throw new Error(`Unexpected HTTP path ${path}`);
  });
  vi.mocked(httpClient.patch).mockImplementation(async (url, body) => {
    const status = (body as { status: string }).status;
    if (String(url).includes("/interviews/")) { interview = { ...interview, status: status as Interview["status"] }; return envelope(interview); }
    invitation = { ...invitation, status: status as Invitation["status"] }; return envelope(invitation);
  });
  vi.mocked(httpClient.post).mockImplementation(async (url) => String(url).endsWith("/interviews") ? envelope(interview) : envelope(invitation));
});

describe("Owned interview and invitation UI", () => {
  it("loads Company interview pages with exact path and paging instead of a generic query", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (_url, config) => envelope(page([{ ...interview, id: pagination(config)?.page === 2 ? 22 : 21 }], { page: pagination(config)?.page ?? 1, totalPages: 2, totalItems: 2 })));
    mount(); await screen.findByText(interview.title);
    expect(httpClient.get).toHaveBeenCalledWith("/companies/me/interviews", expect.objectContaining({ params: { page: 1, size: 10 }, signal: expect.any(AbortSignal) }));
    await userEvent.click(screen.getByRole("button", { name: "Sau" }));
    await screen.findByRole("link", { name: "Chi tiết #22" });
    expect(httpClient.get).toHaveBeenLastCalledWith("/companies/me/interviews", expect.objectContaining({ params: { page: 2, size: 10 } }));
    expect(screen.queryByRole("link", { name: "Chi tiết #21" })).not.toBeInTheDocument();
  });
  it("loads deep-link details by owned pages and keeps wall time and supported application links", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (_url, config) => envelope(page(pagination(config)?.page === 1 ? [] : [interview], { page: pagination(config)?.page, size: 100, totalPages: 2, totalItems: 101 })));
    mount("/candidate/interviews/21", auth("candidate"));
    await screen.findByText("Ghi chú đã lưu");
    expect(screen.getByText(/20\/11\/2099 09:30 \(giờ máy chủ\)/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Xem đơn ứng tuyển #9" })).toHaveAttribute("href", "/candidate/applications/9");
    expect(screen.getByRole("link", { name: "Mở phòng phỏng vấn" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(httpClient.get).toHaveBeenCalledTimes(2);
    expect(httpClient.get).toHaveBeenLastCalledWith("/students/me/interviews", expect.objectContaining({ params: { page: 2, size: 100 } }));
  });
  it("never turns a loading request or failure into an empty list, and retries only by user action", async () => {
    const request = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.get).mockReturnValueOnce(request.promise);
    mount(); expect(screen.queryByText("Chưa có lịch phỏng vấn.")).not.toBeInTheDocument();
    await act(async () => request.reject({ response: { status: 503 } }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không xác nhận được kết quả");
    expect(screen.queryByText("Chưa có lịch phỏng vấn.")).not.toBeInTheDocument(); expect(httpClient.get).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Tải lại dữ liệu" })); await screen.findByText(interview.title);
    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
  it.each(["interviews", "invitations"])("shows a confirmed empty %s list only after success", async kind => {
    vi.mocked(httpClient.get).mockResolvedValue(envelope(page([])));
    mount(`/candidate/${kind}`, auth("candidate"));
    await screen.findByText(kind === "interviews" ? "Chưa có lịch phỏng vấn." : "Chưa có lời mời ứng tuyển.");
  });
  it.each(["bad", "999"])("does not fabricate a detail for missing/invalid id %s", async id => {
    vi.mocked(httpClient.get).mockResolvedValue(envelope(page([])));
    mount(`/candidate/interviews/${id}`, auth("candidate")); await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Xác nhận tham dự" })).not.toBeInTheDocument();
    if (id === "bad") expect(httpClient.get).not.toHaveBeenCalled();
  });
  it.each(["CONFIRMED", "DECLINED"])("Student responds %s with captured SCHEDULED", async target => {
    mount("/candidate/interviews/21", auth("candidate"));
    await chooseAction(target === "CONFIRMED" ? "Xác nhận tham dự" : "Từ chối");
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledExactlyOnceWith("/students/me/interviews/21/respond", { expectedStatus: "SCHEDULED", status: target }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(httpClient.post).not.toHaveBeenCalled();
  });
  it.each(["ACCEPTED", "DECLINED"])("Student invitation %s preserves normal Job apply flow", async target => {
    mount("/candidate/invitations/31", auth("candidate")); await screen.findByText(invitation.message!);
    expect(screen.getByRole("link", { name: "Xem công việc và ứng tuyển" })).toHaveAttribute("href", "/candidate/jobs/8");
    await chooseAction(target === "ACCEPTED" ? "Chấp nhận lời mời" : "Từ chối");
    expect(httpClient.patch).toHaveBeenCalledWith("/students/me/invitations/31/respond", { expectedStatus: "PENDING", status: target }, expect.anything());
    expect(httpClient.post).not.toHaveBeenCalled();
    expect(screen.getByText(/Chấp nhận lời mời không tự tạo đơn/)).toBeVisible();
  });
  it.each(["interviews", "invitations"])("Company cancels its %s using the loaded status", async kind => {
    mount(`/recruiter/${kind}`); await chooseAction("Hủy");
    expect(httpClient.patch).toHaveBeenCalledWith(`/companies/me/${kind}/${kind === "interviews" ? 21 : 31}/status`, { expectedStatus: kind === "interviews" ? "SCHEDULED" : "PENDING", status: "CANCELLED" }, expect.anything());
  });
  it("Company completes only a confirmed interview that appears finished; Backend remains authoritative", async () => {
    interview = { ...interview, status: "CONFIRMED", scheduledAt: "2000-01-01T09:00:00" };
    mount("/recruiter/interviews/21"); await chooseAction("Đánh dấu hoàn tất");
    expect(httpClient.patch).toHaveBeenCalledWith("/companies/me/interviews/21/status", { expectedStatus: "CONFIRMED", status: "COMPLETED" }, expect.anything());
  });
  it.each(["COMPLETED", "CANCELLED", "DECLINED", "UNKNOWN"])("hides actions for terminal/unknown interview status %s", async status => {
    interview = { ...interview, status: status as Interview["status"] };
    mount("/candidate/interviews", auth("candidate")); await screen.findByText(interview.title);
    expect(screen.queryByRole("button", { name: "Xác nhận tham dự" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });
  it("does not offer attendance responses after start or premature completion", async () => {
    interview = { ...interview, scheduledAt: "2000-01-01T09:00:00" };
    const view = mount("/candidate/interviews", auth("candidate")); await screen.findByText(interview.title);
    expect(screen.queryByRole("button", { name: "Xác nhận tham dự" })).not.toBeInTheDocument(); view.unmount();
    interview = { ...baseInterview, status: "CONFIRMED" };
    mount(); await screen.findByText(interview.title);
    expect(screen.queryByRole("button", { name: "Đánh dấu hoàn tất" })).not.toBeInTheDocument();
  });
  it("retains captured action and confirmed data on 409, with no retry/refetch until manual reload", async () => {
    vi.mocked(httpClient.patch).mockRejectedValue({ response: { status: 409, data: { errorCode: "RECRUITMENT_STATE_CONFLICT" } } });
    mount("/candidate/interviews/21", auth("candidate")); await chooseAction("Xác nhận tham dự");
    const dialog = screen.getByRole("dialog"); expect(await within(dialog).findByRole("alert")).toHaveTextContent("không tự gửi lại");
    expect(within(dialog).getByText("Xác nhận tham dự")).toBeVisible(); expect(screen.getAllByText("Đã lên lịch").length).toBeGreaterThan(0);
    expect(httpClient.patch).toHaveBeenCalledTimes(1); expect(httpClient.get).toHaveBeenCalledTimes(1);
    interview = { ...interview, status: "CANCELLED" };
    await userEvent.click(within(dialog).getByRole("button", { name: "Tải lại trạng thái" }));
    await screen.findByText("Đã hủy"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(httpClient.patch).toHaveBeenCalledTimes(1); expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
  it("keeps conflict protection after closing the dialog until a manual reload", async () => {
    vi.mocked(httpClient.patch).mockRejectedValue({ response: { status: 409, data: { errorCode: "RECRUITMENT_STATE_CONFLICT" } } });
    mount("/candidate/interviews/21", auth("candidate")); await chooseAction("Xác nhận tham dự");
    await within(screen.getByRole("dialog")).findByRole("alert"); await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Xác nhận tham dự" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Hãy tải lại dữ liệu"); expect(httpClient.patch).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Xác nhận tham dự" })).toBeEnabled());
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
  });
  it("retains confirmed invitation after failure and blocks duplicate pending clicks", async () => {
    const transfer = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.patch).mockReturnValue(transfer.promise);
    mount("/candidate/invitations", auth("candidate")); await userEvent.click(await screen.findByRole("button", { name: "Chấp nhận lời mời" }));
    const button = within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận thực hiện" });
    fireEvent.click(button); fireEvent.click(button); expect(button).toBeDisabled(); expect(httpClient.patch).toHaveBeenCalledTimes(1);
    await act(async () => transfer.reject({ response: { status: 400 } }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Thao tác chưa hợp lệ"); expect(screen.getAllByText("Chờ phản hồi").length).toBeGreaterThan(0);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
  it("opens and closes the confirmation dialog through keyboard without sending", async () => {
    mount(); await userEvent.click(await screen.findByRole("button", { name: "Hủy" }));
    await userEvent.keyboard("{Escape}"); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
});

describe("Company scheduling and invitation forms", () => {
  it("schedules from real application options using exact fields and unchanged wall timestamp", async () => {
    mount("/recruiter/interviews/create"); await fillInterview();
    fireEvent.click(screen.getByRole("button", { name: "Lưu lịch phỏng vấn" }));
    await screen.findByRole("heading", { name: "Chi tiết phỏng vấn" });
    expect(httpClient.post).toHaveBeenCalledExactlyOnceWith("/companies/me/interviews", { applicationId: 9, title: "Lịch mới", scheduledAt: "2099-11-20T09:30", durationMinutes: 60, meetingType: "ONLINE", locationOrLink: "https://meet.example.test/new", notes: "Bản nháp riêng" }, expect.anything());
    expect(httpClient.get).toHaveBeenCalledWith("/companies/me/applications", expect.objectContaining({ params: { page: 1, size: 10 } }));
  });
  it("supports onsite meetings and the 15-minute duration boundary", async () => {
    mount("/recruiter/interviews/create?applicationId=9"); await fillInterview();
    fireEvent.change(screen.getByLabelText("Hình thức phỏng vấn"), { target: { value: "ONSITE" } });
    fireEvent.change(screen.getByLabelText("Địa điểm phỏng vấn"), { target: { value: "Phòng 3" } });
    fireEvent.change(screen.getByLabelText("Thời lượng (phút)"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lịch phỏng vấn" }));
    await waitFor(() => expect(httpClient.post).toHaveBeenCalledWith("/companies/me/interviews", expect.objectContaining({ applicationId: 9, meetingType: "ONSITE", locationOrLink: "Phòng 3", durationMinutes: 15 }), expect.anything()));
  });
  it("keeps draft when scheduling fails and prevents duplicate writes while pending", async () => {
    const transfer = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.post).mockReturnValue(transfer.promise);
    mount("/recruiter/interviews/create"); await fillInterview();
    const button = screen.getByRole("button", { name: "Lưu lịch phỏng vấn" }); fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled(); expect(httpClient.post).toHaveBeenCalledTimes(1);
    await act(async () => transfer.reject({ response: { status: 400 } })); await screen.findByText(/Thao tác chưa hợp lệ/);
    expect(screen.getByLabelText("Ghi chú phỏng vấn")).toHaveValue("Bản nháp riêng"); expect(screen.getByLabelText("Tiêu đề phỏng vấn")).toHaveValue("Lịch mới");
  });
  it.each(["duration", "time", "link", "title"])("validates %s before making any creation request", async field => {
    mount("/recruiter/interviews/create"); await fillInterview();
    const invalid = ({ duration: ["Thời lượng (phút)", "14"], time: ["Ngày giờ phỏng vấn (giờ máy chủ)", "2000-01-01T09:00:00"], link: ["Liên kết cuộc họp", "https://user:secret@example.test"], title: ["Tiêu đề phỏng vấn", " "] } as Record<string, [string, string]>)[field]!;
    fireEvent.change(screen.getByLabelText(invalid[0]), { target: { value: invalid[1] } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lịch phỏng vấn" }));
    await screen.findByText(/Vui lòng kiểm tra các trường/); expect(httpClient.post).not.toHaveBeenCalled();
  });
  it("never offers withdrawn/rejected applications and pages actual options", async () => {
    vi.mocked(httpClient.get).mockImplementation(async (_url, config) => envelope(page(pagination(config)?.page === 2 ? [application] : [{ ...application, status: "WITHDRAWN" }], { page: pagination(config)?.page ?? 1, totalPages: 2, totalItems: 2 })));
    mount("/recruiter/interviews/create"); await screen.findByText(/Trang này không có đơn đủ điều kiện/);
    expect(screen.queryByRole("option", { name: /Ứng viên được phép/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sau" })); await screen.findByRole("option", { name: /Ứng viên được phép/ });
    expect(httpClient.get).toHaveBeenLastCalledWith("/companies/me/applications", expect.objectContaining({ params: { page: 2, size: 10 } }));
  });
  it("launches invitation only through an owned source and submits derived Student ID with owned Job", async () => {
    mount("/recruiter/invitations/create?applicationId=9"); await screen.findByText(/Ứng viên: Ứng viên được phép/);
    await screen.findByRole("option", { name: /Công việc công ty/ });
    fireEvent.change(screen.getByLabelText("Công việc mời ứng tuyển"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Lời nhắn mời ứng tuyển (không bắt buộc)"), { target: { value: "Lời nhắn thật" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời ứng tuyển" }));
    await screen.findByText("Đã gửi lời mời ứng tuyển.");
    expect(httpClient.post).toHaveBeenCalledExactlyOnceWith("/companies/me/invitations", { studentId: 4, jobId: 18, message: "Lời nhắn thật" }, expect.anything());
    expect(httpClient.get).toHaveBeenCalledWith("/companies/me/jobs", expect.objectContaining({ params: { page: 1, size: 10, status: "ACTIVE" } }));
    expect(screen.queryByLabelText(/Mã sinh viên/)).not.toBeInTheDocument();
  });
  it("keeps the duplicate invitation draft and makes no duplicate or automatic retry", async () => {
    vi.mocked(httpClient.post).mockRejectedValue({ response: { status: 409, data: { errorCode: "INVITATION_ALREADY_PENDING" } } });
    mount("/recruiter/invitations/create?applicationId=9"); await screen.findByRole("option", { name: /Công việc công ty/ });
    fireEvent.change(screen.getByLabelText("Công việc mời ứng tuyển"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Lời nhắn mời ứng tuyển (không bắt buộc)"), { target: { value: "Giữ bản nháp" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời ứng tuyển" }));
    await screen.findByText(/Đã có lời mời đang chờ/);
    expect(screen.getByLabelText("Lời nhắn mời ứng tuyển (không bắt buộc)")).toHaveValue("Giữ bản nháp");
    expect(screen.getByRole("button", { name: "Gửi lời mời ứng tuyển" })).toBeDisabled(); expect(httpClient.post).toHaveBeenCalledTimes(1); expect(httpClient.get).toHaveBeenCalledTimes(2);
  });
  it("treats unverified application-source error as failure, not authorization from a URL student ID", async () => {
    vi.mocked(httpClient.get).mockImplementation(async url => {
      if (String(url).includes("/applications/")) throw { response: { status: 403 } };
      return envelope(page([job]));
    });
    mount("/recruiter/invitations/create?applicationId=999&studentId=4"); await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Gửi lời mời ứng tuyển" })).toBeDisabled(); expect(httpClient.post).not.toHaveBeenCalled();
  });
  it("has no global Student picker or requests until a source association is selected", () => {
    mount("/recruiter/invitations/create"); expect(screen.getByRole("link", { name: "Xem đơn ứng tuyển" })).toHaveAttribute("href", "/recruiter/candidates"); expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("launcher carries the source application only", () => {
    render(<MemoryRouter><InvitationLauncher applicationId={9} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Mời ứng tuyển" })).toHaveAttribute("href", "/recruiter/invitations/create?applicationId=9");
  });
});

describe("RBAC and isolated sessions", () => {
  it.each(["candidate", "admin"] as UserRole[])("rejects %s on Company UI without making HTTP calls", role => {
    localStorage.setItem("currentRole", "recruiter"); mount("/recruiter/interviews", auth(role));
    expect(screen.getByRole("alert")).toHaveTextContent("không có quyền"); expect(httpClient.get).not.toHaveBeenCalled(); localStorage.removeItem("currentRole");
  });
  it("rejects Company on Student routes and unauthenticated users", () => {
    const view = mount("/candidate/invitations", auth()); expect(screen.getByRole("alert")).toBeVisible(); view.unmount();
    mount("/recruiter/interviews", { ...auth(), isAuthenticated: false, currentUser: null }); expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("drops previous account data and aborts pagination before another request can use a new account", async () => {
    const old = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.get).mockReturnValueOnce(old.promise).mockResolvedValue(envelope(page([{ ...interview, id: 99, title: "Tài khoản B" }])));
    const view = mount("/recruiter/interviews/99"); const firstSignal = vi.mocked(httpClient.get).mock.calls[0][1]?.signal;
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "account-B"); advanceSession(); view.rerender(<Tree initial="/recruiter/interviews/99" context={auth("recruiter", "88")} />);
    await screen.findByText("Tài khoản B");
    await act(async () => old.resolve(envelope(page([], { totalPages: 20, totalItems: 2000, size: 100 }))));
    expect(firstSignal?.aborted).toBe(true); expect(httpClient.get).toHaveBeenCalledTimes(2); expect(screen.queryByText(baseInterview.title)).not.toBeInTheDocument();
  });
  it("ignores late mutation results after an account switch", async () => {
    const transfer = deferred<ReturnType<typeof envelope>>(); vi.mocked(httpClient.patch).mockReturnValueOnce(transfer.promise);
    const view = mount("/candidate/interviews/21", auth("candidate")); await chooseAction("Xác nhận tham dự");
    interview = { ...baseInterview, title: "Lịch của B", status: "CANCELLED" };
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "account-B"); advanceSession(); view.rerender(<Tree initial="/candidate/interviews/21" context={auth("candidate", "88")} />);
    await screen.findByText("Lịch của B");
    await act(async () => transfer.resolve(envelope({ ...baseInterview, status: "CONFIRMED" })));
    expect(screen.queryByText(/Đã cập nhật:/)).not.toBeInTheDocument(); expect(screen.getByText("Đã hủy")).toBeVisible(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
