import { BriefcaseBusiness, Eye, Pencil, Plus, RefreshCcw, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

interface RecruiterJobsPageProps {
  mode?: "list" | "create" | "detail" | "edit" | "preview" | "statistics";
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface JobSkillResponse {
  id: number;
  skillId: number;
  skillName: string;
  normalizedName: string;
  category: string | null;
  importance: SkillImportance | null;
  minLevel: SkillLevel | null;
}

interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  jobType: JobType | null;
  workingModel: WorkingModel | null;
  status: JobStatus;
  salaryMin: number | string | null;
  salaryMax: number | string | null;
  currency: string | null;
  deadline: string | null;
  skills: JobSkillResponse[];
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface JobDetailResponse extends JobResponse {
  description: string | null;
  requirements: string | null;
  benefits: string | null;
}

interface SkillResponse {
  id: number;
  name: string;
  normalizedName: string;
  category: string | null;
  description: string | null;
}

interface CompanyResponse {
  id: number;
}

interface JobFormState {
  title: string;
  description: string;
  requirements: string;
  benefits: string;
  location: string;
  jobType: JobType;
  workingModel: WorkingModel;
  status: JobStatus;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  deadline: string;
  skillIds: string[];
}

type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type WorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type SkillImportance = "REQUIRED" | "PREFERRED" | "NICE_TO_HAVE";
type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

const DEFAULT_FORM: JobFormState = {
  title: "",
  description: "",
  requirements: "",
  benefits: "",
  location: "",
  jobType: "FULL_TIME",
  workingModel: "ONSITE",
  status: "DRAFT",
  salaryMin: "",
  salaryMax: "",
  currency: "đồng",
  deadline: "",
  skillIds: [],
};

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang tuyển",
  CLOSED: "Đã đóng",
  REJECTED: "Bị từ chối",
  EXPIRED: "Hết hạn",
};

const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  CONTRACT: "Hợp đồng",
};

const WORKING_MODEL_LABELS: Record<WorkingModel, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

export function RecruiterJobsPage({ mode = "list" }: RecruiterJobsPageProps) {
  const { jobId } = useParams();
  const { showToast } = useToast();

  if (mode === "create") return <JobFormView mode="create" />;
  if ((mode === "detail" || mode === "edit" || mode === "preview" || mode === "statistics") && jobId) {
    return <JobDetailRouter mode={mode} jobId={Number(jobId)} />;
  }

  return <RecruiterJobsList showToast={showToast} />;
}

function RecruiterJobsList({ showToast }: { showToast: ReturnType<typeof useToast>["showToast"] }) {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [jobType, setJobType] = useState("");
  const [workingModel, setWorkingModel] = useState("");
  const jobsQuery = useAsyncData(() => getJobs({ page, keyword, status, jobType, workingModel }), [page, reloadKey, keyword, status, jobType, workingModel]);
  const jobs = jobsQuery.data?.items ?? [];

  async function updateStatus(job: JobResponse, nextStatus: JobStatus) {
    try {
      await updateJobStatus(job.id, nextStatus);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật trạng thái tin", message: JOB_STATUS_LABELS[nextStatus] });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(error) });
    }
  }

  async function closeJob(job: JobResponse) {
    try {
      await deleteJob(job.id);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã đóng tin tuyển dụng" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể đóng tin", message: getErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý tin tuyển dụng" description="Danh sách tin tuyển dụng lấy từ API backend theo tài khoản công ty hiện tại." />
      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_auto]">
          <Input label="Từ khóa" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="Tên tin, địa điểm..." />
          <Select label="Trạng thái" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="Loại việc" value={jobType} onChange={(event) => { setJobType(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label }))]} />
          <Select label="Hình thức" value={workingModel} onChange={(event) => { setWorkingModel(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label }))]} />
          <div className="flex items-end gap-2">
            <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => setReloadKey((current) => current + 1)}>Tải lại</Button>
            <Link to="/recruiter/jobs/create"><Button icon={<Plus size={16} />}>Tạo tin</Button></Link>
          </div>
        </div>
      </Card>

      <Card className="mt-5">
        <SectionHeader title="Tin tuyển dụng" description={`${jobsQuery.data?.totalItems ?? 0} tin từ backend`} />
        {jobsQuery.loading ? <LoadingState /> : null}
        {!jobsQuery.loading && jobsQuery.error ? <EmptyState message={jobsQuery.error} /> : null}
        {!jobsQuery.loading && !jobsQuery.error && jobs.length === 0 ? <EmptyState message="Không có tin tuyển dụng phù hợp." /> : null}
        {!jobsQuery.loading && jobs.length > 0 ? (
          <div className="space-y-4">
            <Table
              rows={jobs}
              getRowKey={(job) => String(job.id)}
              columns={[
                { key: "title", header: "Tin tuyển dụng", render: (job) => <JobTitleCell job={job} /> },
                { key: "type", header: "Loại", render: (job) => formatJobMeta(job) },
                { key: "salary", header: "Mức lương", render: (job) => formatSalary(job) },
                { key: "deadline", header: "Hạn nộp", render: (job) => formatDate(job.deadline) },
                { key: "status", header: "Trạng thái", render: (job) => <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={jobStatusTone(job.status)} /> },
                { key: "actions", header: "Thao tác", render: (job) => <JobActions job={job} onUpdateStatus={updateStatus} onClose={closeJob} /> },
              ]}
            />
            <Pagination page={page} totalPages={jobsQuery.data?.totalPages ?? 1} onPageChange={setPage} />
          </div>
        ) : null}
      </Card>
    </PageContainer>
  );
}

