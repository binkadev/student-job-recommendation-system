import type { ReactNode } from "react";

export function PageContainer({ children }: { children: ReactNode }) {
  return <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-9">{children}</main>;
}
