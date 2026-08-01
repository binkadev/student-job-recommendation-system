import { Link } from "react-router-dom";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { formatScore } from "./candidateRankingMappers";
import type { CandidateRankingResult, CandidateRankingRun } from "./candidateRankingTypes";

interface CandidateRankingAnalysisModalProps {
  result: CandidateRankingResult | null;
  run: CandidateRankingRun | null;
  onClose: () => void;
  onOpenCv: (result: CandidateRankingResult) => void;
}

export function CandidateRankingAnalysisModal({ result, run, onClose, onOpenCv }: CandidateRankingAnalysisModalProps) {
  if (!result) return null;
  return (
    <Modal open={Boolean(result)} title={`Phân tích ${result.studentName}`} size="lg" onClose={onClose}>
      <div className="max-h-[72vh] overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-3">
          <Card><Score label="Điểm tổng" value={formatScore(result.score)} /></Card>
          <Card><Score label="Điểm nội dung" value={formatScore(result.textScore)} /></Card>
          <Card><Score label="Điểm kỹ năng" value={formatScore(result.skillScore)} /></Card>
        </div>
        <Card className="mt-4">
          <SectionHeader title="Thông tin dữ liệu" />
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Cách chấm điểm" value={result.scoringStrategy || "Chưa có API xếp hạng"} />
            <Info label="Nguồn dữ liệu" value={run?.algorithmVersion || "Danh sách ứng viên"} />
            <Info label="Thứ tự hiển thị" value={result.rankPosition == null ? "Chưa cập nhật" : `#${result.rankPosition}`} />
            <Info label="Mã ứng tuyển" value={`#${result.applicationId}`} />
          </div>
        </Card>
        <Card className="mt-4">
          <SectionHeader title="Kỹ năng phù hợp" />
          <SkillList skills={result.matchedSkills} />
        </Card>
        <Card className="mt-4">
          <SectionHeader title="Kỹ năng thiếu" />
          <SkillList skills={result.missingSkills} tone="warning" />
        </Card>
        <Card className="mt-4">
          <SectionHeader title="Giải thích" />
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{result.reason || "Backend chưa trả explanation cho kết quả này."}</p>
        </Card>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Link to={`/recruiter/candidates/${result.applicationId}`}><Button>Chi tiết ứng tuyển</Button></Link>
          <Button variant="secondary" disabled={!result.cvFileId} onClick={() => onOpenCv(result)}>Xem CV</Button>
        </div>
      </div>
    </Modal>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <strong className="mt-1 block text-2xl text-slate-950">{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SkillList({ skills, tone = "neutral" }: { skills: string[]; tone?: "neutral" | "warning" }) {
  if (!skills.length) return <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />)}
    </div>
  );
}
