import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearToken, getCurrentUserRequest, getStoredToken, loginRequest } from "../../services/auth/authService";
import type { CurrentUser, UserRole } from "../../types/auth";

interface AuthContextValue {
  currentUser: CurrentUser | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!getStoredToken()) {
        setIsInitializing(false);
        return;
      }

      try {
        const user = await getCurrentUserRequest();
        if (active) setCurrentUser(user);
      } catch {
        clearToken();
        if (active) setCurrentUser(null);
      } finally {
        if (active) setIsInitializing(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      currentRole: currentUser?.role ?? null,
      isAuthenticated: Boolean(currentUser),
      isInitializing,
      login: async (email, password) => {
        const user = await loginRequest({ email, password });
        setCurrentUser(user);
        return user;
      },
      logout: () => {
        clearToken();
        setCurrentUser(null);
      },
    }),
    [currentUser, isInitializing],
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
