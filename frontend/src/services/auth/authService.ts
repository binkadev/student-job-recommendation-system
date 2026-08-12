import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../api/httpClient";
import type {
  AuthUserResponse,
  BackendUserRole,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UserRole,
} from "../../types/auth";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

export function mapBackendRole(role: BackendUserRole | string | null): UserRole {
  switch (role) {
    case "STUDENT":
      return "candidate";
    case "COMPANY":
      return "recruiter";
    case "ADMIN":
      return "admin";
    default:
      throw new Error("Unsupported role");
  }
}

export function mapAuthUser(user: AuthUserResponse): CurrentUser {
  return {
    id: String(user.id),
    name: user.fullName,
    email: user.email,
    role: mapBackendRole(user.role),
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export function getStoredToken() {
  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (token) return token;
  return consumeTransferredToken();
}

export function storeToken(token: string) {
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

const AUTH_TRANSFER_QUERY_PARAM = "authTransfer";
const AUTH_TRANSFER_STORAGE_PREFIX = "job-system:auth-transfer:";

export function createAuthenticatedTabUrl(path: string) {
  const url = new URL(path, window.location.origin);
  const token = window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return url.toString();

  const transferId = createTransferId();
  window.localStorage.setItem(
    `${AUTH_TRANSFER_STORAGE_PREFIX}${transferId}`,
    JSON.stringify({ token, expiresAt: Date.now() + 30_000 }),
  );
  url.searchParams.set(AUTH_TRANSFER_QUERY_PARAM, transferId);
  return url.toString();
}

function consumeTransferredToken() {
  const transferId = new URLSearchParams(window.location.search).get(AUTH_TRANSFER_QUERY_PARAM);
  if (!transferId) return null;

  const storageKey = `${AUTH_TRANSFER_STORAGE_PREFIX}${transferId}`;
  const raw = window.localStorage.getItem(storageKey);
  window.localStorage.removeItem(storageKey);
  removeTransferParamFromAddressBar();
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (!payload.token || !payload.expiresAt || payload.expiresAt < Date.now()) return null;
    window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, payload.token);
    return payload.token;
  } catch {
    return null;
  }
}

function removeTransferParamFromAddressBar() {
  const url = new URL(window.location.href);
  url.searchParams.delete(AUTH_TRANSFER_QUERY_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function createTransferId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clearToken() {
  window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function loginRequest(payload: LoginRequest): Promise<CurrentUser> {
  try {
    const response = await httpClient.post<ApiResponse<LoginResponse>>("/auth/login", payload);
    const user = mapAuthUser(response.data.data.user);
    storeToken(response.data.data.token);
    return user;
  } catch (error) {
    clearToken();
    throw error;
  }
}

export async function registerRequest(payload: RegisterRequest): Promise<CurrentUser> {
  const response = await httpClient.post<ApiResponse<AuthUserResponse>>("/auth/register", payload);
  return mapAuthUser(response.data.data);
}

export async function getCurrentUserRequest(): Promise<CurrentUser> {
  const response = await httpClient.get<ApiResponse<AuthUserResponse>>("/auth/me");
  return mapAuthUser(response.data.data);
}
