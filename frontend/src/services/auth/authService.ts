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

export function mapBackendRole(role: BackendUserRole): UserRole {
  if (role === "STUDENT") return "candidate";
  if (role === "COMPANY") return "recruiter";
  return "admin";
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
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export async function loginRequest(payload: LoginRequest): Promise<CurrentUser> {
  const response = await httpClient.post<ApiResponse<LoginResponse>>("/auth/login", payload);
  storeToken(response.data.data.token);
  return mapAuthUser(response.data.data.user);
}

export async function registerRequest(payload: RegisterRequest): Promise<CurrentUser> {
  const response = await httpClient.post<ApiResponse<AuthUserResponse>>("/auth/register", payload);
  return mapAuthUser(response.data.data);
}

export async function getCurrentUserRequest(): Promise<CurrentUser> {
  const response = await httpClient.get<ApiResponse<AuthUserResponse>>("/auth/me");
  return mapAuthUser(response.data.data);
}
