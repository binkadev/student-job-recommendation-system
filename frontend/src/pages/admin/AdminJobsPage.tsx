import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Checkbox } from "../../components/ui/Checkbox";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type BackendJobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type BackendWorkingModel = "ONSITE" | "HYBRID" | "REMOTE";
type BackendJobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type JobAction = "approve" | "reject" | "pending" | "close" | "reopen" | "bulkApprove" | "bulkClose" | null;

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
}

interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  title: string;
  location: string | null;
  jobType: BackendJobType | null;
  workingModel: BackendWorkingModel | null;
  status: BackendJobStatus;
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

interface JobFilters {
  keyword: string;
  location: string;
  jobType: string;
  workingModel: string;
  status: string;
  page: number;
}

const pageSize = 8;
const emptyOption = { label: "Tất cả", value: "" };

const JOB_TYPE_LABELS: Record<BackendJobType, string> = {
  FULL_TIME: "Toàn thời gian",
  PART_TIME: "Bán thời gian",
  INTERNSHIP: "Thực tập",
  CONTRACT: "Hợp đồng",
};

const WORKING_MODEL_LABELS: Record<BackendWorkingModel, string> = {
  ONSITE: "Onsite",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
};

const JOB_STATUS_LABELS: Record<BackendJobStatus, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang tuyển",
  CLOSED: "Đã đóng",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn",
};

