import { afterEach, expect, it, vi } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import { httpClient, AUTH_TOKEN_STORAGE_KEY } from "../api/httpClient";
import { clearToken, loginRequest, storeToken } from "./authService";

const adapter = httpClient.defaults.adapter;
const syntheticUser = { id: 1, role: "STUDENT", fullName: "Old", email: "old@example.test", status: "ACTIVE" };
afterEach(() => { httpClient.defaults.adapter = adapter; clearToken(); vi.restoreAllMocks(); });

it("a pending login cannot restore a session after logout", async () => {
  let finish!: (value: AxiosResponse) => void;
  httpClient.defaults.adapter = (config => new Promise(resolve => {
    finish = value => resolve({ ...value, config });
  })) as AxiosAdapter;
  const request = loginRequest({ email: "old@example.test", password: "synthetic" });
  const rejected = expect(request).rejects.toThrow();
  await vi.waitFor(() => expect(finish).toBeDefined());
  clearToken();
  finish({ data: { data: { token: "old-token", user: syntheticUser } }, status: 200, statusText: "OK", headers: {} } as AxiosResponse);
  await rejected;
  expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
});

it("the newest overlapping login owns the session even if the old success arrives last", async () => {
  const finish: ((token: string) => void)[] = [];
  httpClient.defaults.adapter = (config => new Promise(resolve => {
    finish.push(token => resolve({ config, status: 200, statusText: "OK", headers: {}, data: { data: { token, user: syntheticUser } } }));
  })) as AxiosAdapter;
  const old = loginRequest({ email: "old@example.test", password: "synthetic" });
  const rejected = expect(old).rejects.toThrow();
  await vi.waitFor(() => expect(finish).toHaveLength(1));
  const current = loginRequest({ email: "new@example.test", password: "synthetic" });
  await vi.waitFor(() => expect(finish).toHaveLength(2));
  finish[1]("new-token"); await current;
  finish[0]("old-token"); await rejected;
  expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("new-token");
});

it("a failed old login cannot clear a newer session", async () => {
  let fail!: (error: Error) => void;
  httpClient.defaults.adapter = (() => new Promise((_resolve, reject) => { fail = reject; })) as AxiosAdapter;
  const request = loginRequest({ email: "old@example.test", password: "synthetic" });
  const rejected = expect(request).rejects.toThrow();
  await vi.waitFor(() => expect(fail).toBeDefined());
  storeToken("new-token");
  fail(new Error("Late network failure"));
  await rejected;
  expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("new-token");
});
