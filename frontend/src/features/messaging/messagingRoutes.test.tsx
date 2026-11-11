import { Suspense } from "react";
import { Outlet, RouterProvider } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../app/providers/authContext";
import { appRouter } from "../../app/router/appRouter";
import { candidateRoutes, recruiterRoutes, adminRoutes } from "../../constants/routes";
import { httpClient } from "../../services/api/httpClient";
import type { UserRole } from "../../types/auth";
vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() }, AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token" }));
function Layout() { return <Suspense fallback={<p>Loading route</p>}><Outlet /></Suspense>; }
vi.mock("../../layouts/CandidateLayout", () => ({ CandidateLayout: () => <Layout /> }));
vi.mock("../../layouts/RecruiterLayout", () => ({ RecruiterLayout: () => <Layout /> }));
vi.mock("../../layouts/PublicLayout", () => ({ PublicLayout: () => <Layout /> }));
function context(role: UserRole): AuthContextValue { return { currentUser: { id: "4", name: "Synthetic", email: "synthetic@example.test", role }, currentRole: role, isAuthenticated: true, isInitializing: false, login: vi.fn(), logout: vi.fn() }; }
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(httpClient.get).mockResolvedValue({ data: { success: true, data: { items: [], page: 1, size: 10, totalItems: 0, totalPages: 0 } } });
});
describe("Actual messaging route registration and role guards", () => {
  it("registers only Student and Company messaging families", () => {
    for (const path of ["/candidate/messages", "/candidate/messages/:conversationId"]) expect(candidateRoutes.find(route => route.path === path)?.role).toBe("candidate");
    for (const path of ["/recruiter/messages", "/recruiter/messages/:conversationId"]) expect(recruiterRoutes.find(route => route.path === path)?.role).toBe("recruiter");
    expect(adminRoutes.some(route => route.path.includes("messages"))).toBe(false);
  });
  it.each(["candidate", "recruiter"] as const)("appRouter opens the real %s workspace", async role => {
    await appRouter.navigate(`/${role}/messages`);
    render(<AuthContext.Provider value={context(role)}><RouterProvider router={appRouter} /></AuthContext.Provider>);
    expect(await screen.findByRole("heading", { name: "Tin nhắn", level: 1 })).toBeVisible();
    expect(await screen.findByText(/Chưa có hội thoại trong trang này/)).toBeVisible();
    expect(httpClient.post).not.toHaveBeenCalled();
  });
  it.each([
    ["candidate", "/recruiter/messages"], ["recruiter", "/candidate/messages"],
    ["admin", "/candidate/messages"], ["admin", "/recruiter/messages"],
  ])("existing guard blocks %s from %s before HTTP", async (role, path) => {
    await appRouter.navigate(path);
    render(<AuthContext.Provider value={context(role as UserRole)}><RouterProvider router={appRouter} /></AuthContext.Provider>);
    await waitFor(() => expect(appRouter.state.location.pathname).toBe("/403")); expect(httpClient.get).not.toHaveBeenCalled();
  });
  it("the existing protected guard sends an anonymous user to login without loading an inbox", async () => {
    await appRouter.navigate("/candidate/messages");
    render(<AuthContext.Provider value={{ ...context("candidate"), isAuthenticated: false, currentUser: null, currentRole: null }}><RouterProvider router={appRouter} /></AuthContext.Provider>);
    await waitFor(() => expect(appRouter.state.location.pathname).toBe("/login")); expect(httpClient.get).not.toHaveBeenCalled();
  });
});
