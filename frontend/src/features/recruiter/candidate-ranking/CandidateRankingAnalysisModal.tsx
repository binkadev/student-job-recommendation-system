import { Link } from "react-router-dom";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { getScorePresentation } from "../../shared/ranking/rankingScoreTypes";
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
  const presentation = getScorePresentation(result);
  return (
    <Modal open={Boolean(result)} title={`Phân tích ${result.studentName}`} size="lg" onClose={onClose}>
      <div className="max-h-[72vh] overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-4">
          <Card><Score label={presentation.label} value={formatScore(presentation.value)} /></Card>
          <Card><Score label="Final Score" value={formatScore(result.overallScore)} /></Card>
          <Card><Score label="Text Score" value={formatScore(result.textScore)} /></Card>
          <Card><Score label="Skill Score" value={formatScore(result.skillScore)} /></Card>
        </div>
        <Card className="mt-4">
          <SectionHeader title="Thông tin thuật toán" />
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Chiến lược chấm điểm" value={scoringStrategyLabel(result.scoringStrategy)} />
            <Info label="Phiên bản thuật toán" value={run?.algorithmVersion || "Chưa cập nhật"} />
            <Info label="Hạng trong nhóm" value={result.tierRankPosition ? `#${result.tierRankPosition}` : "Không áp dụng"} />
            <Info label="Nhóm xếp hạng" value={presentation.tierLabel} />
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
          <SectionHeader title="Giải thích từ hệ thống" />
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{formatSystemExplanation(result)}</p>
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

function scoringStrategyLabel(strategy: string | null | undefined) {
  if (strategy === "SAME_LANGUAGE_HYBRID") return "Đối sánh cùng ngôn ngữ";
  if (strategy === "CROSS_LANGUAGE_SKILL_BASED") return "Đối sánh kỹ năng khác ngôn ngữ";
  return "Chưa cập nhật";
}

function SkillList({ skills, tone = "neutral" }: { skills: string[]; tone?: "neutral" | "warning" }) {
  if (!skills.length) return <p className="text-sm text-slate-500">Không có dữ liệu.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => <StatusBadge key={skill} label={skill} tone={tone} />)}
    </div>
  );
}

function formatSystemExplanation(result: CandidateRankingResult) {
  const matchedCount = result.matchedSkills.length;
  const missingCount = result.missingSkills.length;
  const totalSkills = matchedCount + missingCount;
  const matchedSkills = result.matchedSkills.join(", ");
  const missingSkills = result.missingSkills.join(", ");

  const lines: string[] = [];
  if (totalSkills > 0) {
    lines.push(`Ứng viên phù hợp ${matchedCount}/${totalSkills} kỹ năng${matchedSkills ? `: ${matchedSkills}` : ""}.`);
  }

  if (missingCount > 0) {
    lines.push(`Kỹ năng còn thiếu: ${missingSkills}.`);
  } else if (totalSkills > 0) {
    lines.push("Không thiếu kỹ năng bắt buộc.");
  }

  if (result.scoringStrategy === "CROSS_LANGUAGE_SKILL_BASED") {
    lines.push("Kết quả được tính bằng cách đối sánh kỹ năng chuẩn hóa giữa CV và tin tuyển dụng.");
  } else if (result.scoringStrategy === "SAME_LANGUAGE_HYBRID") {
    lines.push("Kết quả được tính từ mức tương đồng nội dung và mức độ phù hợp kỹ năng.");
  }

  if (lines.length) return lines.join("\n");
  return result.reason ? translateKnownExplanation(result.reason) : "Chưa có giải thích cho kết quả này.";
}

function translateKnownExplanation(reason: string) {
  return reason
    .replace(/Cross-language match is based on canonical skill overlap\./gi, "Kết quả được tính bằng cách đối sánh kỹ năng chuẩn hóa giữa CV và tin tuyển dụng.")
    .replace(/Matched (\d+) of (\d+):/gi, "Ứng viên phù hợp $1/$2 kỹ năng:")
    .replace(/Missing: none\./gi, "Không thiếu kỹ năng bắt buộc.")
    .replace(/Missing:/gi, "Kỹ năng còn thiếu:")
    .replace(/Same-language text similarity:/gi, "Độ tương đồng nội dung cùng ngôn ngữ:")
    .replace(/Canonical skill coverage:/gi, "Mức phủ kỹ năng chuẩn hóa:")
    .replace(/Skill-only matching found/gi, "Đối sánh theo kỹ năng tìm thấy")
    .replace(/canonical job skills/gi, "kỹ năng chuẩn hóa của tin tuyển dụng")
    .replace(/Missing job skills:/gi, "Kỹ năng tin tuyển dụng còn thiếu:")
    .replace(/Text similarity was not used because the document languages were not safe for same-language comparison\./gi, "Không dùng điểm tương đồng văn bản vì CV và tin tuyển dụng khác ngôn ngữ hoặc không đủ an toàn để so sánh cùng ngôn ngữ.");
}
