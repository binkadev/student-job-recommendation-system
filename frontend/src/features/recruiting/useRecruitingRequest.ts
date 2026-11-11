import { useEffect, useRef, useState, type DependencyList } from "react";
import { useSessionAlive } from "../account/useSessionAlive";
import { recruitingError } from "./recruitingApi";

export function useRecruitingQuery<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: DependencyList) {
  const alive = useSessionAlive();
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError("");
    load(abort.signal).then(value => { if (alive() && !abort.signal.aborted) setData(value); })
      .catch(failure => { if (alive() && !abort.signal.aborted) setError(recruitingError(failure)); })
      .finally(() => { if (alive() && !abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
    // Loader identity is intentionally captured by the explicit resource dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return { data, loading, error, setData };
}
export function useRecruitingMutation() {
  const alive = useSessionAlive(), busy = useRef(false), abort = useRef<AbortController>();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  useEffect(() => () => abort.current?.abort(), []);
  async function run<T>(work: (signal: AbortSignal) => Promise<T>, accept: (value: T) => void, reject?: (failure: unknown) => void) {
    if (busy.current || !alive()) return;
    busy.current = true; setPending(true); setError(""); abort.current = new AbortController();
    try { const value = await work(abort.current.signal); if (alive()) accept(value); }
    catch (failure) { if (alive()) { setError(recruitingError(failure)); reject?.(failure); } }
    finally { busy.current = false; if (alive()) setPending(false); }
  }
  return { pending, error, run, clearError: () => setError("") };
}
