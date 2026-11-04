import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sessionVersion } from "../../services/auth/sessionVersion";
import { AUTH_SESSION_EXPIRED_EVENT } from "../../services/api/httpClient";
import { clearToken, getCurrentUserRequest, getStoredToken, loginRequest } from "../../services/auth/authService";
import type { CurrentUser } from "../../types/auth";
import { AuthContext, type AuthContextValue } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const operation = useRef(0);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!getStoredToken()) {
        setIsInitializing(false);
        return;
      }

      const version = sessionVersion();
      const attempt = operation.current;
      const ownsSession = () => active && version === sessionVersion() && attempt === operation.current;

      try {
        const user = await getCurrentUserRequest();
        if (ownsSession()) setCurrentUser(user);
      } catch {
        if (ownsSession()) { clearToken(); setCurrentUser(null); }
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
      operation.current++;
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
        const attempt = ++operation.current;
        const user = await loginRequest({ email, password });
        if (attempt === operation.current) setCurrentUser(user);
        return user;
      },
      logout: () => {
        operation.current++;
        clearToken();
        setCurrentUser(null);
      },
    }),
    [currentUser, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
