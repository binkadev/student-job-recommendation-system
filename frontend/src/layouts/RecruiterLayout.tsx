import { Building2 } from "lucide-react";
import { recruiterMenu } from "../constants/menu";
import { DashboardLayout } from "./DashboardLayout";

function CompanySelectorPlaceholder() {
  return (
    <button className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:inline-flex">
      <Building2 size={16} />
      Công ty mẫu
    </button>
  );
}

export function RecruiterLayout() {
  return <DashboardLayout title="Nhà tuyển dụng" menu={recruiterMenu} extra={<CompanySelectorPlaceholder />} />;
}
