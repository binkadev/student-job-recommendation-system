import axios, { CanceledError, type InternalAxiosRequestConfig } from "axios";
import { advanceSession, sessionVersion, AUTH_TOKEN_STORAGE_KEY } from "../auth/sessionVersion";

export { AUTH_TOKEN_STORAGE_KEY } from "../auth/sessionVersion";
export const AUTH_SESSION_EXPIRED_EVENT = "job-system:auth-session-expired";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  timeout: 40_000,
  headers: {
    "Content-Type": "application/json",
  },
});

const owners = new WeakMap<InternalAxiosRequestConfig, { version: number; token: string | null }>();
function ownsSession(config?: InternalAxiosRequestConfig) {
  const owner = config && owners.get(config);
  return !owner || (owner.version === sessionVersion()
    && owner.token === window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
}

httpClient.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  owners.set(config, { version: sessionVersion(), token });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, undefined, { synchronous: true });

httpClient.interceptors.response.use(
  (response) => {
    if (!ownsSession(response.config)) throw new CanceledError("Response belongs to an earlier session");
    return response;
  },
  (error) => {
    if (!ownsSession(error?.config)) return Promise.reject(error);
    const requestToken = error?.config?.headers?.Authorization;
    const currentToken = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (error?.response?.status === 401 && requestToken === `Bearer ${currentToken}`) {
      advanceSession();
      window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
