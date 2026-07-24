import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Student Job Recommendation`;
  }, [title]);
}
