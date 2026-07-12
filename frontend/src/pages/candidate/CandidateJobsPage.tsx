import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Select } from "../../components/ui/Select";
import { Stepper } from "../../components/ui/Stepper";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useToast } from "../../hooks/useToast";
import { mockApplicationService, mockCvService, mockJobService } from "../../services/mock";
import type { Application, Job } from "../../types/domain";
import { JobCard } from "../../features/public/components/JobCard";
import { CandidateRecommendedJobsPage } from "../../features/candidate/recommendedJobs/CandidateRecommendedJobsPage";
import { CandidateSavedJobsPage } from "../../features/candidate/savedJobs/CandidateSavedJobsPage";

interface CandidateJobsPageProps {
  mode?: "list" | "recommended" | "saved" | "saved-searches" | "detail";
}

const pageSize = 6;
type CandidateJobsContentMode = "list" | "saved-searches" | "detail";
const applySteps = ["Chọn CV", "Thư giới thiệu", "Câu hỏi sàng lọc", "Xem lại", "Hoàn thành"];

export function CandidateJobsPage({ mode = "list" }: CandidateJobsPageProps) {
  if (mode === "recommended") {
    return <CandidateRecommendedJobsPage />;
  }
  if (mode === "saved") {
    return <CandidateSavedJobsPage />;
  }

  return <CandidateJobsContent mode={mode} />;
}

