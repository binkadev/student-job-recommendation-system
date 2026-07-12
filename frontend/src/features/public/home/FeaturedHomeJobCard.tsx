import { Bookmark, BookmarkCheck, BriefcaseBusiness, CalendarDays, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import type { FeaturedHomeJob } from "./homeTypes";

interface FeaturedHomeJobCardProps {
  job: FeaturedHomeJob;
  saved: boolean;
  onToggleSave: (jobId: string) => void;
}

export function FeaturedHomeJobCard({ job, saved, onToggleSave }: FeaturedHomeJobCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/jobs/${job.id}`} className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700">{job.logo}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-950 hover:text-brand-700">{job.title}</h3>
              <StatusBadge label={job.featuredLabel} tone="warning" />
            </div>
            <p className="mt-1 text-sm text-slate-600">{job.companyName}</p>
          </div>
        </Link>
        <button
          type="button"
          aria-label={saved ? "Bỏ lưu việc làm" : "Lưu việc làm"}
          onClick={() => onToggleSave(job.id)}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
        >
          {saved ? <BookmarkCheck size={20} className="text-brand-600" /> : <Bookmark size={20} />}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
        <span className="inline-flex items-center gap-2"><Wallet size={16} />{job.salary}</span>
        <span className="inline-flex items-center gap-2"><MapPin size={16} />{job.location}</span>
        <span className="inline-flex items-center gap-2"><BriefcaseBusiness size={16} />{job.workMode}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {job.skills.slice(0, 3).map((skill) => <StatusBadge key={skill} label={skill} />)}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16} />Hạn ứng tuyển: {job.deadline}</p>
        <Link to={`/jobs/${job.id}`}>
          <Button variant="secondary" size="sm">Xem chi tiết</Button>
        </Link>
      </div>
    </article>
  );
}
