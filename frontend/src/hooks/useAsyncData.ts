import { useEffect, useState, type DependencyList } from "react";
import { getApiErrorMessage } from "../utils/apiErrors";
import { AUTH_TOKEN_STORAGE_KEY, sessionVersion } from "../services/auth/sessionVersion";

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY), version = sessionVersion();
    const ownsSession = () => active && token === sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) && version === sessionVersion();
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (ownsSession()) setData(result);
      })
      .catch((error) => {
        if (ownsSession()) setError(getApiErrorMessage(error, "Không thể tải dữ liệu. Vui lòng thử lại."));
      })
      .finally(() => {
        if (ownsSession()) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, loading, error, setData };
}