export function AdminJobsPage({ mode = "list" }: { mode?: "list" | "pending" | "detail" | "review" }) {
  const { jobId } = useParams();
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<JobFilters>({
    keyword: "",
    location: "",
    jobType: "",
    workingModel: "",
    status: mode === "pending" ? "PENDING_APPROVAL" : "",
    page: 1,
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionType, setActionType] = useState<JobAction>(null);
  const [actionTarget, setActionTarget] = useState<JobResponse | JobDetailResponse | null>(null);
  const [actionReason, setActionReason] = useState("");

  const effectiveFilters = { ...filters, status: mode === "pending" ? "PENDING_APPROVAL" : filters.status };
  const jobsQuery = useAsyncData(() => getJobs(effectiveFilters), [
    reloadKey,
    effectiveFilters.keyword,
    effectiveFilters.location,
    effectiveFilters.jobType,
    effectiveFilters.workingModel,
    effectiveFilters.status,
    effectiveFilters.page,
  ]);
  const detailQuery = useAsyncData(() => jobId && (mode === "detail" || mode === "review") ? getJobDetail(jobId) : Promise.resolve(null), [jobId, mode, reloadKey]);

  const result = jobsQuery.data;
  const jobs = result?.items ?? [];
  const selectedJob = detailQuery.data ?? jobs.find((job) => String(job.id) === jobId) ?? null;
  const allPageSelected = jobs.length > 0 && jobs.every((job) => selectedIds.includes(job.id));
  const selectedActiveIds = jobs.filter((job) => selectedIds.includes(job.id) && job.status === "ACTIVE").map((job) => job.id);
  const filterOptions = useMemo(() => ({
    jobTypes: Object.entries(JOB_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    workModes: Object.entries(WORKING_MODEL_LABELS).map(([value, label]) => ({ value, label })),
    statuses: Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  }), []);

  function updateFilter<Key extends keyof JobFilters>(key: Key, value: JobFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
    setSelectedIds([]);
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleSelectPage() {
    setSelectedIds((current) => allPageSelected ? current.filter((id) => !jobs.some((job) => job.id === id)) : unique([...current, ...jobs.map((job) => job.id)]));
  }

  function openAction(action: JobAction, job: JobResponse | JobDetailResponse | null = null) {
    setActionType(action);
    setActionTarget(job);
    setActionReason("");
  }

  async function confirmAction() {
    try {
      if (actionType === "bulkApprove") {
        await Promise.all(selectedIds.map((id) => updateJobStatus(id, "ACTIVE")));
        showToast({ type: "success", title: "Đã duyệt các tin đã chọn" });
        setSelectedIds([]);
      }
      if (actionType === "bulkClose") {
        await Promise.all(selectedActiveIds.map((id) => updateJobStatus(id, "CLOSED")));
        showToast({ type: "success", title: "Đã đóng các tin đã chọn" });
        setSelectedIds([]);
      }
      if (actionTarget && actionType === "approve") {
        await updateJobStatus(actionTarget.id, "ACTIVE");
        showToast({ type: "success", title: "Đã duyệt tin tuyển dụng" });
      }
      if (actionTarget && actionType === "reject") {
        await updateJobStatus(actionTarget.id, "REJECTED");
        showToast({ type: "success", title: "Đã từ chối tin tuyển dụng" });
      }
      if (actionTarget && actionType === "pending") {
        await updateJobStatus(actionTarget.id, "PENDING_APPROVAL");
        showToast({ type: "success", title: "Đã chuyển tin về chờ duyệt" });
      }
      if (actionTarget && actionType === "close") {
        await updateJobStatus(actionTarget.id, "CLOSED");
        showToast({ type: "success", title: "Đã đóng tin tuyển dụng" });
      }
      if (actionTarget && actionType === "reopen") {
        await updateJobStatus(actionTarget.id, "ACTIVE");
        showToast({ type: "success", title: "Đã mở lại tin tuyển dụng" });
      }
      setActionType(null);
      setActionTarget(null);
      setActionReason("");
      setReloadKey((value) => value + 1);
    } catch {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái tin" });
    }
  }

  if ((jobsQuery.loading && !jobsQuery.data) || (detailQuery.loading && (mode === "detail" || mode === "review"))) {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  if ((mode === "detail" || mode === "review") && selectedJob) {
    const selectedJobDetail = isJobDetail(selectedJob) ? selectedJob : null;

    return (
      <PageContainer>
        <PageHeader title={mode === "review" ? "Duyệt tin tuyển dụng" : "Chi tiết tin tuyển dụng"} description="Thông tin tin tuyển dụng dựa trên bảng jobs và job_skills trong DB." />
        {detailQuery.error ? <div className="mb-5"><ErrorState message={detailQuery.error} /></div> : null}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{selectedJob.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{selectedJob.companyName} - {selectedJob.location || "Chưa cập nhật"} - {formatSalary(selectedJob)}</p>
                </div>
                <StatusBadge label={JOB_STATUS_LABELS[selectedJob.status]} tone={getStatusTone(selectedJob.status)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge label={selectedJob.jobType ? JOB_TYPE_LABELS[selectedJob.jobType] : "Chưa cập nhật loại việc"} />
                <StatusBadge label={selectedJob.workingModel ? WORKING_MODEL_LABELS[selectedJob.workingModel] : "Chưa cập nhật hình thức"} />
                {(selectedJob.skills ?? []).map((skill) => <StatusBadge key={skill.id} label={skill.skillName} />)}
              </div>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <Info label="ID" value={String(selectedJob.id)} />
                <Info label="Company ID" value={String(selectedJob.companyId)} />
                <Info label="Công ty" value={selectedJob.companyName} />
                <Info label="Địa điểm" value={selectedJob.location || "Chưa cập nhật"} />
                <Info label="Loại việc" value={selectedJob.jobType ? JOB_TYPE_LABELS[selectedJob.jobType] : "Chưa cập nhật"} />
                <Info label="Hình thức" value={selectedJob.workingModel ? WORKING_MODEL_LABELS[selectedJob.workingModel] : "Chưa cập nhật"} />
                <Info label="Lương" value={formatSalary(selectedJob)} />
                <Info label="Deadline" value={formatDate(selectedJob.deadline)} />
                <Info label="Published at" value={formatDateTime(selectedJob.publishedAt)} />
                <Info label="Closed at" value={formatDateTime(selectedJob.closedAt)} />
                <Info label="Created at" value={formatDateTime(selectedJob.createdAt)} />
                <Info label="Updated at" value={formatDateTime(selectedJob.updatedAt)} />
              </div>
            </Card>

            <ContentCard title="Mô tả công việc" value={selectedJobDetail?.description} emptyMessage="Tin tuyển dụng chưa có mô tả." />
            <ListContentCard title="Yêu cầu" value={selectedJobDetail?.requirements} emptyMessage="Tin tuyển dụng chưa có yêu cầu." />
            <ListContentCard title="Quyền lợi" value={selectedJobDetail?.benefits} emptyMessage="Tin tuyển dụng chưa có quyền lợi." />

            <Card>
              <SectionHeader title="Kỹ năng yêu cầu" description="Dữ liệu từ bảng job_skills và skills." />
              {selectedJob.skills?.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedJob.skills.map((skill) => (
                    <div key={skill.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-900">{skill.skillName}</p>
                      <p className="mt-1 text-slate-600">Skill ID: {skill.skillId}</p>
                      <p className="mt-1 text-slate-600">Category: {skill.category || "Chưa cập nhật"}</p>
                    </div>
                  ))}
                </div>
              ) : <EmptyState message="Tin tuyển dụng chưa có kỹ năng." />}
            </Card>
          </div>

          <aside className="space-y-4">
            <Card>
              <SectionHeader title="Thao tác trạng thái" description="API hiện chỉ nhận field status." />
              <div className="grid gap-2">
                {selectedJob.status === "PENDING_APPROVAL" ? <Button onClick={() => openAction("approve", selectedJob)}>Duyệt thành ACTIVE</Button> : null}
                {selectedJob.status === "PENDING_APPROVAL" ? <Button variant="danger" onClick={() => openAction("reject", selectedJob)}>Từ chối</Button> : null}
                {selectedJob.status !== "PENDING_APPROVAL" ? <Button variant="secondary" onClick={() => openAction("pending", selectedJob)}>Chuyển về chờ duyệt</Button> : null}
                {selectedJob.status === "ACTIVE" ? <Button variant="secondary" onClick={() => openAction("close", selectedJob)}>Đóng tin</Button> : null}
                {selectedJob.status === "CLOSED" ? <Button variant="secondary" onClick={() => openAction("reopen", selectedJob)}>Mở lại</Button> : null}
              </div>
            </Card>
            <Card>
              <SectionHeader title="Thông tin chưa có API admin" />
              <div className="flex flex-wrap gap-2">
                {["Audit log", "Số ứng viên", "Cảnh báo kiểm duyệt", "Xác thực công ty", "Reason gửi recruiter"].map((item) => <StatusBadge key={item} label={item} tone="warning" />)}
              </div>
            </Card>
          </aside>
        </div>

        <JobActionModal actionType={actionType} target={actionTarget} selectedCount={selectedIds.length} reason={actionReason} setReason={setActionReason} onClose={() => setActionType(null)} onConfirm={() => void confirmAction()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={mode === "pending" ? "Tin chờ duyệt" : "Quản lý tin tuyển dụng"} description="Danh sách tin tuyển dụng khớp các trường jobs/job_skills trong DB và JobFilterRequest của API." />
      {jobsQuery.error ? <div className="mb-5"><ErrorState message={jobsQuery.error} /></div> : null}

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Từ khóa" value={filters.keyword} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="Tên tin, công ty..." />
          <Input label="Địa điểm" value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} placeholder="Tỉnh/thành phố" />
          <Select label="Loại việc" value={filters.jobType} onChange={(event) => updateFilter("jobType", event.target.value)} options={[emptyOption, ...filterOptions.jobTypes]} />
          <Select label="Hình thức" value={filters.workingModel} onChange={(event) => updateFilter("workingModel", event.target.value)} options={[emptyOption, ...filterOptions.workModes]} />
          <Select label="Trạng thái" value={effectiveFilters.status} disabled={mode === "pending"} onChange={(event) => updateFilter("status", event.target.value)} options={[emptyOption, ...filterOptions.statuses]} />
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox label="Chọn trang này" checked={allPageSelected} onChange={toggleSelectPage} />
          <span className="text-sm text-slate-500">Đã chọn {selectedIds.length} tin</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={selectedIds.length === 0} onClick={() => openAction("bulkApprove")}>Duyệt nhiều tin</Button>
          <Button size="sm" variant="secondary" disabled={selectedActiveIds.length === 0} onClick={() => openAction("bulkClose")}>Đóng nhiều tin</Button>
        </div>
      </div>

      {jobs.length ? (
        <Table
          rows={jobs}
          getRowKey={(job) => String(job.id)}
          columns={[
            { key: "select", header: "", render: (job) => <Checkbox aria-label={`Chọn ${job.title}`} label="" checked={selectedIds.includes(job.id)} onChange={() => toggleSelected(job.id)} /> },
            { key: "job", header: "Tin tuyển dụng", render: (job) => <JobSummary job={job} /> },
            { key: "type", header: "Loại/hình thức", render: (job) => <JobTypeSummary job={job} /> },
            { key: "salary", header: "Lương/deadline", render: (job) => <SalarySummary job={job} /> },
            { key: "status", header: "Trạng thái", render: (job) => <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={getStatusTone(job.status)} /> },
            { key: "actions", header: "Thao tác", render: (job) => <JobActions job={job} onOpen={openAction} /> },
          ]}
        />
      ) : (
        <Card><EmptyState message="Không có tin tuyển dụng phù hợp với bộ lọc hiện tại." /></Card>
      )}

      <div className="mt-5">
        <Pagination page={result?.page ?? filters.page} totalPages={result?.totalPages ?? 1} onPageChange={(page) => updateFilter("page", page)} />
      </div>

      <JobActionModal actionType={actionType} target={actionTarget} selectedCount={selectedIds.length} reason={actionReason} setReason={setActionReason} onClose={() => setActionType(null)} onConfirm={() => void confirmAction()} />
    </PageContainer>
  );
}

function JobSummary({ job }: { job: JobResponse }) {
  return (
    <div className="min-w-[260px]">
      <p className="font-medium text-slate-900">{job.title}</p>
      <p className="mt-1 text-xs text-slate-500">{job.companyName} - Company ID: {job.companyId}</p>
      <p className="mt-1 text-xs text-slate-500">{job.location || "Chưa cập nhật"}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {(job.skills ?? []).slice(0, 3).map((skill) => <StatusBadge key={skill.id} label={skill.skillName} />)}
        {(job.skills ?? []).length > 3 ? <StatusBadge label={`+${job.skills.length - 3}`} /> : null}
      </div>
    </div>
  );
}

function JobTypeSummary({ job }: { job: JobResponse }) {
  return (
    <div className="min-w-[130px] space-y-1 text-sm text-slate-700">
      <p>{job.jobType ? JOB_TYPE_LABELS[job.jobType] : "Chưa cập nhật"}</p>
      <p>{job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : "Chưa cập nhật"}</p>
    </div>
  );
}

function SalarySummary({ job }: { job: JobResponse }) {
  return (
    <div className="min-w-[140px] space-y-1 text-sm text-slate-700">
      <p>{formatSalary(job)}</p>
      <p className="text-xs text-slate-500">Hạn: {formatDate(job.deadline)}</p>
    </div>
  );
}

function JobActions({ job, onOpen }: { job: JobResponse; onOpen: (action: JobAction, job: JobResponse) => void }) {
  return (
    <div className="grid w-[108px] gap-2">
      <Link to={`/admin/jobs/${job.id}${job.status === "PENDING_APPROVAL" ? "/review" : ""}`}><Button className="w-full" size="sm" variant="secondary">Xem</Button></Link>
      {job.status === "PENDING_APPROVAL" ? <Button className="w-full" size="sm" onClick={() => onOpen("approve", job)}>Duyệt</Button> : null}
      {job.status === "PENDING_APPROVAL" ? <Button className="w-full" size="sm" variant="danger" onClick={() => onOpen("reject", job)}>Từ chối</Button> : null}
      {job.status === "ACTIVE" ? <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("close", job)}>Đóng</Button> : null}
      {job.status === "CLOSED" ? <Button className="w-full" size="sm" variant="secondary" onClick={() => onOpen("reopen", job)}>Mở lại</Button> : null}
    </div>
  );
}

function JobActionModal({
  actionType,
  target,
  selectedCount,
  reason,
  setReason,
  onClose,
  onConfirm,
}: {
  actionType: JobAction;
  target: JobResponse | JobDetailResponse | null;
  selectedCount: number;
  reason: string;
  setReason: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const title = getActionTitle(actionType);
  const showReason = actionType === "reject" || actionType === "pending" || actionType === "close" || actionType === "bulkClose";

  return (
    <Modal open={Boolean(actionType)} title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{target ? <strong>{target.title}</strong> : <strong>{selectedCount} tin đã chọn</strong>}</p>
        {showReason ? (
          <>
            <Textarea label="Ghi chú nội bộ" value={reason} onChange={(event) => setReason(event.target.value)} />
            <p className="text-xs text-slate-500">Backend hiện chỉ nhận field `status`, ghi chú này chưa được gửi lên API.</p>
          </>
        ) : (
          <p className="text-sm text-slate-600">Xác nhận cập nhật trạng thái tin tuyển dụng qua API jobs.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant={actionType === "reject" || actionType === "close" || actionType === "bulkClose" ? "danger" : "primary"} onClick={onConfirm}>Xác nhận</Button>
        </div>
      </div>
    </Modal>
  );
}

function ContentCard({ title, value, emptyMessage }: { title: string; value?: string | null; emptyMessage: string }) {
  return (
    <Card>
      <SectionHeader title={title} />
      {value ? <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{value}</p> : <EmptyState message={emptyMessage} />}
    </Card>
  );
}

function ListContentCard({ title, value, emptyMessage }: { title: string; value?: string | null; emptyMessage: string }) {
  const items = splitContent(value);
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

function Info({ label, value }: { label: string; value: string }) {
  return <p className="text-slate-700"><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

async function getJobs(filters: JobFilters): Promise<PageResponse<JobResponse>> {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/jobs", {
    params: {
      page: filters.page,
      size: pageSize,
      keyword: filters.keyword || undefined,
      location: filters.location || undefined,
      jobType: filters.jobType || undefined,
      workingModel: filters.workingModel || undefined,
      status: filters.status || undefined,
    },
  });
  return response.data.data;
}

async function getJobDetail(jobId: string): Promise<JobDetailResponse> {
  const response = await httpClient.get<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}`);
  return response.data.data;
}

async function updateJobStatus(jobId: number, status: BackendJobStatus) {
  await httpClient.patch<ApiResponse<JobDetailResponse>>(`/jobs/${jobId}/status`, { status });
}

function getStatusTone(status: BackendJobStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "DRAFT" || status === "PENDING_APPROVAL") return "warning" as const;
  if (status === "CLOSED" || status === "REJECTED" || status === "EXPIRED") return "danger" as const;
  return "neutral" as const;
}

function getActionTitle(actionType: JobAction) {
  if (actionType === "approve" || actionType === "bulkApprove") return "Duyệt tin tuyển dụng";
  if (actionType === "reject") return "Từ chối tin tuyển dụng";
  if (actionType === "pending") return "Chuyển về chờ duyệt";
  if (actionType === "close" || actionType === "bulkClose") return "Đóng tin tuyển dụng";
  if (actionType === "reopen") return "Mở lại tin tuyển dụng";
  return "Thao tác tin tuyển dụng";
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

function formatDate(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function splitContent(value?: string | null) {
  if (!value) return [];
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function isJobDetail(job: JobResponse | JobDetailResponse): job is JobDetailResponse {
  return "description" in job;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
