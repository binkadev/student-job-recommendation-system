import { Building2, MapPin, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import type { Company } from "../../../types/domain";

interface CompanyCardProps {
  company: Company;
}

export function CompanyCard({ company }: CompanyCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700">{company.logo}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/companies/${company.id}`} className="font-semibold text-slate-950 hover:text-brand-700">
              {company.name}
            </Link>
            {company.verified ? <ShieldCheck size={16} className="text-emerald-600" /> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{company.description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2">
          <Building2 size={16} />
          {company.industry}
        </span>
        <span className="inline-flex items-center gap-2">
          <Users size={16} />
          {company.size}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin size={16} />
          {company.location}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <StatusBadge label={`${company.openJobs} việc đang tuyển`} tone={company.openJobs > 0 ? "success" : "neutral"} />
        <Link to={`/companies/${company.id}`}>
          <Button variant="secondary" size="sm">
            Xem công ty
          </Button>
        </Link>
      </div>
    </article>
  );
}
