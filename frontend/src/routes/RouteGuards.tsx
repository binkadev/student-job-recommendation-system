import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import type { UserRole } from "../types/auth";

const dashboardByRole: Record<UserRole, string> = {
  candidate: "/candidate/dashboard",
  recruiter: "/recruiter/dashboard",
  admin: "/admin/dashboard",
};

export function PublicRoute() {
  return <Outlet />;
}

export function GuestRoute() {
  const { currentRole } = useAuth();
  if (currentRole) return <Navigate to={dashboardByRole[currentRole]} replace />;
  return <Outlet />;
}

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RoleRoute({ role }: { role: UserRole }) {
  const { currentRole } = useAuth();
  if (currentRole !== role) return <Navigate to="/403" replace />;
  return <Outlet />;
}
