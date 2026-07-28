import type { PublicJobListItem } from "../../public/jobs/jobsListTypes";

export interface SavedJobItem extends PublicJobListItem {
  savedAt: string;
  benefits: string[];
  displayStatus: "active" | "featured" | "urgent" | "expired";
}
