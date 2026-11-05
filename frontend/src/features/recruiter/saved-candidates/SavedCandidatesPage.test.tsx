import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/feedback/ToastProvider";
import { AUTH_TOKEN_STORAGE_KEY } from "../../../services/api/httpClient";
import { SavedCandidatesPage } from "./SavedCandidatesPage";
import { listSavedCandidates, removeSavedCandidate, updateSavedNote, type SavedCandidate, type SavedCandidatePage } from "./savedCandidatesApi";
import { useCandidateMutation } from "./useCandidateMutation";

vi.mock("./savedCandidatesApi", async original => ({ ...await original<typeof import("./savedCandidatesApi")>(), listSavedCandidates: vi.fn(), removeSavedCandidate: vi.fn(), updateSavedNote: vi.fn() }));
const candidate: SavedCandidate = { id: 3, applicationId: 9, studentId: 4, studentName: "Candidate Example", studentEmail: "candidate@example.test", headline: null, university: null, major: "IT", jobId: 8, jobTitle: "Java Intern", cvFileId: 2, cvFileName: "resume.pdf", note: "Confirmed note", savedAt: "2026-11-04T10:00:00", updatedAt: "2026-11-04T10:00:00", applicationStatus: "WITHDRAWN", revision: 5 };
const page = (items = [candidate], overrides = {}): SavedCandidatePage => ({ items, page: 1, size: 10, totalItems: items.length, totalPages: 1, ...overrides });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function mount() { return render(<ToastProvider><MemoryRouter><SavedCandidatesPage /></MemoryRouter></ToastProvider>); }
beforeEach(() => { vi.resetAllMocks(); sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "company-A"); vi.mocked(listSavedCandidates).mockResolvedValue(page()); });

describe("Company saved candidates", () => {
  it("uses Backend search and status filters and displays the real source status", async () => {
    mount(); await screen.findByText(candidate.studentName!);
    expect(screen.getAllByText("Ứng viên rút đơn").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Tìm ứng viên đã lưu"), { target: { value: "internal note" } });
    fireEvent.change(screen.getByLabelText("Trạng thái đơn nguồn"), { target: { value: "WITHDRAWN" } });
    await waitFor(() => expect(listSavedCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: "internal note", applicationStatus: "WITHDRAWN", page: 1 })));
  });
  it("failed note update retains draft and requires explicit read-back without an automatic retry", async () => {
    vi.mocked(updateSavedNote).mockRejectedValue({ response: { status: 409, data: { message: "Note changed" } } });
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Sửa ghi chú" }));
    fireEvent.change(screen.getByLabelText("Ghi chú đánh giá"), { target: { value: "My stale draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu ghi chú" }));
    expect(await screen.findByText("Note changed")).toBeVisible();
    expect(screen.getByLabelText("Ghi chú đánh giá")).toHaveValue("My stale draft");
    expect(screen.getByRole("button", { name: "Lưu ghi chú" })).toBeDisabled();
    expect(updateSavedNote).toHaveBeenCalledExactlyOnceWith(candidate, "My stale draft");
    fireEvent.click(screen.getByRole("button", { name: "Tải ghi chú hiện tại" }));
    await waitFor(() => expect(screen.getByLabelText("Ghi chú đánh giá")).toHaveValue("Confirmed note"));
    expect(screen.getByRole("button", { name: "Lưu ghi chú" })).toBeEnabled();
  });
  it("confirms unsave and locks duplicate clicks; failure retains confirmed row", async () => {
    const request = deferred<void>(); vi.mocked(removeSavedCandidate).mockReturnValue(request.promise);
    mount(); fireEvent.click(await screen.findByRole("button", { name: "Bỏ lưu" }));
    expect(removeSavedCandidate).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Xác nhận bỏ lưu" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(confirm).toBeDisabled(); expect(removeSavedCandidate).toHaveBeenCalledTimes(1);
    await act(async () => request.reject(new Error("Offline")));
    expect(await screen.findByText("Chưa xác nhận được kết quả. Hãy tải lại dữ liệu trước khi thử lại.")).toBeVisible();
    expect(screen.getByText(candidate.studentName!)).toBeVisible();
    expect(screen.queryByText("Đã bỏ lưu hồ sơ ứng viên")).not.toBeInTheDocument();
  });
  it("ignores a stale list response after filters change", async () => {
    const old = deferred<SavedCandidatePage>(); vi.mocked(listSavedCandidates).mockReturnValueOnce(old.promise);
    mount(); fireEvent.change(screen.getByLabelText("Tìm ứng viên đã lưu"), { target: { value: "new" } });
    await screen.findByText(candidate.studentName!);
    await act(async () => old.resolve(page([{ ...candidate, studentName: "Old hidden result" }])));
    expect(screen.queryByText("Old hidden result")).not.toBeInTheDocument();
  });
  it("loads official page two rather than filtering a client slice", async () => {
    vi.mocked(listSavedCandidates).mockResolvedValue(page([candidate], { totalItems: 11, totalPages: 2 }));
    mount(); await screen.findByText(candidate.studentName!);
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(listSavedCandidates).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, size: 10 })));
  });
  it("session switch suppresses success and error callbacks from previous requests", async () => {
    const request = deferred<string>(), accepted = vi.fn();
    const { result } = renderHook(() => useCandidateMutation());
    let pending!: Promise<void>;
    act(() => { pending = result.current.run(() => request.promise, accepted); });
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "company-B");
    await act(async () => { request.resolve("private A data"); await pending; });
    expect(accepted).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
  it("does not allow unsave while save is still pending", async () => {
    const request = deferred<string>(), accept = vi.fn(), unsave = vi.fn();
    const { result } = renderHook(() => useCandidateMutation());
    let pending!: Promise<void>;
    act(() => { pending = result.current.run(() => request.promise, accept); });
    act(() => { void result.current.run(unsave, accept); });
    expect(unsave).not.toHaveBeenCalled();
    await act(async () => { request.resolve("saved"); await pending; });
    expect(accept).toHaveBeenCalledExactlyOnceWith("saved");
  });
});
