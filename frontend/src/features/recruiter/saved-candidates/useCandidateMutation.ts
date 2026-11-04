import { useEffect, useRef, useState } from "react";
import { AUTH_TOKEN_STORAGE_KEY } from "../../../services/api/httpClient";
import { getApiErrorMessage } from "../../../utils/apiErrors";

// A previous session's completion must never update the current Company workspace.
export function useCandidateMutation() {
  const mounted = useRef(false);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function run<T>(action: () => Promise<T>, accept: (result: T) => void, reject?: () => void) {
    if (busy.current) return;
    const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const current = () => mounted.current && token === sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    busy.current = true; setPending(true); setError(null);
    try {
      const result = await action();
      if (current()) accept(result);
    } catch (failure) {
      if (current()) { setError(getApiErrorMessage(failure, "Chưa xác nhận được kết quả. Hãy tải lại dữ liệu trước khi thử lại.")); reject?.(); }
    } finally {
      busy.current = false;
      if (current()) setPending(false);
    }
  }
  return { run, pending, error, clearError: () => setError(null) };
}
