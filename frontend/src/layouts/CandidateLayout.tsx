import { candidateMenu } from "../constants/menu";
import { DashboardLayout } from "./DashboardLayout";

export function CandidateLayout() {
  return <DashboardLayout title="Ứng viên" menu={candidateMenu} />;
}
