import { Building2, MapPin, ShieldCheck, Users, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { FeaturedHomeCompany } from "./homeTypes";

export function NovaFeaturedCompanyCard({ company }: { company: FeaturedHomeCompany }) {
  return (
    <Link
      to={`/companies/${company.id}`}
      className="nova-company-card group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="nova-company-logo shrink-0">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
            ) : (
              company.logo
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-[#0c111c] group-hover:text-[#237d70] transition-colors truncate">
                {company.name}
              </h3>
              {company.verified ? (
                <ShieldCheck size={16} className="shrink-0 text-[#237d70]" aria-label="Đã xác thực" />
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-[#52637a] truncate">{company.industry || "Công nghệ thông tin"}</p>
          </div>
        </div>

        <ArrowUpRight size={16} className="text-[#9bb0c9] group-hover:text-[#0c111c] transition-colors shrink-0" />
      </div>

      <div className="mt-4 grid gap-2 text-xs font-medium text-[#52637a]">
        <span className="inline-flex items-center gap-2">
          <Users size={14} className="text-[#9bb0c9]" />
          {company.size || "Quy mô chưa cập nhật"}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin size={14} className="text-[#9bb0c9]" />
          {company.location || "Việt Nam"}
        </span>
        <span className="inline-flex items-center gap-2 font-semibold text-[#134b43]">
          <Building2 size={14} className="text-[#237d70]" />
          {company.openJobs == null ? "Chưa có số liệu tin đang tuyển" : `${company.openJobs} vị trí đang tuyển`}
        </span>
      </div>

      <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
            company.verified
              ? "bg-[#237d70]/10 text-[#134b43]"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${company.verified ? "bg-[#237d70]" : "bg-amber-500"}`} />
          {company.verified ? "Đã xác thực" : "Chờ xác thực"}
        </span>

        <span className="text-xs font-semibold text-[#52637a] group-hover:text-[#237d70] transition-colors">
          Xem hồ sơ
        </span>
      </div>
    </Link>
  );
}