function CandidateJobsContent({ mode }: { mode: CandidateJobsContentMode }) {
  const { jobId } = useParams();
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const jobsQuery = useAsyncData(() => mockJobService.getJobs({ pageSize: 100 }), []);
  const cvsQuery = useAsyncData(() => mockCvService.getCvs({ pageSize: 10 }), []);
  const jobs = useMemo(() => jobsQuery.data?.items ?? [], [jobsQuery.data?.items]);

  const selectedJob = jobs.find((job) => job.id === jobId) ?? jobs[0];

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (keyword) result = result.filter((job) => `${job.title} ${job.companyName} ${job.skills.join(" ")}`.toLowerCase().includes(keyword.toLowerCase()));
    if (location) result = result.filter((job) => job.location === location);
    return result.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }, [jobs, keyword, location]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const pagedJobs = filteredJobs.slice((page - 1) * pageSize, page * pageSize);
  const locations = Array.from(new Set(jobs.map((job) => job.location)));

  if (jobsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (mode === "saved-searches") {
    return <SavedSearchesPage />;
  }

  if (mode === "detail" && selectedJob) {
    return (
      <PageContainer>
        <PageHeader title={selectedJob.title} description="Chi tiết việc làm, mức độ phù hợp, kỹ năng yêu cầu và thao tác lưu hoặc ứng tuyển." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card>
              <SectionHeader title={selectedJob.companyName} description={`${selectedJob.location} • ${selectedJob.salary} • ${selectedJob.workMode}`} />
              <div className="flex flex-wrap gap-2">
                {selectedJob.skills.map((skill) => <StatusBadge key={skill} label={skill} />)}
                <StatusBadge label={`Phù hợp ${selectedJob.matchScore ?? 75}%`} tone="success" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{selectedJob.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => setApplyJob(selectedJob)}>Ứng tuyển</Button>
                <Button variant="secondary" onClick={() => toggleSavedJob(selectedJob.id)}>{isSaved(selectedJob.id) ? "Bỏ lưu" : "Lưu việc làm"}</Button>
              </div>
            </Card>
            <Card>
              <SectionHeader title="Yêu cầu và quyền lợi" />
              <div className="grid gap-4 md:grid-cols-2">
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {selectedJob.requirements.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {selectedJob.benefits.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </Card>
          </div>
          <aside>
            <Card>
              <SectionHeader title="Mức độ phù hợp" />
              <div className="space-y-3">
                <ProgressBar value={selectedJob.matchScore ?? 75} label="Tổng quan" />
                <ProgressBar value={90} label="Kỹ năng" />
                <ProgressBar value={78} label="Kinh nghiệm" />
                <ProgressBar value={84} label="Địa điểm" />
                <ProgressBar value={80} label="Mức lương" />
              </div>
            </Card>
          </aside>
        </div>
        <ApplyModal job={applyJob} cvs={cvsQuery.data?.items ?? []} onClose={() => setApplyJob(null)} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Tìm việc"
        description="Danh sách việc làm dành cho ứng viên với tìm kiếm, lọc, lưu việc làm và ứng tuyển bằng dữ liệu mock."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Input label="Từ khóa" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="Vị trí, kỹ năng..." />
          <Select label="Địa điểm" value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...locations.map((value) => ({ label: value, value }))]} />
          <div className="self-end text-sm text-slate-600">{filteredJobs.length} kết quả</div>
        </div>
      </Card>

      {pagedJobs.length === 0 ? <EmptyState message="Không có việc làm phù hợp." /> : null}
      <div className="grid gap-4">
        {pagedJobs.map((job) => (
          <div key={job.id} className="space-y-3">
            <JobCard job={job} detailPath={`/candidate/jobs/${job.id}`} saved={isSaved(job.id)} onToggleSave={toggleSavedJob} />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <ApplyModal job={applyJob} cvs={cvsQuery.data?.items ?? []} onClose={() => setApplyJob(null)} />
    </PageContainer>
  );
}

function SavedSearchesPage() {
  const [items, setItems] = useState([
    { id: "search-1", name: "Frontend React Hà Nội", filters: "React, Hà Nội, 15-25 triệu", enabled: true },
    { id: "search-2", name: "Backend Java Remote", filters: "Java, Remote, từ 20 triệu", enabled: false },
  ]);

  return (
    <PageContainer>
      <PageHeader title="Tìm kiếm đã lưu" description="Quản lý bộ lọc tìm kiếm và bật/tắt thông báo việc làm mới." />
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-950">{item.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{item.filters}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">Chạy lại tìm kiếm</Button>
                <Button variant="secondary" size="sm" onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry))}>{item.enabled ? "Tắt thông báo" : "Bật thông báo"}</Button>
                <Button variant="danger" size="sm" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Xóa</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}

function ApplyModal({ job, cvs, onClose }: { job: Job | null; cvs: Array<{ id: string; fileName: string }>; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedCvId, setSelectedCvId] = useState(cvs[0]?.id ?? "");
  const [coverLetter, setCoverLetter] = useState("Em mong muốn ứng tuyển vị trí này vì phù hợp với kỹ năng và định hướng nghề nghiệp.");
  const { showToast } = useToast();

  async function finishApply() {
    if (!job) return;
    const selectedCv = cvs.find((cv) => cv.id === selectedCvId) ?? cvs[0];
    const application: Application = {
      id: `app-${Date.now()}`,
      candidateId: "candidate-1",
      candidateName: "Nguyễn Văn An",
      jobId: job.id,
      jobTitle: job.title,
      companyName: job.companyName,
      cvId: selectedCv?.id ?? "cv-1",
      cvName: selectedCv?.fileName ?? "CV mặc định",
      coverLetter,
      appliedAt: new Date().toISOString().slice(0, 10),
      status: "submitted",
      timeline: [{ label: "Đã gửi", at: new Date().toISOString(), note: "Ứng viên đã gửi hồ sơ." }],
    };
    await mockApplicationService.createApplication(application);
    showToast({ type: "success", title: "Ứng tuyển thành công", message: "Đơn ứng tuyển đã được thêm vào lịch sử." });
    setStep(4);
  }

  return (
    <Modal open={Boolean(job)} title={`Ứng tuyển ${job?.title ?? ""}`} onClose={onClose}>
      <Stepper steps={applySteps} currentStep={step} />
      <div className="mt-5 space-y-4">
        {step === 0 ? <Select label="Chọn CV" value={selectedCvId} onChange={(event) => setSelectedCvId(event.target.value)} options={cvs.map((cv) => ({ label: cv.fileName, value: cv.id }))} /> : null}
        {step === 1 ? <Textarea label="Thư giới thiệu" value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} /> : null}
        {step === 2 ? (
          <div className="space-y-3">
            <Input label="Bạn có bao nhiêu năm kinh nghiệm?" defaultValue="1 năm" />
            <Input label="Khi nào bạn có thể bắt đầu?" defaultValue="Sau 2 tuần" />
            <Input label="Mức lương mong muốn?" defaultValue={job?.salary} />
            <Select label="Bạn có sẵn sàng làm onsite không?" options={[{ label: "Có", value: "yes" }, { label: "Không", value: "no" }]} />
          </div>
        ) : null}
        {step === 3 ? (
          <Card>
            <p className="text-sm text-slate-700">Vui lòng kiểm tra thông tin trước khi xác nhận ứng tuyển.</p>
            <p className="mt-2 text-sm"><strong>CV:</strong> {cvs.find((cv) => cv.id === selectedCvId)?.fileName}</p>
            <p className="mt-2 text-sm"><strong>Thư giới thiệu:</strong> {coverLetter}</p>
          </Card>
        ) : null}
        {step === 4 ? <Card><p className="text-sm text-emerald-700">Ứng tuyển thành công. Bạn có thể xem đơn trong lịch sử ứng tuyển.</p></Card> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        {step > 0 && step < 4 ? <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>Quay lại</Button> : null}
        {step < 3 ? <Button onClick={() => setStep((current) => current + 1)}>Tiếp tục</Button> : null}
        {step === 3 ? <Button onClick={finishApply}>Xác nhận ứng tuyển</Button> : null}
      </div>
    </Modal>
  );
}
