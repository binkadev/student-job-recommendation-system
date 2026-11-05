import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig, type AxiosAdapter } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_EXPIRED_EVENT, AUTH_TOKEN_STORAGE_KEY, httpClient } from "./httpClient";
import { clearToken, storeToken } from "../auth/authService";

const originalAdapter = httpClient.defaults.adapter;
afterEach(() => { httpClient.defaults.adapter = originalAdapter; sessionStorage.clear(); vi.restoreAllMocks(); });

describe("HTTP session ownership", () => {
  it("binds a mutation to its caller session before a synchronous logout/login switch", async () => {
    let sentToken: unknown;
    httpClient.defaults.adapter = (async config => {
      sentToken = config.headers.Authorization;
      return { config, status: 200, statusText: "OK", headers: {}, data: {} };
    }) as AxiosAdapter;
    storeToken("account-A");
    const request = httpClient.post("/private-mutation", { draft: "account A" });
    const rejected = expect(request).rejects.toThrow("earlier session");
    clearToken(); storeToken("account-B");
    await rejected;
    expect(sentToken).toBe("Bearer account-A");
    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("account-B");
  });
  it("logout/relogin with an identical JWT still invalidates old responses", async () => {
    let finish!: () => void;
    httpClient.defaults.adapter = (config => new Promise(resolve => {
      finish = () => resolve({ config, status: 200, statusText: "OK", headers: {}, data: {} });
    })) as AxiosAdapter;
    storeToken("same-jwt");
    const request = httpClient.get("/auth/me"); const rejected = expect(request).rejects.toThrow("earlier session");
    await vi.waitFor(() => expect(finish).toBeDefined());
    clearToken(); storeToken("same-jwt"); finish(); await rejected;
    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("same-jwt");
  });
  it.each(["get", "patch", "post"] as const)("rejects late successful %s data after switching accounts", async method => {
    let finish!: () => void;
    httpClient.defaults.adapter = (config => new Promise(resolve => {
      finish = () => resolve({ config, status: 200, statusText: "OK", headers: {}, data: { private: "account A" } });
    })) as AxiosAdapter;
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "account-A");
    const request = httpClient.request({ method, url: "/private" });
    const rejected = expect(request).rejects.toThrow("earlier session");
    await vi.waitFor(() => expect(finish).toBeDefined());
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "account-B");
    finish(); await rejected;
    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("account-B");
  });
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
