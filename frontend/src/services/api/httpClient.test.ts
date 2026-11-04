import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_EXPIRED_EVENT, AUTH_TOKEN_STORAGE_KEY, httpClient } from "./httpClient";

const originalAdapter = httpClient.defaults.adapter;
afterEach(() => { httpClient.defaults.adapter = originalAdapter; sessionStorage.clear(); vi.restoreAllMocks(); });

describe("HTTP session ownership", () => {
  it("does not expire a new Company session when an old request returns 401", async () => {
    let reject!: (reason: unknown) => void;
    let config!: InternalAxiosRequestConfig;
    httpClient.defaults.adapter = ((request: InternalAxiosRequestConfig) => {
      config = request; return new Promise((_resolve, no) => { reject = no; });
    }) as AxiosAdapter;
    const expired = vi.fn(); window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expired);
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "old-company");
      const request = httpClient.get("/companies/me/saved-candidates");
      await vi.waitFor(() => expect(config).toBeDefined());
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "new-company");
      reject(new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {}, { status: 401, statusText: "Unauthorized", data: {}, headers: new AxiosHeaders(), config }));
      await expect(request).rejects.toThrow("Unauthorized");
      expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("new-company"); expect(expired).not.toHaveBeenCalled();
    } finally { window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expired); }
  });
  it("expires the current session on its own 401", async () => {
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "current-company");
    httpClient.defaults.adapter = (async config => { throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {}, { status: 401, statusText: "Unauthorized", data: {}, headers: new AxiosHeaders(), config }); }) as AxiosAdapter;
    const expired = vi.fn(); window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, expired);
    try {
      await expect(httpClient.get("/companies/me/saved-candidates")).rejects.toThrow("Unauthorized");
      expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull(); expect(expired).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, expired); }
  });
});
