import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6 ${className}`}>{children}</section>;
}
