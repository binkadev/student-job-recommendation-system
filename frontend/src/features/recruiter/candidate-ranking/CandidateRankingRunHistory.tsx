import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import type { CandidateRankingRun } from "./candidateRankingTypes";

interface CandidateRankingRunHistoryProps {
  runs: CandidateRankingRun[];
  selectedRunId: string;
  onSelect: (runId: string) => void;
}

const runStatusLabels: Record<CandidateRankingRun["status"], string> = {
  PENDING: "Đang chờ",
  PROCESSING: "Đang xử lý",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  UNKNOWN: "Chưa cập nhật",
};

export function CandidateRankingRunHistory({ runs, selectedRunId, onSelect }: CandidateRankingRunHistoryProps) {
  if (!runs.length) return <Card><EmptyState message="Chưa có lịch sử xếp hạng cho vị trí này." /></Card>;
  const activeRunId = selectedRunId || runs[0].id;
  return (
    <Card>
      <SectionHeader title="Lịch sử xếp hạng" description="Chọn một lần chạy để xem kết quả và giới hạn của từng nhóm tại thời điểm đó." />
      <div className="grid max-h-[32rem] gap-3 overflow-y-auto overscroll-contain sm:grid-cols-2">
        {runs.map((run) => (
          <button
            key={run.id}
            type="button"
            aria-pressed={activeRunId === run.id}
            onClick={() => onSelect(run.id)}
            className={`min-w-0 rounded-xl border p-4 text-left text-sm transition-colors ${activeRunId === run.id ? "border-brand-400 bg-brand-50 ring-1 ring-brand-200" : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-slate-950">Lần chạy #{run.id}</strong>
              <StatusBadge label={runStatusLabels[run.status]} tone={runStatusTone(run.status)} />
            </div>
            <p className="mt-1 text-slate-600">{run.startedAt}</p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-500">{run.resultCount} kết quả · {run.algorithmVersion}</p>
            <p className="mt-1 text-xs text-slate-500">{formatRequestedLimits(run)}</p>
          </button>
        ))}
        {selectedRunId ? <Button variant="secondary" onClick={() => onSelect("")}>Dùng lần chạy mới nhất</Button> : null}
      </div>
    </Card>
  );
}

function formatRequestedLimits(run: CandidateRankingRun) {
  if (run.requestedPrimaryLimit != null || run.requestedFallbackLimit != null) {
    return `Phù hợp tổng thể: ${run.requestedPrimaryLimit ?? 0} · Đối sánh kỹ năng: ${run.requestedFallbackLimit ?? 0}`;
  }
  return run.requestedLimit != null ? `Giới hạn lịch sử: ${run.requestedLimit}` : "Giới hạn: Chưa cập nhật";
}

function runStatusTone(status: CandidateRankingRun["status"]) {
  if (status === "SUCCESS") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "PROCESSING" || status === "PENDING") return "warning" as const;
  return "neutral" as const;
}
