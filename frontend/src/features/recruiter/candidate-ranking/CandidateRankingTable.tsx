import { BookmarkCheck, BookmarkPlus, Eye, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { RecruiterDataTable } from "../RecruiterDataTable";
import { getScorePresentation } from "../../shared/ranking/rankingScoreTypes";
import { formatScore } from "./candidateRankingMappers";
import type { CandidateRankingApplicationStatus, CandidateRankingResult } from "./candidateRankingTypes";

const applicationStatusLabels: Record<CandidateRankingApplicationStatus | "UNKNOWN", string> = {
  PENDING: "Chờ xử lý",
  REVIEWED: "Đã xem",
  ACCEPTED: "Đã nhận",
  REJECTED: "Từ chối",
  WITHDRAWN: "Ứng viên rút đơn",
  UNKNOWN: "Chưa cập nhật",
};

interface CandidateRankingTableProps {
  results: CandidateRankingResult[];
  savedApplicationIds: Set<string>;
  onAnalyze: (result: CandidateRankingResult) => void;
  onSave: (result: CandidateRankingResult) => void;
}

export function CandidateRankingTable({ results, savedApplicationIds, onAnalyze, onSave }: CandidateRankingTableProps) {
  return (
    <RecruiterDataTable
      rows={results}
      getRowKey={(result) => `${result.applicationId}-${result.rankingTier}-${result.tierRankPosition}-${result.id}`}
      columns={[
        { key: "rank", header: "Hạng trong nhóm", render: (result) => <strong className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl px-2 tabular-nums ${result.rankingTier === "FALLBACK" ? "bg-amber-50 text-amber-900" : "bg-brand-50 text-brand-800"}`}>{result.tierRankPosition ? `#${result.tierRankPosition}` : "—"}</strong> },
        { key: "candidate", header: "Ứng viên", render: (result) => <CandidateCell result={result} /> },
        { key: "score", header: "Kết quả đối sánh", render: (result) => <ScoreCell result={result} /> },
        { key: "matched", header: "Kỹ năng phù hợp", render: (result) => <SkillChips skills={result.matchedSkills} /> },
        { key: "missing", header: "Kỹ năng thiếu", render: (result) => <SkillChips skills={result.missingSkills} tone="warning" /> },
        { key: "status", header: "Trạng thái", render: (result) => <div className="min-w-24 whitespace-nowrap"><StatusBadge label={applicationStatusLabels[result.applicationStatus]} tone={statusTone(result.applicationStatus)} /></div> },
        { key: "actions", header: "Thao tác", render: (result) => <Actions result={result} saved={savedApplicationIds.has(result.applicationId)} onAnalyze={onAnalyze} onSave={onSave} /> },
      ]}
    />
  );
}

function CandidateCell({ result }: { result: CandidateRankingResult }) {
  return (
    <div className="flex min-w-0 items-center gap-3 xl:min-w-48">
      <Avatar name={result.studentName || result.studentEmail} />
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{result.studentName}</p>
        <p className="truncate text-xs text-slate-500">{result.studentEmail}</p>
        <p className="mt-1 max-w-56 truncate text-xs text-slate-500" title={result.cvFileName || undefined}>{result.cvFileName || "Chưa có CV"}</p>
      </div>
    </div>
  );
}

function ScoreCell({ result }: { result: CandidateRankingResult }) {
  const presentation = getScorePresentation(result);

  return (
    <div className={`min-w-28 rounded-xl border p-3 ${result.rankingTier === "FALLBACK" ? "border-amber-200 bg-amber-50/60" : "border-brand-100 bg-brand-50/60"}`}>
      <p className={`text-xs font-semibold ${result.rankingTier === "FALLBACK" ? "text-amber-900" : "text-brand-700"}`}>{presentation.label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-950">{formatScore(presentation.value)}</p>
      {result.rankingTier === "FALLBACK" ? <p className="mt-1 text-xs text-amber-900">Chỉ đối sánh kỹ năng</p> : null}
      <div className="mt-1 space-y-0.5 text-xs leading-5 text-slate-500">
        <p>Final Score: {formatScore(result.overallScore)}</p>
        <p>Text Score: {formatScore(result.textScore)}</p>
        <p>Skill Score: {formatScore(result.skillScore)}</p>
      </div>
    </div>
  );
}

function SkillChips({ skills, tone = "neutral" }: { skills: string[]; tone?: "neutral" | "warning" }) {
  if (!skills.length) return <span className="text-xs text-slate-500">Không có dữ liệu</span>;
  return (
    <div className="flex max-w-56 flex-wrap gap-1">
      {skills.slice(0, 3).map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />)}
      {skills.length > 3 ? <StatusBadge label={`+${skills.length - 3}`} /> : null}
    </div>
  );
}

interface ActionsProps {
  result: CandidateRankingResult;
  saved: boolean;
  onAnalyze: (result: CandidateRankingResult) => void;
  onSave: (result: CandidateRankingResult) => void;
}

function Actions({ result, saved, onAnalyze, onSave }: ActionsProps) {
  const buttonClass = "w-full justify-start whitespace-nowrap px-3";

  return (
    <div className="grid w-28 gap-1.5">
      <Link to={`/recruiter/candidates/${result.applicationId}`} className="block">
        <Button className={buttonClass} size="sm" variant="secondary" icon={<Eye size={14} />}>Chi tiết</Button>
      </Link>
      <Button className={buttonClass} size="sm" variant="secondary" icon={<Search size={14} />} onClick={() => onAnalyze(result)}>Phân tích</Button>
      <Button className={buttonClass} size="sm" variant="secondary" icon={saved ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />} disabled={saved} onClick={() => onSave(result)}>{saved ? "Đã lưu" : "Lưu"}</Button>
    </div>
  );
}

function statusTone(status: CandidateRankingApplicationStatus | "UNKNOWN") {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger" as const;
  if (status === "REVIEWED") return "warning" as const;
  return "neutral" as const;
}
