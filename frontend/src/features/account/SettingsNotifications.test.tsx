import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../services/api/httpClient";
import { NotificationsPanel } from "./NotificationsPanel";
import { PasswordSettings } from "./PasswordSettings";
import { useSettingsForm } from "./useSettingsForm";
import { notificationPath, type Notification } from "./notificationsApi";

vi.mock("../../hooks/useAuth", () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock("../../services/api/httpClient", () => ({ AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token", httpClient: { get: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
const notice: Notification = { id: 2, type: "SYSTEM", title: "Confirmed notice", message: "Synthetic", isRead: false, readAt: null, createdAt: "2026-11-01T10:00:00", referenceType: "APPLICATION", referenceId: 9 };
const envelope = (data: unknown) => ({ data: { data } });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mount(role: "candidate" | "recruiter" = "candidate") {
  return render(<ToastProvider><MemoryRouter><NotificationsPanel role={role} /></MemoryRouter></ToastProvider>);
}
function Wrapper({ children }: { children: React.ReactNode }) { return <ToastProvider>{children}</ToastProvider>; }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "session-A");
  vi.mocked(httpClient.get).mockImplementation(async url => envelope(url === "/notifications/unread-count" ? { unreadCount: 21 } : { items: [notice], page: 1, size: 10, totalItems: 21, totalPages: 3 }));
});

describe("Notification contracts", () => {
  it.each(["candidate", "recruiter"] as const)("%s sends filters to Backend, resets page and offers types absent from the slice", async role => {
    mount(role); await screen.findByText(notice.title);
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledWith("/notifications", { params: { page: 2, size: 10 } }));
    fireEvent.click(screen.getByRole("button", { name: "Chưa đọc (21)" }));
    fireEvent.change(screen.getByLabelText("Loại thông báo"), { target: { value: "RECOMMENDATION" } });
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledWith("/notifications", { params: { page: 1, size: 10, unread: true, type: "RECOMMENDATION" } }));
    expect(screen.getByText("Bạn có 21 thông báo chưa đọc.")).toBeVisible();
  });
  it("failed mark one preserves confirmed row and shows error; read-back is required before retry", async () => {
    vi.mocked(httpClient.patch).mockRejectedValue(new Error("Offline"));
    mount(); await screen.findByText(notice.title);
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác nhận");
    expect(screen.getByText(notice.title)).toBeVisible();
    expect(screen.getByText("Chưa đọc", { selector: "span" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại thông báo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Đánh dấu đã đọc" })).toBeEnabled());
  });
  it("read all serializes duplicate clicks and reloads independent unread count after HTTP success", async () => {
    const request = deferred<never>(); vi.mocked(httpClient.patch).mockReturnValue(request.promise);
    mount(); await screen.findByText(notice.title);
    const button = screen.getByRole("button", { name: "Đánh dấu tất cả đã đọc" });
    fireEvent.click(button); fireEvent.click(button);
    expect(httpClient.patch).toHaveBeenCalledExactlyOnceWith("/notifications/read-all");
    expect(screen.queryByText("Đã đánh dấu tất cả đã đọc")).not.toBeInTheDocument();
    await act(async () => request.resolve(undefined as never));
    expect(await screen.findByText("Đã đánh dấu tất cả đã đọc")).toBeVisible();
    expect(vi.mocked(httpClient.get).mock.calls.filter(([url]) => url === "/notifications/unread-count").length).toBe(2);
  });
  it("ignores a late filter response and rejects a response from an old session", async () => {
    const old = deferred<never>(); vi.mocked(httpClient.get).mockReturnValueOnce(old.promise);
    mount();
    fireEvent.change(screen.getByLabelText("Loại thông báo"), { target: { value: "SYSTEM" } });
    await screen.findByText(notice.title);
    await act(async () => old.resolve(envelope({ items: [{ ...notice, title: "Old private notice" }] }) as never));
    expect(screen.queryByText("Old private notice")).not.toBeInTheDocument();
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "session-B");
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc" }));
    expect(httpClient.patch).not.toHaveBeenCalled();
  });
  it("maps known references inside the current role and unknown metadata to inbox", () => {
    expect(notificationPath(notice, "candidate")).toBe("/candidate/applications/9");
    expect(notificationPath(notice, "recruiter")).toBe("/recruiter/candidates/9");
    expect(notificationPath({ ...notice, referenceType: "JOB" }, "recruiter")).toBe("/recruiter/jobs/9");
    expect(notificationPath({ ...notice, referenceId: -1 }, "candidate")).toBe("/candidate/notifications");
  });
});

describe("Verified settings mutations", () => {
  const base = { name: "Confirmed", etag: '"5"' };
  const same = (a: typeof base, b: typeof base) => a.name === b.name;
  it("retains stale draft and original revision after 409 and GET until explicit replacement", async () => {
    const load = vi.fn().mockResolvedValueOnce(base).mockResolvedValue({ name: "Other editor", etag: '"6"' });
    const write = vi.fn().mockRejectedValue({ response: { status: 409, data: { errorCode: "PROFILE_REVISION_CONFLICT" } } });
    const { result } = renderHook(() => useSettingsForm(load, write, same, "Saved"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.draft).toEqual(base));
    act(() => result.current.setDraft({ ...base, name: "Stale draft" }));
    await act(() => result.current.save());
    expect(result.current.blocked).toBe(true);
    await act(() => result.current.readBack());
    expect(result.current.draft).toEqual({ name: "Stale draft", etag: '"5"' });
    expect(write).toHaveBeenCalledTimes(1);
    act(() => result.current.replaceWithReview());
    expect(result.current.draft).toEqual({ name: "Other editor", etag: '"6"' });
  });
  it("lost response after commit blocks duplicate writes and keeps draft until read-back", async () => {
    const load = vi.fn().mockResolvedValueOnce(base).mockResolvedValue({ ...base, name: "Committed", etag: '"6"' });
    const write = vi.fn().mockRejectedValue(new Error("Response lost"));
    const { result } = renderHook(() => useSettingsForm(load, write, same, "Saved"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.draft).toEqual(base));
    act(() => result.current.setDraft({ ...base, name: "Committed" }));
    await act(() => result.current.save()); await act(() => result.current.save());
    expect(write).toHaveBeenCalledTimes(1); expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain("Chưa xác nhận");
    await act(() => result.current.readBack());
    expect(result.current.review?.name).toBe("Committed");
    expect(result.current.snapshot).toEqual(base);
  });
  it("does not publish success before read-back or accept old-session responses", async () => {
    const request = deferred<typeof base>();
    const load = vi.fn().mockResolvedValueOnce(base).mockReturnValueOnce(request.promise);
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSettingsForm(load, write, same, "Saved"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.draft).toEqual(base));
    let pending!: Promise<void>;
    act(() => { pending = result.current.save(); });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "session-B");
    await act(async () => { request.resolve({ name: "Old private name", etag: '"6"' }); await pending; });
    expect(result.current.draft).toEqual(base); expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
  it("password is memory-only, has no fake 2FA switch and stops retry after uncertain commit", async () => {
    vi.mocked(httpClient.patch).mockRejectedValue(new Error("Response lost"));
    render(<Wrapper><PasswordSettings /></Wrapper>);
    fireEvent.change(screen.getByLabelText("Mật khẩu hiện tại"), { target: { value: "OldPass9!" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "NewPass9!" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), { target: { value: "NewPass9!" } });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa xác nhận");
    expect(screen.getByRole("button", { name: "Đổi mật khẩu" })).toBeDisabled();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain("Pass9!");
    expect(JSON.stringify(sessionStorage)).not.toContain("Pass9!");
  });
});
