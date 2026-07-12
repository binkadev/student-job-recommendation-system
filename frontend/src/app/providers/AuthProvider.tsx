import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CurrentUser, UserRole } from "../../types/auth";

interface AuthContextValue {
  currentUser: CurrentUser | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  loginAsCandidate: () => void;
  loginAsRecruiter: () => void;
  loginAsAdmin: () => void;
  logout: () => void;
}

const mockUsers: Record<UserRole, CurrentUser> = {
  candidate: {
    id: "candidate-1",
    name: "Nguyễn Văn An",
    email: "candidate@example.com",
    role: "candidate",
  },
  recruiter: {
    id: "recruiter-1",
    name: "Trần Thị Bình",
    email: "recruiter@example.com",
    role: "recruiter",
  },
  admin: {
    id: "admin-1",
    name: "Quản trị viên",
    email: "admin@example.com",
    role: "admin",
  },
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      currentRole: currentUser?.role ?? null,
      isAuthenticated: Boolean(currentUser),
      loginAsCandidate: () => setCurrentUser(mockUsers.candidate),
      loginAsRecruiter: () => setCurrentUser(mockUsers.recruiter),
      loginAsAdmin: () => setCurrentUser(mockUsers.admin),
      logout: () => setCurrentUser(null),
    }),
    [currentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
