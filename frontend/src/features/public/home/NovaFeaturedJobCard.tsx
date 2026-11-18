import { Bookmark, BookmarkCheck, BriefcaseBusiness, CalendarDays, MapPin, Wallet, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { FeaturedHomeJob } from "./homeTypes";

interface NovaFeaturedJobCardProps {
  job: FeaturedHomeJob;
  saved: boolean;
  onToggleSave: (jobId: string) => void;
}

export function NovaFeaturedJobCard({ job, saved, onToggleSave }: NovaFeaturedJobCardProps) {
  return (
    <article className="nova-job-card flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/jobs/${job.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-start gap-3.5 group"
          >
            <div className="nova-company-logo shrink-0 font-bold text-[#134b43]">
              {job.logo}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#0c111c] group-hover:text-[#237d70] transition-colors truncate">
                  {job.title}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#d5f36a]/25 px-2.5 py-0.5 text-[11px] font-bold text-[#134b43] border border-[#d5f36a]/50">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#134b43]" />
                  {job.featuredLabel}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-[#52637a]">{job.companyName}</p>
            </div>
          </Link>

          <button
            type="button"
            aria-label={saved ? "Bỏ lưu việc làm" : "Lưu việc làm"}
            onClick={() => onToggleSave(job.id)}
            className="shrink-0 rounded-xl p-2.5 text-[#52637a] hover:bg-[#f1f5f9] hover:text-[#0c111c] transition-colors focus-visible:outline-2 focus-visible:outline-[#237d70]"
          >
            {saved ? (
              <BookmarkCheck size={20} className="text-[#237d70]" />
            ) : (
              <Bookmark size={20} />
            )}
          </button>
        </div>

        {/* Metadata chips */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-[#52637a]">
          <span className="inline-flex items-center gap-1.5 text-[#0c111c]">
            <Wallet size={15} className="text-[#237d70]" />
            {job.salary}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} className="text-[#9bb0c9]" />
            {job.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusiness size={15} className="text-[#9bb0c9]" />
            {job.workMode}
          </span>
        </div>

        {job.description ? (
          <p className="mt-3.5 line-clamp-2 break-words text-sm leading-6 text-[#52637a]">
            {truncateDescription(job.description)}
          </p>
        ) : null}

        {/* Skills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="nova-tag nova-tag-skill">
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1f5f9] pt-4">
        <p className="inline-flex items-center gap-1.5 text-xs text-[#52637a]">
          <CalendarDays size={15} className="text-[#9bb0c9]" />
          Hạn: <span className="font-medium text-[#1b2533]">{job.deadline}</span>
        </p>

        <Link
          to={`/jobs/${job.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#237d70] hover:text-[#134b43] transition-colors"
        >
          Chi tiết tin <ArrowUpRight size={15} />
        </Link>
      </div>
    </article>
  );
}

function truncateDescription(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 150 ? `${normalized.slice(0, 150).trimEnd()}...` : normalized;
}
