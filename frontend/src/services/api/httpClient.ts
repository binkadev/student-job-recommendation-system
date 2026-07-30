import axios from "axios";

export const AUTH_TOKEN_STORAGE_KEY = "job-system:auth-token";
export const AUTH_SESSION_EXPIRED_EVENT = "job-system:auth-session-expired";

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

httpClient.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
