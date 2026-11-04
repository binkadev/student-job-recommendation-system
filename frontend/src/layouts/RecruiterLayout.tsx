import { Building2 } from "lucide-react";
import { recruiterMenu } from "../constants/menu";
import { DashboardLayout } from "./DashboardLayout";

function CompanyAccountLabel() {
  return (
    <span className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:inline-flex">
      <Building2 aria-hidden="true" size={16} />
      Tài khoản doanh nghiệp
    </span>
  );
}

export function RecruiterLayout() {
  return <DashboardLayout title="Nhà tuyển dụng" menu={recruiterMenu} extra={<CompanyAccountLabel />} variant="recruiter" />;
}
