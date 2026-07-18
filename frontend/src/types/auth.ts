export type UserRole = "candidate" | "recruiter" | "admin";
export type BackendUserRole = "STUDENT" | "COMPANY" | "ADMIN";
export type BackendUserStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  status?: BackendUserStatus;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface AuthUserResponse {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  role: BackendUserRole;
  status: BackendUserStatus;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUserResponse;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role: Exclude<BackendUserRole, "ADMIN">;
  fullName?: string;
  phone?: string;
  companyName?: string;
}
