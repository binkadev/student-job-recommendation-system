import { BookmarkCheck, GitCompare, MapPin, Search, Send, Sparkles, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../../components/common/PageContainer";
import { PageHeader } from "../../../components/common/PageHeader";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { useAppliedJobs } from "../../public/jobs/useAppliedJobs";
import { useSavedJobs } from "../../../hooks/useSavedJobs";
import { useToast } from "../../../hooks/useToast";
import { buildSavedJobs } from "./savedJobsMockData";
import type { SavedJobItem } from "./savedJobsTypes";

const statusLabels: Record<SavedJobItem["displayStatus"], { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  active: { label: "Đang tuyển", tone: "success" },
  featured: { label: "Nổi bật", tone: "success" },
  urgent: { label: "Tuyển gấp", tone: "warning" },
  expired: { label: "Hết hạn", tone: "danger" },
};

export function CandidateSavedJobsPage() {
  const { savedJobIds, toggleSavedJob } = useSavedJobs();
  const { hasApplied, applyToJob } = useAppliedJobs();
  const { showToast } = useToast();
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<SavedJobItem | null>(null);

  const savedJobs = useMemo(() => buildSavedJobs(savedJobIds), [savedJobIds]);
  const selectedJobs = useMemo(() => savedJobs.filter((job) => selectedCompareIds.includes(job.id)), [savedJobs, selectedCompareIds]);

  function removeSaved(job: SavedJobItem) {
    toggleSavedJob(job.id);
    setSelectedCompareIds((current) => current.filter((id) => id !== job.id));
    showToast({ type: "success", title: "Đã bỏ lưu", message: `${job.title} đã được xóa khỏi danh sách việc làm đã lưu.` });
  }

  function toggleCompare(job: SavedJobItem) {
    setSelectedCompareIds((current) => {
      if (current.includes(job.id)) return current.filter((id) => id !== job.id);
      if (current.length >= 3) {
        showToast({ type: "error", title: "Chỉ chọn tối đa 3 việc làm", message: "Vui lòng bỏ chọn một việc làm trước khi thêm lựa chọn mới." });
        return current;
      }
      return [...current, job.id];
    });
  }

  function openApply(job: SavedJobItem) {
    if (job.displayStatus === "expired") {
      showToast({ type: "error", title: "Việc làm đã hết hạn", message: "Bạn không thể ứng tuyển việc làm đã quá hạn ứng tuyển." });
      return;
    }
    if (hasApplied(job.id)) {
      showToast({ type: "error", title: "Không thể ứng tuyển trùng", message: "Bạn đã ứng tuyển việc làm này trước đó." });
      return;
    }
    setApplyJob(job);
  }

  function confirmApply() {
    if (!applyJob) return;
    applyToJob(applyJob.id);
    showToast({ type: "success", title: "Ứng tuyển thành công", message: `Hồ sơ đã được gửi đến ${applyJob.companyName}.` });
    setApplyJob(null);
  }

  return (
    <PageContainer>
      <PageHeader title="Việc làm đã lưu" description="Quản lý các việc làm đã lưu, ứng tuyển nhanh và so sánh tối đa 3 lựa chọn trước khi quyết định." />

      {savedJobs.length === 0 ? (
        <Card>
          <EmptyState message="Chưa có việc làm đã lưu." />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link to="/candidate/jobs">
              <Button icon={<Search size={16} />}>Chuyển sang tìm việc</Button>
            </Link>
            <Link to="/candidate/jobs/recommended">
              <Button variant="secondary" icon={<Sparkles size={16} />}>Chuyển sang việc làm gợi ý</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{savedJobs.length} việc làm đã lưu</p>
                <p className="mt-1 text-sm text-slate-600">Đã chọn {selectedCompareIds.length}/3 việc làm để so sánh.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Trash2 size={16} />} onClick={() => setSelectedCompareIds([])} disabled={selectedCompareIds.length === 0}>
                  Xóa toàn bộ lựa chọn so sánh
                </Button>
                <Button icon={<GitCompare size={16} />} onClick={() => setCompareOpen(true)} disabled={selectedCompareIds.length < 2}>
                  So sánh việc làm
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            {savedJobs.map((job) => (
              <SavedJobCard
                key={job.id}
                job={job}
                selected={selectedCompareIds.includes(job.id)}
                applied={hasApplied(job.id)}
                onToggleCompare={() => toggleCompare(job)}
                onRemoveSaved={() => removeSaved(job)}
                onApply={() => openApply(job)}
              />
            ))}
          </div>
        </>
      )}

      <CompareJobsModal open={compareOpen} jobs={selectedJobs} onClose={() => setCompareOpen(false)} />
      <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} onConfirm={confirmApply} />
    </PageContainer>
  );
}

