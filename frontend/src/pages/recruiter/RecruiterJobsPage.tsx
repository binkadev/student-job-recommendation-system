import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { RichTextPlaceholder } from "../../components/ui/RichTextPlaceholder";
import { Select } from "../../components/ui/Select";
import { Stepper } from "../../components/ui/Stepper";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { recruiterTone } from "../../features/recruiter/recruiterLabels";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { analytics } from "../../mocks";
import { mockJobService } from "../../services/mock";
import type { Job, JobStatus } from "../../types/domain";

interface RecruiterJobsPageProps {
  mode?: "list" | "create" | "detail" | "edit" | "preview" | "statistics";
}

type QuestionType = "text" | "number" | "single" | "multiple" | "yesno";

interface ScreeningQuestion {
  id: string;
  content: string;
  type: QuestionType;
  required: boolean;
  expectedAnswer: string;
  score: number;
  options: string;
}

interface JobFormState {
  title: string;
  department: string;
  quantity: number;
  level: string;
  jobType: string;
  workMode: "Onsite" | "Hybrid" | "Remote";
  location: string;
  salaryMin: number;
  salaryMax: number;
  hideSalary: boolean;
  currency: string;
  deadline: string;
  description: string;
  responsibilities: string;
  expectedResults: string;
  experienceYears: number;
  education: string;
  requiredSkills: string;
  preferredSkills: string;
  languages: string;
  otherRequirements: string;
  benefits: Record<string, boolean>;
  otherBenefits: string;
  questions: ScreeningQuestion[];
  recruiter: string;
  notificationEmail: string;
  allowExternalCv: boolean;
  autoRejectFailed: boolean;
  minMatchScore: number;
}

const steps = ["Thông tin cơ bản", "Mô tả", "Yêu cầu", "Quyền lợi", "Câu hỏi", "Cài đặt", "Preview"];
const STORAGE_KEY = "recruiter-job-create-draft";

const statusLabels: Record<JobStatus, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  published: "Đang hiển thị",
  paused: "Tạm dừng",
  expired: "Hết hạn",
  rejected: "Bị từ chối",
  closed: "Đã đóng",
};

const benefitLabels: Record<string, string> = {
  salary13: "Lương tháng 13",
  bonus: "Thưởng",
  insurance: "Bảo hiểm",
  leave: "Nghỉ phép",
  training: "Đào tạo",
  equipment: "Thiết bị",
};

const jobMetadata: Record<string, { department: string; recruiter: string; averageMatch: number }> = {
  "job-1": { department: "Sản phẩm", recruiter: "Trần Thị Bình", averageMatch: 86 },
  "job-2": { department: "Backend", recruiter: "Đỗ Quốc Huy", averageMatch: 82 },
  "job-3": { department: "Full-stack", recruiter: "Nguyễn Minh Đức", averageMatch: 79 },
  "job-4": { department: "Design", recruiter: "Trần Thị Bình", averageMatch: 74 },
  "job-5": { department: "Phân tích nghiệp vụ", recruiter: "Lê Hoàng Phúc", averageMatch: 77 },
  "job-6": { department: "Dữ liệu", recruiter: "Nguyễn Minh Đức", averageMatch: 81 },
  "job-7": { department: "QA", recruiter: "Đỗ Quốc Huy", averageMatch: 78 },
  "job-8": { department: "Mobile", recruiter: "Lê Hoàng Phúc", averageMatch: 84 },
  "job-9": { department: "DevOps", recruiter: "Nguyễn Minh Đức", averageMatch: 88 },
  "job-12": { department: "Kế toán", recruiter: "Trần Thị Bình", averageMatch: 72 },
};

const vietnameseJobOverrides: Record<string, Partial<Job>> = {
  "job-1": { title: "Frontend Developer", companyName: "Công ty TNHH Công nghệ NovaTech", location: "Hà Nội", salary: "15-25 triệu", industry: "Phần mềm doanh nghiệp", jobType: "Toàn thời gian" },
  "job-2": { title: "Backend Developer", companyName: "Công ty Cổ phần FinPlus", location: "TP. Hồ Chí Minh", salary: "18-30 triệu", industry: "Fintech", jobType: "Toàn thời gian" },
  "job-3": { title: "Full-stack Developer", companyName: "Công ty TNHH GreenSoft", location: "Đà Nẵng", salary: "20-35 triệu", industry: "SaaS", jobType: "Toàn thời gian" },
  "job-4": { title: "UI/UX Designer", companyName: "Công ty TNHH Bright Future", location: "Cần Thơ", salary: "12-20 triệu", industry: "EdTech", status: "rejected" },
};

