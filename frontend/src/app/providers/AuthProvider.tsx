import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AUTH_SESSION_EXPIRED_EVENT } from "../../services/api/httpClient";
import { clearToken, getCurrentUserRequest, getStoredToken, loginRequest } from "../../services/auth/authService";
import type { CurrentUser } from "../../types/auth";
import { AuthContext, type AuthContextValue } from "./authContext";

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

  useEffect(() => {
    let redirecting = false;

    function handleSessionExpired() {
      setCurrentUser(null);
      if (redirecting) return;
      redirecting = true;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (!window.location.pathname.startsWith("/login")) {
        const next = currentPath && currentPath !== "/" ? `?next=${encodeURIComponent(currentPath)}` : "";
        window.location.assign(`/login${next}`);
      }
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
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
