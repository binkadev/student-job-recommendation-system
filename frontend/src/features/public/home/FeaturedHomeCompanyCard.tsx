import { Building2, MapPin, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import type { FeaturedHomeCompany } from "./homeTypes";

export function FeaturedHomeCompanyCard({ company }: { company: FeaturedHomeCompany }) {
  return (
    <Link to={`/companies/${company.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700">{company.logo}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{company.name}</h3>
            {company.verified ? <ShieldCheck size={16} className="text-emerald-600" /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">{company.industry}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2"><Users size={16} />{company.size}</span>
        <span className="inline-flex items-center gap-2"><MapPin size={16} />{company.location}</span>
        <span className="inline-flex items-center gap-2"><Building2 size={16} />{company.openJobs} tin đang tuyển</span>
      </div>
      <div className="mt-4">
        <StatusBadge label={company.verified ? "Đã xác thực" : "Chờ xác thực"} tone={company.verified ? "success" : "warning"} />
      </div>
    </Link>
  );
}
