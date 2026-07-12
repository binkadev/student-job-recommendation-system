import { withMockDelay } from "../../../utils/mockDelay";
import { candidateDashboardData } from "./candidateDashboardMockData";

export function getCandidateDashboardData() {
  return withMockDelay(candidateDashboardData);
}
