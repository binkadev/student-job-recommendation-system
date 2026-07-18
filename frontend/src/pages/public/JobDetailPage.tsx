import { BriefcaseBusiness, Building2, CalendarDays, Copy, MapPin, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { JobDetailSkeleton } from "../../features/public/jobs/JobDetailSkeleton";
import { getPublicJobDetail } from "../../features/public/jobs/jobDetailService";
import type { JobDetailStatus } from "../../features/public/jobs/jobDetailTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";

const statusLabels: Record<JobDetailStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  open: { label: "Đang tuyển", tone: "success" },
  expired: { label: "Hết hạn ứng tuyển", tone: "warning" },
  closed: { label: "Đã đóng", tone: "danger" },
};

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const { currentRole, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
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

  const { job } = detailQuery.data;
  const cannotApply = job.detailStatus !== "open";

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard?.writeText(url);
      showToast({ type: "success", title: "Đã sao chép liên kết việc làm" });
    } catch {
      showToast({ type: "success", title: "Đã tạo liên kết chia sẻ", message: url });
    }
  }

  function goToCandidateJob(action: "apply" | "save") {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    if (currentRole !== "candidate") {
      showToast({ type: "error", title: "Tài khoản này không thể thao tác", message: "Vui lòng dùng tài khoản ứng viên để ứng tuyển hoặc lưu việc làm." });
      return;
    }
    navigate(`/candidate/jobs/${job.id}${action === "apply" ? "?apply=true" : ""}`);
  }

  const actionButtons = (
    <>
      <Button className="flex-1 md:flex-none" disabled={cannotApply} onClick={() => goToCandidateJob("apply")}>
        {job.detailStatus === "open" ? "Ứng tuyển" : "Không thể ứng tuyển"}
      </Button>
      <Button className="flex-1 md:flex-none" variant="secondary" onClick={() => goToCandidateJob("save")}>
        Lưu việc
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
                    <span className="font-medium text-slate-700">{job.companyName}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.requiredSkills.map((skill) => <StatusBadge key={skill} label={skill} />)}
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
              <InfoItem icon={<BriefcaseBusiness size={16} />} label={job.jobType} />
              <InfoItem icon={<Building2 size={16} />} label={job.workMode} />
              <InfoItem icon={<CalendarDays size={16} />} label={`Hạn: ${job.deadline}`} />
            </div>
          </Card>

          <ContentCard title="Mô tả công việc">
            {job.description ? <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{job.description}</p> : <EmptyState message="Tin tuyển dụng chưa có mô tả." />}
          </ContentCard>

          <ListCard title="Yêu cầu" items={job.requirements} emptyMessage="Tin tuyển dụng chưa có yêu cầu." />

          <Card>
            <SectionHeader title="Kỹ năng" />
            {job.requiredSkills.length ? (
              <div className="flex flex-wrap gap-2">{job.requiredSkills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div>
            ) : <EmptyState message="Tin tuyển dụng chưa có kỹ năng yêu cầu." />}
          </Card>

          <ListCard title="Quyền lợi" items={job.benefits} emptyMessage="Tin tuyển dụng chưa có quyền lợi." />

          <Card>
            <SectionHeader title="Thông tin chưa có API public" />
            <div className="flex flex-wrap gap-2">
              {["Lượt xem", "Số ứng viên", "Match score", "Quy trình tuyển dụng", "Chi tiết công ty", "Thời gian làm việc"].map((item) => <StatusBadge key={item} label={item} />)}
            </div>
          </Card>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Ứng tuyển nhanh" />
            <div className="grid gap-2">{actionButtons}</div>
            {job.detailStatus !== "open" ? <p className="mt-3 text-sm text-slate-500">Việc làm này hiện không còn nhận hồ sơ mới.</p> : null}
            <p className="mt-3 text-sm text-slate-500">Public page không ghi ứng tuyển vào localStorage. Ứng viên sẽ được chuyển sang flow ứng tuyển thật.</p>
          </Card>

          <Card>
            <SectionHeader title="Thông tin công ty" />
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700">{job.logo}</div>
              <div>
                <p className="font-semibold text-slate-900">{job.companyName}</p>
                <p className="text-sm text-slate-600">Company ID: {job.companyId}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Backend hiện chưa có API public chi tiết công ty.</p>
          </Card>

          <Card>
            <SectionHeader title="Việc làm tương tự" />
            <EmptyState message="Backend hiện chưa có API việc làm tương tự." />
          </Card>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 shadow-lg md:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">{actionButtons}</div>
      </div>

      <Modal open={loginModalOpen} title="Đăng nhập để tiếp tục" onClose={() => setLoginModalOpen(false)}>
        <p className="text-sm leading-6 text-slate-600">Bạn cần đăng nhập hoặc tạo tài khoản ứng viên để ứng tuyển hoặc lưu việc làm.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/login"><Button onClick={() => setLoginModalOpen(false)}>Đăng nhập</Button></Link>
          <Link to="/register/candidate"><Button variant="secondary" onClick={() => setLoginModalOpen(false)}>Đăng ký ứng viên</Button></Link>
        </div>
      </Modal>
    </PageContainer>
  );
}

function InfoItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-2">{icon}{label}</span>;
}

function ContentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {children}
    </Card>
  );
}

function ListCard({ title, items, emptyMessage }: { title: string; items: string[]; emptyMessage: string }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {items.length ? (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : <EmptyState message={emptyMessage} />}
    </Card>
  );
}