function SavedJobCard({
  job,
  selected,
  applied,
  onToggleCompare,
  onRemoveSaved,
  onApply,
}: {
  job: SavedJobItem;
  selected: boolean;
  applied: boolean;
  onToggleCompare: () => void;
  onRemoveSaved: () => void;
  onApply: () => void;
}) {
  const status = statusLabels[job.displayStatus];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={`Lưu ngày ${formatDate(job.savedAt)}`} />
            <StatusBadge label={status.label} tone={status.tone} />
            <StatusBadge label={`Match ${job.matchScore}%`} tone="success" />
          </div>
          <Link to={`/candidate/jobs/${job.id}`} className="mt-3 block text-lg font-semibold text-slate-950 hover:text-brand-700">
            {job.title}
          </Link>
          <p className="mt-1 text-sm font-medium text-slate-700">{job.companyName}</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <span className="inline-flex items-center gap-2"><Wallet size={16} />{job.salary}</span>
            <span className="inline-flex items-center gap-2"><MapPin size={16} />{job.location}</span>
            <span>{job.experienceLabel}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.skills.map((skill) => <StatusBadge key={skill} label={skill} />)}
          </div>
          <p className="mt-3 text-sm text-slate-500">Hạn ứng tuyển: {formatDate(job.deadline)}</p>
        </div>

        <div className="flex w-full flex-wrap justify-end gap-2 lg:w-auto">
          <Button variant="secondary" size="sm" icon={<BookmarkCheck size={16} />} onClick={onRemoveSaved}>Bỏ lưu</Button>
          <Link to={`/candidate/jobs/${job.id}`}>
            <Button variant="secondary" size="sm">Xem chi tiết</Button>
          </Link>
          <Button size="sm" icon={<Send size={16} />} onClick={onApply} disabled={job.displayStatus === "expired" || applied}>
            {job.displayStatus === "expired" ? "Hết hạn" : applied ? "Đã ứng tuyển" : "Ứng tuyển"}
          </Button>
          <Button variant={selected ? "primary" : "secondary"} size="sm" icon={<GitCompare size={16} />} onClick={onToggleCompare}>
            {selected ? "Đã chọn so sánh" : "Chọn để so sánh"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CompareJobsModal({ open, jobs, onClose }: { open: boolean; jobs: SavedJobItem[]; onClose: () => void }) {
  return (
    <Modal open={open} title="So sánh việc làm đã lưu" onClose={onClose}>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] border-collapse text-sm">
          <tbody className="[&_th]:w-40 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-3 [&_th]:text-left [&_th]:font-semibold [&_td]:min-w-48 [&_td]:border [&_td]:border-slate-200 [&_td]:p-3 [&_td]:align-top">
            <CompareRow label="Tên công việc" jobs={jobs} render={(job) => job.title} />
            <CompareRow label="Công ty" jobs={jobs} render={(job) => job.companyName} />
            <CompareRow label="Mức lương" jobs={jobs} render={(job) => job.salary} />
            <CompareRow label="Địa điểm" jobs={jobs} render={(job) => job.location} />
            <CompareRow label="Kinh nghiệm" jobs={jobs} render={(job) => job.experienceLabel} />
            <CompareRow label="Kỹ năng" jobs={jobs} render={(job) => job.skills.join(", ")} />
            <CompareRow label="Quyền lợi" jobs={jobs} render={(job) => job.benefits.join(", ")} />
            <CompareRow label="Hình thức làm việc" jobs={jobs} render={(job) => job.workMode} />
            <CompareRow label="Match score" jobs={jobs} render={(job) => `${job.matchScore}%`} />
            <CompareRow label="Hạn ứng tuyển" jobs={jobs} render={(job) => formatDate(job.deadline)} />
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function CompareRow({ label, jobs, render }: { label: string; jobs: SavedJobItem[]; render: (job: SavedJobItem) => string }) {
  return (
    <tr>
      <th>{label}</th>
      {jobs.map((job) => (
        <td key={job.id}>{render(job)}</td>
      ))}
    </tr>
  );
}

function ApplyModal({ job, onClose, onConfirm }: { job: SavedJobItem | null; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={Boolean(job)} title="Xác nhận ứng tuyển" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          Bạn đang ứng tuyển vị trí <strong>{job?.title}</strong> tại <strong>{job?.companyName}</strong>.
        </p>
        <div className="rounded-md bg-slate-50 p-3">
          <p>Mức lương: <strong>{job?.salary}</strong></p>
          <p>Địa điểm: <strong>{job?.location}</strong></p>
          <p>Match score: <strong>{job?.matchScore}%</strong></p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={onConfirm}>Xác nhận ứng tuyển</Button>
        </div>
      </div>
    </Modal>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
