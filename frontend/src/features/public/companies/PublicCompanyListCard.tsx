import { Building2, BriefcaseBusiness, MapPin, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import type { PublicCompanyListItem } from "./companiesListTypes";

export function PublicCompanyListCard({ company }: { company: PublicCompanyListItem }) {
  const jobTypes = company.jobTypes ?? [];
  const workingModels = company.workingModels ?? [];

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <Link to={`/companies/${company.id}`} className={`block h-24 ${company.cover}`} aria-label={`Xem ${company.name}`} />
      <div className="p-5">
        <div className="-mt-12 flex items-start gap-3">
          <Link to={`/companies/${company.id}`} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-white bg-slate-100 font-semibold text-slate-700 shadow-sm">
            {company.logo}
          </Link>
          <div className="min-w-0 pt-7">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/companies/${company.id}`} className="font-semibold text-slate-950 hover:text-brand-700">
                {company.name}
              </Link>
              {company.verified ? <ShieldCheck size={16} className="text-emerald-600" /> : null}
            </div>
            <div className="mt-1">
              <StatusBadge label={company.verified ? "Đã xác thực" : "Chưa có API xác thực"} tone={company.verified ? "success" : "warning"} />
            </div>
          </div>
        </div>

        <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{company.description}</p>

        <div className="mt-4 grid gap-2 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2"><Building2 size={16} />{company.industry}</span>
          <span className="inline-flex items-center gap-2"><Users size={16} />{company.size}</span>
          <span className="inline-flex items-center gap-2"><MapPin size={16} />{company.location}</span>
          {jobTypes.length ? <span className="inline-flex items-center gap-2"><BriefcaseBusiness size={16} />{jobTypes.join(", ")}</span> : null}
          {workingModels.length ? <span className="inline-flex items-center gap-2"><Building2 size={16} />{workingModels.join(", ")}</span> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link to={`/companies/${company.id}#jobs`} className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800">
            <BriefcaseBusiness size={16} /> {company.openJobs} việc đang tuyển
          </Link>
          <Link to={`/companies/${company.id}`}>
            <Button variant="secondary" size="sm">Xem công ty</Button>
          </Link>
        </div>
      </div>
    </article>
  );
}
