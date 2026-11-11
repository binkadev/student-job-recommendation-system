import { useEffect, useState, type DependencyList } from "react";
import { useSessionAlive } from "../account/useSessionAlive";
import { messagingError } from "./messagingApi";

export function useMessagingQuery<T>(load: (signal: AbortSignal) => Promise<T>, dependencies: DependencyList) {
  const alive = useSessionAlive();
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setLoading(true); setError("");
    load(abort.signal).then(value => { if (alive() && !abort.signal.aborted) setData(value); })
      .catch(failure => { if (alive() && !abort.signal.aborted) setError(messagingError(failure)); })
      .finally(() => { if (alive() && !abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
    // Explicit resource dependencies own each load, matching the recruiting request convention.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return { data, loading, error };
}