const defaultJobForm: JobFormState = {
  title: "Frontend Developer",
  department: "Sản phẩm",
  quantity: 2,
  level: "Junior",
  jobType: "Toàn thời gian",
  workMode: "Hybrid",
  location: "Hà Nội",
  salaryMin: 15000000,
  salaryMax: 25000000,
  hideSalary: false,
  currency: "VND",
  deadline: "2026-08-30",
  description: "Tham gia phát triển giao diện web cho nền tảng tuyển dụng và gợi ý việc làm theo CV.",
  responsibilities: "Xây dựng component React, tối ưu trải nghiệm người dùng, phối hợp với backend để tích hợp API.",
  expectedResults: "Giao diện ổn định, tải nhanh, hiển thị tốt trên desktop và mobile.",
  experienceYears: 1,
  education: "Sinh viên năm cuối hoặc đã tốt nghiệp ngành CNTT, Kỹ thuật phần mềm hoặc tương đương.",
  requiredSkills: "React, TypeScript, HTML, CSS",
  preferredSkills: "Tailwind CSS, REST API, kiểm thử giao diện",
  languages: "Đọc hiểu tài liệu tiếng Anh",
  otherRequirements: "Có tư duy sản phẩm, chủ động trao đổi khi gặp vấn đề.",
  benefits: {
    salary13: true,
    bonus: true,
    insurance: true,
    leave: true,
    training: true,
    equipment: true,
  },
  otherBenefits: "Mentor trực tiếp, review lương định kỳ, hỗ trợ chứng chỉ chuyên môn.",
  questions: [
    { id: "q-1", content: "Bạn có bao nhiêu năm kinh nghiệm với React?", type: "number", required: true, expectedAnswer: "Từ 1 năm", score: 30, options: "" },
    { id: "q-2", content: "Bạn có thể làm việc hybrid tại Hà Nội không?", type: "yesno", required: true, expectedAnswer: "Có", score: 20, options: "" },
    { id: "q-3", content: "Bạn đã từng dùng công cụ nào?", type: "multiple", required: false, expectedAnswer: "React, TypeScript", score: 20, options: "React, TypeScript, Vue, Angular" },
  ],
  recruiter: "Trần Thị Bình",
  notificationEmail: "recruiter@novatech.vn",
  allowExternalCv: true,
  autoRejectFailed: false,
  minMatchScore: 70,
};

