import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSavedJobs } from "./useSavedJobs";
import { useAppliedJobs } from "../features/public/jobs/useAppliedJobs";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../services/api/httpClient";

const auth = vi.hoisted(() => ({ currentUser: { id: "4", role: "candidate" } }));
vi.mock("./useAuth", () => ({ useAuth: () => auth }));
vi.mock("../services/api/httpClient", () => ({
  AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token", httpClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const saved = () => ({ data: { data: { items: [{ jobId: 11, status: "ACTIVE" }], page: 1, totalPages: 1 } } });
const apps = () => ({ data: { data: [{ id: 22, jobId: 11, status: "REVIEWED" }] } });

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "test-only-token");
  auth.currentUser = { id: "4", role: "candidate" };
});

describe("confirmed job state during network failures (mocked HTTP regression)", () => {
  it("keeps saved state on failed unsave and failed refresh, then recovers", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(saved());
    const { result } = renderHook(() => useSavedJobs());
    await waitFor(() => expect(result.current.isSaved("11")).toBe(true));
    vi.mocked(httpClient.delete).mockRejectedValue(new Error("offline"));
    vi.mocked(httpClient.get).mockRejectedValue(new Error("offline"));
    await act(async () => { await expect(result.current.toggleSavedJob("11")).rejects.toThrow("offline"); });
    expect(result.current.isSaved("11")).toBe(true);
    await act(async () => { await result.current.refreshSavedJobs(); });
    expect(result.current.isSaved("11")).toBe(true);
    expect(result.current.syncError).toBeTruthy();
    vi.mocked(httpClient.get).mockResolvedValue(saved());
    await act(async () => { await result.current.refreshSavedJobs(); });
    expect(result.current.syncError).toBeNull();
  });

  it("publishes no saved change until the mutation succeeds and coalesces pending clicks", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(saved());
    let complete!: () => void;
    vi.mocked(httpClient.delete).mockImplementation(() => new Promise(resolve => { complete = () => resolve({ data: { data: null } }); }));
    const { result } = renderHook(() => useSavedJobs());
    await waitFor(() => expect(result.current.isSaved("11")).toBe(true));
    let pending!: Promise<void>;
    let repeated!: Promise<void>;
    act(() => { pending = result.current.toggleSavedJob("11"); repeated = result.current.toggleSavedJob("11"); });
    expect(repeated).toBe(pending);
    expect(httpClient.delete).toHaveBeenCalledTimes(1);
    expect(result.current.isSaved("11")).toBe(true);
    await act(async () => { complete(); await Promise.all([pending, repeated]); });
    expect(result.current.isSaved("11")).toBe(false);
  });

  it("retains an active application when refresh fails and blocks unverified apply", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(apps());
    const { result } = renderHook(() => useAppliedJobs());
    await waitFor(() => expect(result.current.getApplicationState("11")).toBe("ACTIVE"));
    vi.mocked(httpClient.get).mockRejectedValue(new Error("offline"));
    await act(async () => { await result.current.refreshAppliedJobs(); });
    expect(result.current.getApplicationState("11")).toBe("ACTIVE");
    expect(result.current.applications).toHaveLength(1);
    expect(result.current.canApply("99")).toBe(false);
    expect(result.current.syncError).toBeTruthy();
    vi.mocked(httpClient.get).mockResolvedValue(apps());
    await act(async () => { await result.current.refreshAppliedJobs(); });
    expect(result.current.canApply("99")).toBe(true);
  });

  it("discards a late application response after switching users", async () => {
    let late!: (data: ReturnType<typeof apps>) => void;
    vi.mocked(httpClient.get).mockImplementationOnce(() => new Promise(resolve => { late = resolve; }));
    const { result, rerender } = renderHook(() => useAppliedJobs());
    auth.currentUser = { id: "5", role: "candidate" };
    vi.mocked(httpClient.get).mockResolvedValue({ data: { data: [] } });
    rerender();
    await waitFor(() => expect(result.current.canApply("11")).toBe(true));
    await act(async () => { late(apps()); });
    expect(result.current.applications).toHaveLength(0);
  });

  it("does not call Student endpoints for a Company session", async () => {
    auth.currentUser = { id: "8", role: "recruiter" };
    renderHook(() => { useSavedJobs(); useAppliedJobs(); });
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
