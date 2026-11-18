import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "default" | "none";
}

export function Card({ children, className = "", padding = "default" }: CardProps) {
  return (
    <section
      className={`neo-card min-w-0 rounded-[20px] border border-[#E2E8EE] bg-white shadow-soft transition-[border-color,box-shadow] duration-200 ${padding === "none" ? "p-0" : "p-5 sm:p-6"} ${className}`}
    >
      {children}
    </section>
  );
}
