import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "default" | "none";
}

export function Card({ children, className = "", padding = "default" }: CardProps) {
  return <section className={`neo-card min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-soft ${padding === "none" ? "p-0" : "p-5 sm:p-6"} ${className}`}>{children}</section>;
}
