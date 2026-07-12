import { Bookmark, BookmarkCheck, BriefcaseBusiness, Building2, CalendarDays, Clock, Copy, MapPin, ShieldCheck, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { JobDetailSkeleton } from "../../features/public/jobs/JobDetailSkeleton";
import { getPublicJobDetail } from "../../features/public/jobs/jobDetailService";
import type { JobDetailStatus } from "../../features/public/jobs/jobDetailTypes";
import { useAppliedJobs } from "../../features/public/jobs/useAppliedJobs";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useToast } from "../../hooks/useToast";

const statusLabels: Record<JobDetailStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  open: { label: "Đang tuyển", tone: "success" },
  expired: { label: "Hết hạn ứng tuyển", tone: "warning" },
  closed: { label: "Đã đóng", tone: "danger" },
};

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const { currentRole, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const { hasApplied, applyToJob } = useAppliedJobs();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const detailQuery = useAsyncData(() => getPublicJobDetail(jobId), [jobId, reloadKey]);

  if (detailQuery.loading) {
    return (
      <PageContainer>
        <JobDetailSkeleton />
      </PageContainer>
    );
  }

  if (detailQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={detailQuery.error} />
        <div className="mt-4">
          <Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button>
        </div>
      </PageContainer>
    );
  }

  if (!detailQuery.data) {
    return (
      <PageContainer>
        <ErrorState message="Không tìm thấy việc làm." />
        <div className="mt-4">
          <Link to="/jobs"><Button variant="secondary">Quay lại danh sách việc làm</Button></Link>
        </div>
      </PageContainer>
    );
  }

  const { job, similarJobs } = detailQuery.data;
  const applied = hasApplied(job.id);
  const cannotApply = job.detailStatus !== "open" || applied;
  const saved = isSaved(job.id);

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard?.writeText(url);
      showToast({ type: "success", title: "Đã sao chép liên kết việc làm" });
    } catch {
      showToast({ type: "success", title: "Đã tạo liên kết chia sẻ", message: url });
    }
  }

  function handleApplyClick() {
    if (job.detailStatus !== "open" || applied) return;
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    if (currentRole !== "candidate") {
      showToast({ type: "error", title: "Tài khoản này không thể ứng tuyển", message: "Vui lòng dùng tài khoản ứng viên để ứng tuyển việc làm." });
      return;
    }
    setApplyModalOpen(true);
  }

  function confirmApply() {
    applyToJob(job.id);
    setApplyModalOpen(false);
    showToast({ type: "success", title: "Ứng tuyển thành công", message: "Hồ sơ ứng tuyển đã được ghi nhận trong dữ liệu mock." });
  }

  const actionButtons = (
    <>
      <Button className="flex-1 md:flex-none" disabled={cannotApply} onClick={handleApplyClick}>
        {applied ? "Đã ứng tuyển" : job.detailStatus === "open" ? "Ứng tuyển" : "Không thể ứng tuyển"}
      </Button>
      <Button className="flex-1 md:flex-none" variant="secondary" icon={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} onClick={() => toggleSavedJob(job.id)}>
        {saved ? "Đã lưu" : "Lưu"}
      </Button>
      <Button className="flex-1 md:flex-none" variant="secondary" icon={<Copy size={16} />} onClick={() => void handleShare()}>
        Chia sẻ
      </Button>
    </>
  );

  return (
    <PageContainer>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <main className="space-y-5 pb-24 lg:pb-0">
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg font-semibold text-brand-700">{job.logo}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold text-slate-950">{job.title}</h1>
                    <StatusBadge label={statusLabels[job.detailStatus].label} tone={statusLabels[job.detailStatus].tone} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Link to={`/companies/${job.companyId}`} className="font-medium text-slate-700 hover:text-brand-700">{job.companyName}</Link>
                    {job.companyVerified ? <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck size={16} />Đã xác thực</span> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.requiredSkills.map((skill) => <StatusBadge key={skill} label={skill} />)}
                    <StatusBadge label={`Phù hợp ${job.matchScore}%`} tone="success" />
                  </div>
                </div>
              </div>
              <div className="hidden flex-wrap gap-2 md:flex">{actionButtons}</div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Thông tin tổng quan" />
            <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
              <InfoItem icon={<Wallet size={16} />} label={job.salary} />
              <InfoItem icon={<MapPin size={16} />} label={job.location} />
              <InfoItem icon={<Clock size={16} />} label={job.experienceLabel} />
              <InfoItem icon={<BriefcaseBusiness size={16} />} label={job.level} />
              <InfoItem icon={<Building2 size={16} />} label={job.jobType} />
              <InfoItem icon={<CalendarDays size={16} />} label={`Hạn: ${job.deadline}`} />
              <InfoItem icon={<Users size={16} />} label={`Tuyển ${job.hiringQuantity} người`} />
              <InfoItem icon={<Users size={16} />} label={`${job.views} lượt xem`} />
              <InfoItem icon={<Users size={16} />} label={`${job.applicants} đã ứng tuyển`} />
            </div>
          </Card>

          <ContentCard title="Mô tả công việc">
            <p className="text-sm leading-6 text-slate-700">{job.description}</p>
          </ContentCard>

          <ListCard title="Trách nhiệm" items={job.responsibilities} />
          <ListCard title="Yêu cầu" items={job.requirements} />

          <Card>
            <SectionHeader title="Kỹ năng" />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Kỹ năng bắt buộc</h3>
                <div className="mt-3 flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Kỹ năng ưu tiên</h3>
                <div className="mt-3 flex flex-wrap gap-2">{job.preferredSkills.map((skill) => <StatusBadge key={skill} label={skill} tone="success" />)}</div>
              </div>
            </div>
          </Card>

          <ListCard title="Quyền lợi" items={job.benefits} />

          <Card>
            <SectionHeader title="Địa điểm và thời gian làm việc" />
            <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <InfoBlock label="Địa điểm làm việc" value={job.workplace} />
              <InfoBlock label="Thời gian làm việc" value={job.workingTime} />
            </div>
          </Card>

          <ListCard title="Quy trình tuyển dụng" items={job.recruitmentProcess} ordered />
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Ứng tuyển nhanh" />
            <div className="grid gap-2">{actionButtons}</div>
            {job.detailStatus !== "open" ? <p className="mt-3 text-sm text-slate-500">Việc làm này hiện không còn nhận hồ sơ mới.</p> : null}
            {applied ? <p className="mt-3 text-sm text-emerald-700">Bạn đã ứng tuyển công việc này trong dữ liệu mock.</p> : null}
          </Card>

          <Card>
            <SectionHeader title="Thông tin công ty" />
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700">{job.logo}</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900">{job.companyName}</p>
                  {job.companyVerified ? <ShieldCheck size={16} className="text-emerald-600" /> : null}
                </div>
                <p className="text-sm text-slate-600">{job.companyIndustry}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{job.companyDescription}</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <InfoItem icon={<Users size={16} />} label={job.companySize} />
              <InfoItem icon={<MapPin size={16} />} label={job.companyLocation} />
            </div>
            <Link to={`/companies/${job.companyId}`} className="mt-4 inline-flex">
              <Button variant="secondary" size="sm">Xem công ty</Button>
            </Link>
          </Card>

          <Card>
            <SectionHeader title="Việc làm tương tự" />
            <div className="grid gap-3">
              {similarJobs.map((item) => (
                <Link key={item.id} to={`/jobs/${item.id}`} className="rounded-lg border border-slate-200 p-3 hover:border-brand-200 hover:bg-brand-50">
                  <p className="font-medium text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.companyName}</p>
                  <p className="mt-2 text-sm text-slate-500">{item.salary} · {item.location}</p>
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 shadow-lg md:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">{actionButtons}</div>
      </div>

      <Modal open={loginModalOpen} title="Đăng nhập để ứng tuyển" onClose={() => setLoginModalOpen(false)}>
        <p className="text-sm leading-6 text-slate-600">Bạn cần đăng nhập hoặc tạo tài khoản ứng viên để tiếp tục quy trình ứng tuyển.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/login"><Button onClick={() => setLoginModalOpen(false)}>Đăng nhập</Button></Link>
          <Link to="/register/candidate"><Button variant="secondary" onClick={() => setLoginModalOpen(false)}>Đăng ký ứng viên</Button></Link>
        </div>
      </Modal>

      <Modal open={applyModalOpen} title="Xác nhận ứng tuyển" onClose={() => setApplyModalOpen(false)}>
        <p className="text-sm leading-6 text-slate-600">Bạn đang ứng tuyển vị trí <strong>{job.title}</strong> tại <strong>{job.companyName}</strong>. Hệ thống sẽ ghi nhận trạng thái ứng tuyển trong localStorage.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={confirmApply}>Xác nhận ứng tuyển</Button>
          <Button variant="secondary" onClick={() => setApplyModalOpen(false)}>Hủy</Button>
        </div>
      </Modal>
    </PageContainer>
  );
}

function InfoItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-2">{icon}{label}</span>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function ContentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {children}
    </Card>
  );
}

function ListCard({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Card>
      <SectionHeader title={title} />
      <Tag className={`${ordered ? "list-decimal" : "list-disc"} space-y-2 pl-5 text-sm leading-6 text-slate-700`}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </Tag>
    </Card>
  );
}
