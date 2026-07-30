import { createContext, useContext } from "react";
import type { CurrentUser, UserRole } from "../../types/auth";

export interface AuthContextValue {
  currentUser: CurrentUser | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
