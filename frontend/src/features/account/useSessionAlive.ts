import { useCallback, useEffect, useRef } from "react";
import { AUTH_TOKEN_STORAGE_KEY } from "../../services/api/httpClient";

// A completed request may belong to a session which has since logged out.
export function useSessionAlive() {
  const mounted = useRef(true);
  const token = useRef(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback(() => mounted.current && token.current === sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY), []);
}