function JobDetailRouter({ mode, jobId }: { mode: "detail" | "edit" | "preview" | "statistics"; jobId: number }) {
  const detailQuery = useAsyncData(() => getJobDetail(jobId), [jobId]);

  if (detailQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết tin tuyển dụng" description="Không thể tải dữ liệu từ backend." />
        <EmptyState message={detailQuery.error ?? "Không tìm thấy tin tuyển dụng."} />
      </PageContainer>
    );
  }

  if (mode === "edit") return <JobFormView mode="edit" job={detailQuery.data} />;
  if (mode === "preview") return <UnsupportedJobView job={detailQuery.data} title="Preview tin tuyển dụng" message="Backend hiện chưa có API preview riêng. Bạn có thể xem nội dung thật ở trang chi tiết tin." />;
  if (mode === "statistics") return <UnsupportedJobView job={detailQuery.data} title="Thống kê tin tuyển dụng" message="Backend hiện chưa có API lượt xem, tỷ lệ ứng tuyển hoặc analytics cho từng tin." />;
  return <JobDetailView job={detailQuery.data} />;
}

function JobDetailView({ job }: { job: JobDetailResponse }) {
  return (
    <PageContainer>
      <PageHeader title={job.title} description={`${job.companyName} • ${job.location || "Chưa cập nhật địa điểm"}`} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Link to={`/recruiter/jobs/${job.id}/edit`}><Button icon={<Pencil size={16} />}>Sửa tin</Button></Link>
        <Link to="/recruiter/jobs"><Button variant="secondary">Quay lại danh sách</Button></Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <TextBlock title="Mô tả công việc" value={job.description} />
          <TextBlock title="Yêu cầu" value={job.requirements} />
          <TextBlock title="Quyền lợi" value={job.benefits} />
          <Card>
            <SectionHeader title="Kỹ năng yêu cầu" />
            {job.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => <StatusBadge key={skill.id} label={`${skill.skillName}${skill.minLevel ? ` • ${skill.minLevel}` : ""}`} />)}
              </div>
            ) : <EmptyState message="Tin chưa có kỹ năng yêu cầu." />}
          </Card>
        </div>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin tin tuyển dụng" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoRow label="Trạng thái" value={JOB_STATUS_LABELS[job.status]} />
              <InfoRow label="Loại việc" value={job.jobType ? JOB_TYPE_LABELS[job.jobType] : null} />
              <InfoRow label="Hình thức" value={job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : null} />
              <InfoRow label="Mức lương" value={formatSalary(job)} />
              <InfoRow label="Hạn nộp" value={formatDate(job.deadline)} />
              <InfoRow label="Ngày tạo" value={formatDateTime(job.createdAt)} />
              <InfoRow label="Cập nhật" value={formatDateTime(job.updatedAt)} />
            </div>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}

