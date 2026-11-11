import { Suspense } from "react";
import { Outlet, RouterProvider } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../../app/providers/authContext";
import { appRouter } from "../../app/router/appRouter";
import { candidateRoutes, recruiterRoutes } from "../../constants/routes";
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
describe("Registered recruiting routes and existing guards", () => {
  it("registers the supported Company and Student route families under their roles", () => {
    const company = ["/recruiter/interviews", "/recruiter/interviews/create", "/recruiter/interviews/:interviewId", "/recruiter/invitations", "/recruiter/invitations/create", "/recruiter/invitations/:invitationId"];
    const student = ["/candidate/interviews", "/candidate/interviews/:interviewId", "/candidate/invitations", "/candidate/invitations/:invitationId"];
    for (const path of company) expect(recruiterRoutes.find(route => route.path === path)?.role).toBe("recruiter");
    for (const path of student) expect(candidateRoutes.find(route => route.path === path)?.role).toBe("candidate");
    expect(candidateRoutes.find(route => route.path === "/candidate/invitations")?.nextPath).toBeUndefined();
  });
  it.each([
    ["recruiter", "/recruiter/interviews", "Lịch phỏng vấn"],
    ["recruiter", "/recruiter/interviews/create", "Tạo lịch phỏng vấn"],
    ["recruiter", "/recruiter/invitations", "Lời mời đã gửi"],
    ["recruiter", "/recruiter/invitations/create", "Gửi lời mời ứng tuyển"],
    ["candidate", "/candidate/interviews", "Lịch phỏng vấn"],
    ["candidate", "/candidate/invitations", "Lời mời ứng tuyển"],
  ])("real appRouter maps %s %s to the supported page", async (role, path, title) => {
    await appRouter.navigate(path);
    render(<AuthContext.Provider value={context(role as UserRole)}><RouterProvider router={appRouter} /></AuthContext.Provider>);
    expect(await screen.findByRole("heading", { name: title, level: 1 })).toBeVisible();
    expect(screen.queryByText("Chức năng chưa được hỗ trợ")).not.toBeInTheDocument();
  });
  it("existing role guard redirects a Student away from Company invitations", async () => {
    await appRouter.navigate("/recruiter/invitations");
    render(<AuthContext.Provider value={context("candidate")}><RouterProvider router={appRouter} /></AuthContext.Provider>);
    await waitFor(() => expect(appRouter.state.location.pathname).toBe("/403"));
    expect(httpClient.get).not.toHaveBeenCalled();
  });
});
