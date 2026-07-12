export type UserRole = "candidate" | "recruiter" | "admin";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}