function JobFormView({ mode, job }: { mode: "create" | "edit"; job?: JobDetailResponse }) {
  const { showToast } = useToast();
  const [form, setForm] = useState<JobFormState>(() => job ? mapJobToForm(job) : DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const skillsQuery = useAsyncData(() => getSkills(), []);
  const editing = mode === "edit";

  useEffect(() => {
    if (job) setForm(mapJobToForm(job));
  }, [job]);

  const selectedSkillIds = useMemo(() => new Set(form.skillIds), [form.skillIds]);

  function update<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSkill(skillId: number, checked: boolean) {
    const value = String(skillId);
    setForm((current) => ({
      ...current,
      skillIds: checked ? Array.from(new Set([...current.skillIds, value])) : current.skillIds.filter((item) => item !== value),
    }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = "Vui lòng nhập tiêu đề tin.";
    if (!form.description.trim()) nextErrors.description = "Vui lòng nhập mô tả công việc.";
    if (form.salaryMin && !isPositiveIntegerMoney(form.salaryMin)) nextErrors.salaryMin = "Lương tối thiểu phải là số nguyên dương.";
    if (form.salaryMax && !isPositiveIntegerMoney(form.salaryMax)) nextErrors.salaryMax = "Lương tối đa phải là số nguyên dương.";
    if (form.salaryMin && form.salaryMax && parseMoneyInput(form.salaryMin) > parseMoneyInput(form.salaryMax)) nextErrors.salaryMax = "Lương tối đa phải lớn hơn lương tối thiểu.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save(nextStatus?: JobStatus) {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = buildJobPayload({ ...form, status: nextStatus ?? form.status });
      if (editing && job) {
        await updateJob(job.id, payload);
        if (nextStatus) await updateJobStatus(job.id, nextStatus);
        showToast({ type: "success", title: "Đã cập nhật tin tuyển dụng" });
      } else {
        await createJob(payload);
        showToast({ type: "success", title: "Đã tạo tin tuyển dụng" });
      }
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu tin tuyển dụng", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title={editing ? "Chỉnh sửa tin tuyển dụng" : "Tạo tin tuyển dụng"} description="Form chỉ lưu các trường hiện có trong API job backend." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Thông tin cơ bản" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Tiêu đề" value={form.title} error={errors.title} onChange={(event) => update("title", event.target.value)} />
              <Input label="Địa điểm" value={form.location} onChange={(event) => update("location", event.target.value)} />
              <Select label="Loại việc" value={form.jobType} onChange={(event) => update("jobType", event.target.value as JobType)} options={Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              <Select label="Hình thức làm việc" value={form.workingModel} onChange={(event) => update("workingModel", event.target.value as WorkingModel)} options={Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label }))} />
              <Input label="Lương tối thiểu" inputMode="numeric" value={form.salaryMin} error={errors.salaryMin} onChange={(event) => update("salaryMin", formatMoneyInput(event.target.value))} />
              <Input label="Lương tối đa" inputMode="numeric" value={form.salaryMax} error={errors.salaryMax} onChange={(event) => update("salaryMax", formatMoneyInput(event.target.value))} />
              <Input label="Đơn vị" value="đồng" disabled />
              <Input label="Hạn nộp" type="date" value={form.deadline} onChange={(event) => update("deadline", event.target.value)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Nội dung tin" />
            <div className="grid gap-4">
              <Textarea label="Mô tả công việc" value={form.description} error={errors.description} onChange={(event) => update("description", event.target.value)} />
              <Textarea label="Yêu cầu" value={form.requirements} onChange={(event) => update("requirements", event.target.value)} />
              <Textarea label="Quyền lợi" value={form.benefits} onChange={(event) => update("benefits", event.target.value)} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Kỹ năng" description="Chọn skill từ danh mục backend. Khi lưu, frontend gửi skillId cho API job." />
            {skillsQuery.loading ? <LoadingState /> : null}
            {!skillsQuery.loading && skillsQuery.error ? <EmptyState message={skillsQuery.error} /> : null}
            {!skillsQuery.loading && skillsQuery.data?.length === 0 ? <EmptyState message="Backend chưa có danh mục kỹ năng." /> : null}
            <div className="grid gap-2 md:grid-cols-2">
              {(skillsQuery.data ?? []).map((skill) => (
                <label key={skill.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
                  <input type="checkbox" checked={selectedSkillIds.has(String(skill.id))} onChange={(event) => toggleSkill(skill.id, event.target.checked)} />
                  <span>
                    <strong className="block text-slate-900">{skill.name}</strong>
                    <span className="text-xs text-slate-500">{skill.category || "Chưa phân loại"}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái" />
            <Select label="Trạng thái khi lưu" value={form.status} onChange={(event) => update("status", event.target.value as JobStatus)} options={Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
            <div className="mt-5 flex flex-col gap-2">
              <Button loading={saving} onClick={() => void save()}>{editing ? "Lưu thay đổi" : "Tạo tin"}</Button>
              <Button variant="secondary" loading={saving} onClick={() => void save("ACTIVE")}>Lưu và mở tuyển</Button>
              <Link to={editing && job ? `/recruiter/jobs/${job.id}` : "/recruiter/jobs"}><Button className="w-full" variant="secondary">Quay lại</Button></Link>
            </div>
          </Card>
          <UnsupportedCard title="Cài đặt chưa hỗ trợ" items={["Phòng ban", "Recruiter phụ trách", "Câu hỏi sàng lọc", "Auto reject", "Min match score", "Preview nâng cao"]} />
        </aside>
      </div>
    </PageContainer>
  );
}

function UnsupportedJobView({ job, title, message }: { job: JobDetailResponse; title: string; message: string }) {
  return (
    <PageContainer>
      <PageHeader title={title} description={job.title} />
      <Card>
        <EmptyState message={message} />
        <div className="mt-4 flex gap-2">
          <Link to={`/recruiter/jobs/${job.id}`}><Button>Xem chi tiết tin</Button></Link>
          <Link to="/recruiter/jobs"><Button variant="secondary">Quay lại danh sách</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {value ? <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{value}</p> : <EmptyState message={`Chưa có ${title.toLowerCase()}.`} />}
    </Card>
  );
}

function JobTitleCell({ job }: { job: JobResponse }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-md bg-brand-50 p-2 text-brand-700"><BriefcaseBusiness size={18} /></div>
      <div>
        <p className="font-medium text-slate-900">{job.title}</p>
        <p className="text-xs text-slate-500">{job.companyName} • {job.location || "Chưa cập nhật địa điểm"}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {job.skills?.slice(0, 3).map((skill) => <StatusBadge key={skill.id} label={skill.skillName} />)}
        </div>
      </div>
    </div>
  );
}

function JobActions({ job, onUpdateStatus, onClose }: { job: JobResponse; onUpdateStatus: (job: JobResponse, status: JobStatus) => void; onClose: (job: JobResponse) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/recruiter/jobs/${job.id}`}><Button variant="secondary" size="sm" icon={<Eye size={14} />}>Xem</Button></Link>
      <Link to={`/recruiter/jobs/${job.id}/edit`}><Button variant="secondary" size="sm" icon={<Pencil size={14} />}>Sửa</Button></Link>
      {job.status !== "ACTIVE" ? <Button size="sm" onClick={() => onUpdateStatus(job, "ACTIVE")}>Mở tuyển</Button> : null}
      {job.status !== "CLOSED" ? <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={() => onClose(job)}>Đóng</Button> : null}
    </div>
  );
}

function UnsupportedCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <SectionHeader title={title} description="Các phần này chưa có trường/API backend nên không lưu dữ liệu giả." />
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <StatusBadge key={item} label={item} />)}
      </div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <strong className="text-right font-medium text-slate-900">{value || "Chưa cập nhật"}</strong>
    </div>
  );
}

async function getJobs(filters: { page: number; keyword: string; status: string; jobType: string; workingModel: string }) {
  const [companyResponse, jobsResponse] = await Promise.all([
    httpClient.get<ApiResponse<CompanyResponse>>("/companies/me"),
    httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
      params: {
        page: 1,
        size: 100,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
        jobType: filters.jobType || undefined,
        workingModel: filters.workingModel || undefined,
      },
    }),
  ]);
  const companyId = companyResponse.data.data.id;
  const ownJobs = jobsResponse.data.data.items.filter((job) => job.companyId === companyId);
  const pageSize = 8;
  const totalItems = ownJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(filters.page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: ownJobs.slice(start, start + pageSize),
    page: currentPage,
    size: pageSize,
    totalItems,
    totalPages,
  };
}

async function getJobDetail(jobId: number) {
  const [companyResponse, jobResponse] = await Promise.all([
    httpClient.get<ApiResponse<CompanyResponse>>("/companies/me"),
    httpClient.get<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`),
  ]);
  const job = jobResponse.data.data;
  if (job.companyId !== companyResponse.data.data.id) {
    throw new Error("Bạn không có quyền xem hoặc thao tác tin tuyển dụng của công ty khác.");
  }
  return job;
}

async function getSkills() {
  const response = await httpClient.get<ApiResponse<PageResponse<SkillResponse>>>("/skills", {
    params: {
      page: 1,
      size: 100,
    },
  });
  return response.data.data.items;
}

async function createJob(payload: ReturnType<typeof buildJobPayload>) {
  const response = await httpClient.post<ApiResponse<JobDetailResponse>>("/jobs", payload);
  return response.data.data;
}

async function updateJob(jobId: number, payload: ReturnType<typeof buildJobPayload>) {
  const response = await httpClient.put<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`, payload);
  return response.data.data;
}

async function updateJobStatus(jobId: number, status: JobStatus) {
  const response = await httpClient.patch<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}/status`, { status });
  return response.data.data;
}

async function deleteJob(jobId: number) {
  const response = await httpClient.delete<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`);
  return response.data.data;
}

function mapJobToForm(job: JobDetailResponse): JobFormState {
  return {
    title: job.title || "",
    description: job.description || "",
    requirements: job.requirements || "",
    benefits: job.benefits || "",
    location: job.location || "",
    jobType: job.jobType || "FULL_TIME",
    workingModel: job.workingModel || "ONSITE",
    status: job.status || "DRAFT",
    salaryMin: job.salaryMin == null ? "" : formatMoneyInput(String(job.salaryMin)),
    salaryMax: job.salaryMax == null ? "" : formatMoneyInput(String(job.salaryMax)),
    currency: "đồng",
    deadline: job.deadline || "",
    skillIds: job.skills?.map((skill) => String(skill.skillId)) ?? [],
  };
}

function buildJobPayload(form: JobFormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    requirements: emptyToNull(form.requirements),
    benefits: emptyToNull(form.benefits),
    location: emptyToNull(form.location),
    jobType: form.jobType,
    workingModel: form.workingModel,
    status: form.status,
    salaryMin: form.salaryMin ? parseMoneyInput(form.salaryMin) : null,
    salaryMax: form.salaryMax ? parseMoneyInput(form.salaryMax) : null,
    currency: "đồng",
    deadline: emptyToNull(form.deadline),
    skills: form.skillIds.map((skillId) => ({
      skillId: Number(skillId),
      importance: "REQUIRED" as SkillImportance,
      minLevel: "BEGINNER" as SkillLevel,
    })),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function jobStatusTone(status: JobStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "REJECTED" || status === "CLOSED" || status === "EXPIRED") return "danger" as const;
  return "warning" as const;
}

function formatJobMeta(job: Pick<JobResponse, "jobType" | "workingModel">) {
  const parts = [
    job.jobType ? JOB_TYPE_LABELS[job.jobType] : null,
    job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Chưa cập nhật";
}

function formatSalary(job: Pick<JobResponse, "salaryMin" | "salaryMax" | "currency">) {
  if (job.salaryMin == null && job.salaryMax == null) return "Thỏa thuận";
  const currency = "đồng";
  const min = job.salaryMin != null ? formatMoney(job.salaryMin) : "";
  const max = job.salaryMax != null ? formatMoney(job.salaryMax) : "";
  if (min && max) return `${min} - ${max} ${currency}`;
  return `${min || max} ${currency}`;
}

function formatMoney(value: number | string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return new Intl.NumberFormat("vi-VN").format(numberValue);
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(digits));
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function isPositiveIntegerMoney(value: string) {
  const amount = parseMoneyInput(value);
  return Number.isInteger(amount) && amount > 0;
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN").format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
