import type { LucideIcon } from "lucide-react";
import type { UserRole } from "./auth";

export interface AppRoute {
  path: string;
  title: string;
  description: string;
  role?: UserRole;
  section?: string;
  nextPath?: string;
  nextLabel?: string;
}

export interface MenuItem {
  label: string;
  path?: string;
  icon?: LucideIcon;
  children?: MenuItem[];
}
