import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import { AuthProvider } from "./AuthProvider";
import { useAuthContext as useAuth } from "./authContext";
import { httpClient, AUTH_TOKEN_STORAGE_KEY } from "../../services/api/httpClient";
import { clearToken, storeToken } from "../../services/auth/authService";

const original = httpClient.defaults.adapter;
afterEach(() => { httpClient.defaults.adapter = original; clearToken(); });
const user = { id: 2, fullName: "New Company", email: "new@example.test", role: "COMPANY", status: "ACTIVE" };

it.each([false, true])("late restoration (failure=%s) cannot replace or clear a new login", async fail => {
  let restore!: () => void;
  storeToken("old-student");
  httpClient.defaults.adapter = (config => {
    if (config.url === "/auth/me") return new Promise((resolve, reject) => {
      restore = () => fail ? reject(new Error("Late restore failure")) : resolve({ config, status: 200, statusText: "OK", headers: {}, data: { data: { ...user, id: 1, role: "STUDENT" } } });
    });
    return Promise.resolve({ config, status: 200, statusText: "OK", headers: {}, data: { data: { token: "new-company", user } } });
  }) as AxiosAdapter;
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(restore).toBeDefined());
  await act(async () => { await hook.result.current.login(user.email, "synthetic"); });
  await act(async () => { restore(); });
  expect(hook.result.current.currentUser?.id).toBe("2");
  expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("new-company");
});

it("logout invalidates an in-flight login in the provider", async () => {
  let finish!: () => void;
  httpClient.defaults.adapter = (config => new Promise<AxiosResponse>(resolve => {
    finish = () => resolve({ config, status: 200, statusText: "OK", headers: {}, data: { data: { token: "late", user } } });
  })) as AxiosAdapter;
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  let request!: Promise<unknown>;
  act(() => { request = hook.result.current.login(user.email, "synthetic"); });
  const rejected = expect(request).rejects.toThrow();
  await waitFor(() => expect(finish).toBeDefined());
  act(() => hook.result.current.logout());
  await act(async () => { finish(); await rejected; });
  expect(hook.result.current.isAuthenticated).toBe(false);
  expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
});
