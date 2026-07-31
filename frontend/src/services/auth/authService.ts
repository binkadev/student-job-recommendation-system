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
  return window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
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
