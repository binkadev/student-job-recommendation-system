import { BookmarkPlus, Eye, FileText, Search, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Table } from "../../../components/ui/Table";
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

const statusOptions = [
  { label: "Đã xem", value: "REVIEWED" },
  { label: "Đã nhận", value: "ACCEPTED" },
  { label: "Từ chối", value: "REJECTED" },
];

interface CandidateRankingTableProps {
  results: CandidateRankingResult[];
  updatingId: string;
  onAnalyze: (result: CandidateRankingResult) => void;
  onOpenCv: (result: CandidateRankingResult) => void;
  onSave: (result: CandidateRankingResult) => void;
  onUpdateStatus: (result: CandidateRankingResult, status: string) => void;
}

export function CandidateRankingTable({ results, updatingId, onAnalyze, onOpenCv, onSave, onUpdateStatus }: CandidateRankingTableProps) {
  return (
    <Table
      rows={results}
      getRowKey={(result) => `${result.applicationId}-${result.rankPosition ?? result.id}`}
      columns={[
        { key: "rank", header: "Thứ tự", render: (result) => <strong className="text-slate-950">#{result.rankPosition}</strong> },
        { key: "candidate", header: "Ứng viên", render: (result) => <CandidateCell result={result} /> },
        { key: "score", header: "Điểm AI", render: (result) => <ScoreCell result={result} /> },
        { key: "matched", header: "Kỹ năng phù hợp", render: (result) => <SkillChips skills={result.matchedSkills} /> },
        { key: "missing", header: "Kỹ năng thiếu", render: (result) => <SkillChips skills={result.missingSkills} tone="warning" /> },
        { key: "status", header: "Trạng thái", render: (result) => <StatusBadge label={applicationStatusLabels[result.applicationStatus]} tone={statusTone(result.applicationStatus)} /> },
        { key: "actions", header: "Thao tác", render: (result) => <Actions result={result} updating={updatingId === result.applicationId} onAnalyze={onAnalyze} onOpenCv={onOpenCv} onSave={onSave} onUpdateStatus={onUpdateStatus} /> },
      ]}
    />
  );
}

function CandidateCell({ result }: { result: CandidateRankingResult }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={result.studentName || result.studentEmail} />
      <div>
        <p className="font-medium text-slate-900">{result.studentName}</p>
        <p className="text-xs text-slate-500">{result.studentEmail}</p>
        <p className="mt-1 text-xs text-slate-500">{result.cvFileName || "Chưa có CV"}</p>
      </div>
    </div>
  );
}

function ScoreCell({ result }: { result: CandidateRankingResult }) {
  if (result.score == null && result.textScore == null && result.skillScore == null) {
    return <span className="text-xs text-slate-500">Chưa có API xếp hạng</span>;
  }

  return (
    <div>
      <p className="font-semibold text-slate-950">{formatScore(result.score)}</p>
      <p className="text-xs text-slate-500">Text {formatScore(result.textScore)} · Skill {formatScore(result.skillScore)}</p>
    </div>
  );
}

function SkillChips({ skills, tone = "neutral" }: { skills: string[]; tone?: "neutral" | "warning" }) {
  if (!skills.length) return <span className="text-xs text-slate-500">Chưa có dữ liệu</span>;
  return (
    <div className="flex max-w-52 flex-wrap gap-1">
      {skills.slice(0, 3).map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />)}
      {skills.length > 3 ? <StatusBadge label={`+${skills.length - 3}`} /> : null}
    </div>
  );
}

interface ActionsProps {
  result: CandidateRankingResult;
  updating: boolean;
  onAnalyze: (result: CandidateRankingResult) => void;
  onOpenCv: (result: CandidateRankingResult) => void;
  onSave: (result: CandidateRankingResult) => void;
  onUpdateStatus: (result: CandidateRankingResult, status: string) => void;
}

function Actions({ result, updating, onAnalyze, onOpenCv, onSave, onUpdateStatus }: ActionsProps) {
  return (
    <div className="flex min-w-72 flex-wrap gap-2">
      <Link to={`/recruiter/candidates/${result.applicationId}`}><Button size="sm" variant="secondary" icon={<Eye size={14} />}>Chi tiết</Button></Link>
      <Button size="sm" variant="secondary" icon={<FileText size={14} />} disabled={!result.cvFileId} onClick={() => onOpenCv(result)}>CV</Button>
      <Button size="sm" variant="secondary" icon={<Search size={14} />} onClick={() => onAnalyze(result)}>Phân tích</Button>
      <Button size="sm" variant="secondary" icon={<BookmarkPlus size={14} />} disabled={result.saved} onClick={() => onSave(result)}>{result.saved ? "Đã lưu" : "Lưu"}</Button>
      <div className="w-36">
        <Select
          label="Trạng thái"
          value=""
          onChange={(event) => onUpdateStatus(result, event.target.value)}
          disabled={updating || result.applicationStatus === "ACCEPTED" || result.applicationStatus === "REJECTED" || result.applicationStatus === "WITHDRAWN"}
          options={[{ label: "Cập nhật", value: "" }, ...statusOptions]}
        />
      </div>
      {updating ? <UserCheck className="mt-2 text-brand-600" size={16} /> : null}
    </div>
  );
}

function statusTone(status: CandidateRankingApplicationStatus | "UNKNOWN") {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "REJECTED" || status === "WITHDRAWN") return "danger" as const;
  if (status === "REVIEWED") return "warning" as const;
  return "neutral" as const;
}