export function RecruiterJobsPage({ mode = "list" }: RecruiterJobsPageProps) {
  const { jobId } = useParams();
  const { showToast } = useToast();
  const jobsQuery = useAsyncData(() => mockJobService.getJobs({ pageSize: 100 }), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState<JobFormState>(defaultJobForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRecruiter, setBulkRecruiter] = useState("");
  const [page, setPage] = useState(1);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (jobsQuery.data?.items) setJobs(jobsQuery.data.items.map(normalizeRecruiterJob));
  }, [jobsQuery.data?.items]);

  useEffect(() => {
    if (mode !== "create") return;
    const rawDraft = localStorage.getItem(STORAGE_KEY);
    if (rawDraft) setForm({ ...defaultJobForm, ...JSON.parse(rawDraft) as JobFormState });
  }, [mode]);

  useEffect(() => {
    if (mode !== "create") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form, mode]);

  useEffect(() => {
    if (mode !== "create" && mode !== "edit") return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [mode]);

  const selectedJob = jobs.find((job) => job.id === jobId) ?? jobs[0];
  const departments = useMemo(() => Array.from(new Set(jobs.map((job) => getJobMeta(job).department))), [jobs]);
  const recruiters = useMemo(() => Array.from(new Set(jobs.map((job) => getJobMeta(job).recruiter))), [jobs]);
  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const meta = getJobMeta(job);
    const matchQuery = !query || `${job.title} ${job.companyName} ${meta.department} ${meta.recruiter}`.toLowerCase().includes(query.toLowerCase());
    const matchStatus = !status || job.status === status;
    const matchDepartment = !department || meta.department === department;
    const matchRecruiter = !recruiter || meta.recruiter === recruiter;
    const matchFrom = !dateFrom || job.postedAt >= dateFrom;
    const matchTo = !dateTo || job.postedAt <= dateTo;
    const matchExpiring = !expiringOnly || daysUntil(job.deadline) <= 14;
    return matchQuery && matchStatus && matchDepartment && matchRecruiter && matchFrom && matchTo && matchExpiring;
  }), [jobs, query, status, department, recruiter, dateFrom, dateTo, expiringOnly]);
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / 8));
  const pagedJobs = filteredJobs.slice((page - 1) * 8, page * 8);

  async function updateStatus(id: string, nextStatus: JobStatus) {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, status: nextStatus } : job));
    await mockJobService.updateJob(id, { status: nextStatus });
    showToast({ type: "success", title: "Đã cập nhật trạng thái tin", message: statusLabels[nextStatus] });
  }

  async function bulkStatus(nextStatus: JobStatus) {
    await Promise.all(selectedIds.map((id) => updateStatus(id, nextStatus)));
    setSelectedIds([]);
  }

  function bulkAssignRecruiter() {
    if (!bulkRecruiter) return;
    showToast({ type: "success", title: "Đã gán recruiter phụ trách", message: `${selectedIds.length} tin được gán cho ${bulkRecruiter}.` });
    setSelectedIds([]);
    setBulkRecruiter("");
  }

  async function createDraft() {
    const draft = buildJobFromForm(form, "draft");
    setJobs((current) => [draft, ...current]);
    await mockJobService.createJob(draft);
    showToast({ type: "success", title: "Đã lưu bản nháp" });
  }

  async function submitForReview() {
    const validationErrors = validateStep(form, step);
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }
    const pendingJob = buildJobFromForm(form, "pending");
    setJobs((current) => [pendingJob, ...current]);
    await mockJobService.createJob(pendingJob);
    localStorage.removeItem(STORAGE_KEY);
    showToast({ type: "success", title: "Đã gửi duyệt tin tuyển dụng", message: "Tin mới được tạo ở trạng thái chờ duyệt." });
  }

  function nextStep() {
    const validationErrors = validateStep(form, step);
    setErrors(validationErrors);
    if (!validationErrors.length) setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function updateForm<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors([]);
  }

  function updateQuestion(id: string, patch: Partial<ScreeningQuestion>) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) => question.id === id ? { ...question, ...patch } : question),
    }));
    setErrors([]);
  }

  function addQuestion() {
    setForm((current) => ({
      ...current,
      questions: [...current.questions, { id: `q-${Date.now()}`, content: "", type: "text", required: false, expectedAnswer: "", score: 10, options: "" }],
    }));
  }

  function removeQuestion(id: string) {
    setForm((current) => ({ ...current, questions: current.questions.filter((question) => question.id !== id) }));
  }

  if (jobsQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (mode === "create" || mode === "edit") {
    return (
      <PageContainer>
        <PageHeader title={mode === "create" ? "Tạo tin tuyển dụng" : "Chỉnh sửa tin tuyển dụng"} description="Hoàn thiện thông tin theo từng bước, lưu nháp tự động và gửi duyệt khi nội dung đã sẵn sàng." />
        <Card>
          <Stepper steps={steps} currentStep={step} />
          {errors.length ? (
            <div className="mt-5 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : null}
          <div className="mt-6">
            <JobFormStep step={step} form={form} updateForm={updateForm} updateQuestion={updateQuestion} addQuestion={addQuestion} removeQuestion={removeQuestion} />
          </div>
          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>Quay lại</Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void createDraft()}>Lưu bản nháp</Button>
              {step < steps.length - 1 ? (
                <>
                  <Button variant="secondary" onClick={() => setStep(steps.length - 1)}>Preview</Button>
                  <Button onClick={nextStep}>Tiếp tục</Button>
                </>
              ) : (
                <Button onClick={() => void submitForReview()}>Gửi duyệt</Button>
              )}
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if ((mode === "detail" || mode === "preview" || mode === "statistics") && selectedJob) {
    return (
      <PageContainer>
        <PageHeader title={mode === "statistics" ? "Thống kê tin tuyển dụng" : mode === "preview" ? "Xem trước tin tuyển dụng" : "Chi tiết tin tuyển dụng"} description="Theo dõi nội dung, trạng thái, ứng viên và hiệu quả của tin tuyển dụng." />
        {mode === "statistics" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><SectionHeader title="Lượt xem và ứng tuyển" /><div className="h-72"><ResponsiveContainer><BarChart data={analytics}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="jobs" fill="#2563eb" name="Lượt xem" /><Bar dataKey="applications" fill="#10b981" name="Ứng tuyển" /></BarChart></ResponsiveContainer></div></Card>
            <Card><SectionHeader title="Chỉ số chính" /><div className="space-y-3 text-sm text-slate-700"><p>Lượt xem: {selectedJob.views}</p><p>Ứng viên: {selectedJob.applicants}</p><p>Tỷ lệ chuyển đổi: {Math.round((selectedJob.applicants / Math.max(1, selectedJob.views)) * 100)}%</p><p>Ứng viên phù hợp cao: 8</p></div></Card>
          </div>
        ) : (
          <PreviewJobCard job={selectedJob} />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Danh sách tin tuyển dụng" description="Quản lý trạng thái, hiệu quả và người phụ trách cho các tin tuyển dụng đang vận hành." />
      <Card className="mb-5">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <Input label="Tìm kiếm" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên vị trí, phòng ban..." />
          <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(statusLabels).map(([value, label]) => ({ label, value }))]} />
          <Select label="Phòng ban" value={department} onChange={(event) => setDepartment(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...departments.map((value) => ({ label: value, value }))]} />
          <Select label="Recruiter" value={recruiter} onChange={(event) => setRecruiter(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...recruiters.map((value) => ({ label: value, value }))]} />
          <Link to="/recruiter/jobs/create" className="self-end"><Button className="w-full">Tạo tin mới</Button></Link>
        </div>
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[180px_180px_auto]">
          <Input label="Từ ngày" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input label="Đến ngày" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={expiringOnly} onChange={(event) => setExpiringOnly(event.target.checked)} />
            Sắp hết hạn
          </label>
        </div>
      </Card>

      {selectedIds.length > 0 ? (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Đã chọn {selectedIds.length} tin</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => void bulkStatus("paused")}>Tạm dừng</Button>
              <Button variant="danger" size="sm" onClick={() => void bulkStatus("closed")}>Đóng</Button>
              <Select label="Gán recruiter" value={bulkRecruiter} onChange={(event) => setBulkRecruiter(event.target.value)} options={[{ label: "Chọn recruiter", value: "" }, ...recruiters.map((value) => ({ label: value, value }))]} />
              <Button size="sm" className="self-end" onClick={bulkAssignRecruiter}>Gán</Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Table
        rows={pagedJobs}
        getRowKey={(job) => job.id}
        columns={[
          { key: "select", header: "", render: (job) => <input type="checkbox" checked={selectedIds.includes(job.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, job.id] : current.filter((id) => id !== job.id))} /> },
          { key: "job", header: "Tin tuyển dụng", render: (job) => <JobSummary job={job} /> },
          { key: "timeline", header: "Thời gian", render: (job) => <JobTimeline job={job} /> },
          { key: "performance", header: "Hiệu quả", render: (job) => <JobPerformance job={job} /> },
          { key: "status", header: "Trạng thái", render: (job) => <StatusBadge label={statusLabels[job.status]} tone={recruiterTone(job.status)} /> },
          { key: "actions", header: "Thao tác", render: (job) => <JobActions job={job} onStatus={updateStatus} /> },
        ]}
      />
      <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
    </PageContainer>
  );
}

function JobFormStep({
  step,
  form,
  updateForm,
  updateQuestion,
  addQuestion,
  removeQuestion,
}: {
  step: number;
  form: JobFormState;
  updateForm: <K extends keyof JobFormState>(key: K, value: JobFormState[K]) => void;
  updateQuestion: (id: string, patch: Partial<ScreeningQuestion>) => void;
  addQuestion: () => void;
  removeQuestion: (id: string) => void;
}) {
  if (step === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên vị trí" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
        <Input label="Phòng ban" value={form.department} onChange={(event) => updateForm("department", event.target.value)} />
        <Input label="Số lượng" type="number" min={1} value={form.quantity} onChange={(event) => updateForm("quantity", Number(event.target.value))} />
        <Select label="Cấp bậc" value={form.level} onChange={(event) => updateForm("level", event.target.value)} options={["Intern", "Fresher", "Junior", "Middle", "Senior", "Lead"].map((value) => ({ label: value, value }))} />
        <Select label="Loại hình" value={form.jobType} onChange={(event) => updateForm("jobType", event.target.value)} options={["Toàn thời gian", "Bán thời gian", "Thực tập", "Hợp đồng"].map((value) => ({ label: value, value }))} />
        <Select label="Hình thức làm việc" value={form.workMode} onChange={(event) => updateForm("workMode", event.target.value as JobFormState["workMode"])} options={["Onsite", "Hybrid", "Remote"].map((value) => ({ label: value, value }))} />
        <Input label="Địa điểm" value={form.location} onChange={(event) => updateForm("location", event.target.value)} />
        <Input label="Hạn ứng tuyển" type="date" value={form.deadline} onChange={(event) => updateForm("deadline", event.target.value)} />
        <Input label="Lương tối thiểu" type="number" min={0} value={form.salaryMin} onChange={(event) => updateForm("salaryMin", Number(event.target.value))} />
        <Input label="Lương tối đa" type="number" min={0} value={form.salaryMax} onChange={(event) => updateForm("salaryMax", Number(event.target.value))} />
        <Select label="Tiền tệ" value={form.currency} onChange={(event) => updateForm("currency", event.target.value)} options={["VND", "USD"].map((value) => ({ label: value, value }))} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.hideSalary} onChange={(event) => updateForm("hideSalary", event.target.checked)} />
          Ẩn lương trên tin tuyển dụng
        </label>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <RichTextPlaceholder label="Mô tả công việc" />
        <Textarea label="Mô tả công việc" value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
        <Textarea label="Trách nhiệm" value={form.responsibilities} onChange={(event) => updateForm("responsibilities", event.target.value)} />
        <Textarea label="Kết quả kỳ vọng" value={form.expectedResults} onChange={(event) => updateForm("expectedResults", event.target.value)} />
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Số năm kinh nghiệm" type="number" min={0} value={form.experienceYears} onChange={(event) => updateForm("experienceYears", Number(event.target.value))} />
        <Input label="Học vấn" value={form.education} onChange={(event) => updateForm("education", event.target.value)} />
        <Textarea label="Kỹ năng bắt buộc" value={form.requiredSkills} onChange={(event) => updateForm("requiredSkills", event.target.value)} />
        <Textarea label="Kỹ năng ưu tiên" value={form.preferredSkills} onChange={(event) => updateForm("preferredSkills", event.target.value)} />
        <Input label="Ngoại ngữ" value={form.languages} onChange={(event) => updateForm("languages", event.target.value)} />
        <Input label="Yêu cầu khác" value={form.otherRequirements} onChange={(event) => updateForm("otherRequirements", event.target.value)} />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(benefitLabels).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.benefits[key]} onChange={(event) => updateForm("benefits", { ...form.benefits, [key]: event.target.checked })} />
              {label}
            </label>
          ))}
        </div>
        <Textarea label="Phúc lợi khác" value={form.otherBenefits} onChange={(event) => updateForm("otherBenefits", event.target.value)} />
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className="space-y-4">
        {form.questions.map((question, index) => (
          <div key={question.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-900">Câu hỏi {index + 1}</p>
              <Button variant="secondary" size="sm" onClick={() => removeQuestion(question.id)}>Xóa</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Textarea label="Nội dung" value={question.content} onChange={(event) => updateQuestion(question.id, { content: event.target.value })} />
              <Select label="Loại câu hỏi" value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value as QuestionType })} options={[
                { label: "Text", value: "text" },
                { label: "Number", value: "number" },
                { label: "Single choice", value: "single" },
                { label: "Multiple choice", value: "multiple" },
                { label: "Yes/no", value: "yesno" },
              ]} />
              {(question.type === "single" || question.type === "multiple") ? <Input label="Options" value={question.options} onChange={(event) => updateQuestion(question.id, { options: event.target.value })} placeholder="React, Vue, Angular" /> : null}
              <Input label="Đáp án mong muốn" value={question.expectedAnswer} onChange={(event) => updateQuestion(question.id, { expectedAnswer: event.target.value })} />
              <Input label="Điểm" type="number" min={0} value={question.score} onChange={(event) => updateQuestion(question.id, { score: Number(event.target.value) })} />
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                <input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} />
                Bắt buộc
              </label>
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={addQuestion}>Thêm câu hỏi</Button>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Recruiter phụ trách" value={form.recruiter} onChange={(event) => updateForm("recruiter", event.target.value)} options={["Trần Thị Bình", "Đỗ Quốc Huy", "Nguyễn Minh Đức", "Lê Hoàng Phúc"].map((value) => ({ label: value, value }))} />
        <Input label="Email nhận thông báo" type="email" value={form.notificationEmail} onChange={(event) => updateForm("notificationEmail", event.target.value)} />
        <Input label="Match score tối thiểu" type="number" min={0} max={100} value={form.minMatchScore} onChange={(event) => updateForm("minMatchScore", Number(event.target.value))} />
        <div className="space-y-3 self-end pb-2 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.allowExternalCv} onChange={(event) => updateForm("allowExternalCv", event.target.checked)} />Cho phép CV ngoài hệ thống</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoRejectFailed} onChange={(event) => updateForm("autoRejectFailed", event.target.checked)} />Tự động từ chối câu trả lời không đạt</label>
        </div>
      </div>
    );
  }

  return <PreviewJobCard job={buildJobFromForm(form, "pending")} form={form} />;
}

