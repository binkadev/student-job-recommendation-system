import { Building2 } from "lucide-react";
import { recruiterMenu } from "../constants/menu";
import { DashboardLayout } from "./DashboardLayout";

function CompanyAccountLabel() {
  return (
    <span className="hidden items-center gap-2 rounded-xl border border-[#D5DCE6] bg-[#F7F8F6] px-3 py-2 text-sm font-medium text-[#134B43] md:inline-flex">
      <Building2 aria-hidden="true" size={16} className="text-[#237D70]" />
      Tài khoản doanh nghiệp
    </span>
  );
}

export function RecruiterLayout() {
  return <DashboardLayout title="Nhà tuyển dụng" menu={recruiterMenu} extra={<CompanyAccountLabel />} variant="recruiter" />;
}
