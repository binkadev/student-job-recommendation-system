import { adminMenu } from "../constants/menu";
import { DashboardLayout } from "./DashboardLayout";

export function AdminLayout() {
  return <DashboardLayout title="Quản trị viên" menu={adminMenu} />;
}
