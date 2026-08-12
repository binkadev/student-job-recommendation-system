import { BarChart3, FileCheck2, FileX2, Users } from "lucide-react";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Card } from "../../../components/ui/Card";
import type { CandidateRankingRun } from "./candidateRankingTypes";

export function CandidateRankingSummary({ run }: { run: CandidateRankingRun }) {
  const skipped = run.skippedNoCv + run.skippedNotReady + run.skippedTerminalStatus;
  const items = [
    { label: "Tổng hồ sơ", value: run.totalApplications, icon: Users },
    { label: "Đủ điều kiện", value: run.eligibleCandidates, icon: FileCheck2 },
    { label: "Bị bỏ qua", value: skipped, icon: FileX2 },
    { label: "Kết quả hiển thị", value: run.resultCount, icon: BarChart3 },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <p className="text-sm font-medium text-slate-500">Trạng thái lần chạy</p>
        <div className="mt-2"><StatusBadge label={runStatusLabel(run.status)} tone={statusTone(run.status)} /></div>
      </Card>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <div className="flex items-center gap-2 text-brand-700">
              <Icon size={18} />
              <p className="text-sm font-medium">{item.label}</p>
            </div>
            <strong className="mt-2 block text-2xl text-slate-950">{item.value}</strong>
          </Card>
        );
      })}
    </div>
  );
}

function runStatusLabel(status: CandidateRankingRun["status"]) {
  if (status === "SUCCESS") return "Thành công";
  if (status === "FAILED") return "Thất bại";
  if (status === "PROCESSING") return "Đang xử lý";
  if (status === "PENDING") return "Đang chờ";
  return "Chưa cập nhật";
}

function statusTone(status: CandidateRankingRun["status"]) {
  if (status === "SUCCESS") return "success" as const;
  if (status === "FAILED") return "danger" as const;
  if (status === "PROCESSING" || status === "PENDING") return "warning" as const;
  return "neutral" as const;
}