function PreviewJobCard({ job, form }: { job?: Job; form?: JobFormState }) {
  if (!job) return null;
  return (
    <Card>
      <SectionHeader title={job.title} description={`${job.companyName} • ${job.location} • ${job.salary}`} />
      <div className="flex flex-wrap gap-2">{job.skills.map((skill) => <StatusBadge key={skill} label={skill} />)}</div>
      <p className="mt-4 text-sm leading-6 text-slate-700">{job.description}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><h3 className="font-medium text-slate-900">Yêu cầu</h3><ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{job.requirements.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h3 className="font-medium text-slate-900">Quyền lợi</h3><ul className="mt-2 list-disc pl-5 text-sm text-slate-700">{job.benefits.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      {form ? (
        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700 md:grid-cols-2">
          <p><strong>Phòng ban:</strong> {form.department}</p>
          <p><strong>Số lượng:</strong> {form.quantity}</p>
          <p><strong>Recruiter:</strong> {form.recruiter}</p>
          <p><strong>Match tối thiểu:</strong> {form.minMatchScore}%</p>
          <p><strong>Email nhận thông báo:</strong> {form.notificationEmail}</p>
          <p><strong>CV ngoài hệ thống:</strong> {form.allowExternalCv ? "Cho phép" : "Không cho phép"}</p>
        </div>
      ) : null}
    </Card>
  );
}

function JobSummary({ job }: { job: Job }) {
  const meta = getJobMeta(job);
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{job.title}</p>
      <p className="mt-1 text-xs text-slate-500">{job.location} • {meta.department}</p>
      <p className="mt-1 text-xs text-slate-500">Phụ trách: {meta.recruiter}</p>
    </div>
  );
}

function JobTimeline({ job }: { job: Job }) {
  const isExpiring = daysUntil(job.deadline) <= 14;
  return (
    <div className="min-w-[130px] space-y-1 text-xs">
      <p><span className="text-slate-500">Đăng:</span> {formatDate(job.postedAt)}</p>
      <p className={isExpiring ? "font-medium text-amber-700" : ""}><span className="text-slate-500">Hạn:</span> {formatDate(job.deadline)}</p>
    </div>
  );
}

function JobPerformance({ job }: { job: Job }) {
  const meta = getJobMeta(job);
  return (
    <div className="min-w-[120px] space-y-1 text-xs text-slate-600">
      <p>{job.views} lượt xem</p>
      <p>{job.applicants} ứng viên</p>
      <p>Match TB {meta.averageMatch}%</p>
    </div>
  );
}

function JobActions({
  job,
  onStatus,
}: {
  job: Job;
  onStatus: (id: string, status: JobStatus) => Promise<void>;
}) {
  const canToggle = job.status === "published" || job.status === "paused";
  const nextStatus = job.status === "published" ? "paused" : "published";

  return (
    <div className="flex min-w-[180px] flex-wrap gap-2">
      <Link to={`/recruiter/jobs/${job.id}`}><Button variant="secondary" size="sm">Xem</Button></Link>
      <Link to={`/recruiter/jobs/${job.id}/edit`}><Button variant="secondary" size="sm">Sửa</Button></Link>
      {canToggle ? (
        <Button variant="secondary" size="sm" onClick={() => void onStatus(job.id, nextStatus)}>{job.status === "published" ? "Tạm dừng" : "Kích hoạt"}</Button>
      ) : null}
    </div>
  );
}

function buildJobFromForm(form: JobFormState, status: JobStatus): Job {
  const requiredSkills = splitValues(form.requiredSkills);
  const benefits = [
    ...Object.entries(form.benefits).filter(([, enabled]) => enabled).map(([key]) => benefitLabels[key]),
    ...splitValues(form.otherBenefits),
  ];

  return {
    id: `job-${Date.now()}`,
    title: form.title,
    companyId: "company-1",
    companyName: "Công ty TNHH Công nghệ NovaTech",
    location: form.location,
    salary: form.hideSalary ? "Thỏa thuận" : `${formatMoney(form.salaryMin)}-${formatMoney(form.salaryMax)} ${form.currency}`,
    industry: form.department,
    experience: `${form.experienceYears}+ năm`,
    jobType: form.jobType,
    workMode: form.workMode,
    level: form.level,
    skills: requiredSkills,
    description: `${form.description}\n${form.responsibilities}\n${form.expectedResults}`,
    requirements: [form.education, form.languages, form.otherRequirements, ...requiredSkills, ...splitValues(form.preferredSkills)].filter(Boolean),
    benefits,
    deadline: form.deadline,
    postedAt: new Date().toISOString().slice(0, 10),
    status,
    views: 0,
    applicants: 0,
    matchScore: form.minMatchScore,
  };
}

function validateStep(form: JobFormState, step: number) {
  const errors: string[] = [];
  if (step === 0) {
    if (!form.title.trim()) errors.push("Vui lòng nhập tên vị trí.");
    if (!form.department.trim()) errors.push("Vui lòng nhập phòng ban.");
    if (form.quantity < 1) errors.push("Số lượng phải lớn hơn 0.");
    if (!form.location.trim()) errors.push("Vui lòng nhập địa điểm.");
    if (form.salaryMax < form.salaryMin) errors.push("Lương tối đa không được nhỏ hơn lương tối thiểu.");
    if (!form.deadline || new Date(form.deadline).getTime() <= new Date("2026-07-11").getTime()) errors.push("Hạn ứng tuyển phải ở tương lai.");
  }
  if (step === 1) {
    if (!form.description.trim()) errors.push("Vui lòng nhập mô tả công việc.");
    if (!form.responsibilities.trim()) errors.push("Vui lòng nhập trách nhiệm chính.");
  }
  if (step === 2 && splitValues(form.requiredSkills).length < 1) errors.push("Phải có ít nhất một kỹ năng bắt buộc.");
  if (step === 4) {
    form.questions.forEach((question, index) => {
      if (!question.content.trim()) errors.push(`Câu hỏi ${index + 1} cần có nội dung.`);
      if ((question.type === "single" || question.type === "multiple") && splitValues(question.options).length < 2) errors.push(`Câu hỏi ${index + 1} dạng lựa chọn cần ít nhất hai option.`);
    });
  }
  if (step === 5) {
    if (!form.recruiter) errors.push("Vui lòng chọn recruiter phụ trách.");
    if (!form.notificationEmail.includes("@")) errors.push("Email nhận thông báo chưa hợp lệ.");
    if (form.minMatchScore < 0 || form.minMatchScore > 100) errors.push("Match score tối thiểu phải nằm trong khoảng 0-100.");
  }
  return errors;
}

function normalizeRecruiterJob(job: Job): Job {
  return { ...job, ...vietnameseJobOverrides[job.id] };
}

function getJobMeta(job: Job) {
  return jobMetadata[job.id] ?? { department: job.industry || "Tuyển dụng", recruiter: "Trần Thị Bình", averageMatch: job.matchScore ?? 75 };
}

function daysUntil(value: string) {
  const target = new Date(value).getTime();
  const today = new Date("2026-07-11").getTime();
  return Math.ceil((target - today) / 86400000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function splitValues(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

function formatMoney(value: number) {
  if (value >= 1000000) return `${Math.round(value / 1000000)} triệu`;
  return new Intl.NumberFormat("vi-VN").format(value);
}
