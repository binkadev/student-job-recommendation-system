import { BarChart3, Brain, FileCheck2, FileX2, Users } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import type { CandidateRankingRun } from "./candidateRankingTypes";

export function CandidateRankingSummary({ run }: { run: CandidateRankingRun }) {
  const skipped = run.skippedNoCv + run.skippedNotReady + run.skippedTerminalStatus;
  const items = [
    { label: "Tổng hồ sơ", value: run.totalApplications, icon: Users },
    { label: "Đủ điều kiện", value: run.eligibleCandidates, icon: FileCheck2 },
    { label: "Bị bỏ qua", value: skipped, icon: FileX2 },
    { label: "Kết quả hiển thị", value: run.resultCount, icon: BarChart3 },
    { label: "Thuật toán", value: run.algorithmVersion, icon: Brain },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
