import { Copy, ExternalLink, FileCheck2, MapPin, Pencil, ShieldCheck, UploadCloud } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { CompanyVerificationDocumentPanel } from "../../features/company/verification/CompanyVerificationDocumentPanel";
import type { VerificationDocumentSnapshot } from "../../features/company/verification/verificationDocumentApi";
import { httpClient } from "../../services/api/httpClient";

interface RecruiterCompanyPageProps {
  mode?: "view" | "edit" | "verification";
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

interface CompanyResponse {
  etag?: string;
  revision: number;
  id: number;
  userId: number;
  email: string;
  companyName: string | null;
  taxCode: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
  phone: string | null;
  industry: string | null;
  companySize: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

interface CompanyForm {
  etag?: string;
  revision: number;
  companyName: string;
  taxCode: string;
  description: string;
  website: string;
  address: string;
  phone: string;
  industry: string;
  companySize: string;
  logoUrl: string;
  coverImageUrl: string;
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
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type CompanyStatus = "PENDING" | "VERIFIED" | "BLOCKED";
type JobStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "CLOSED" | "REJECTED" | "EXPIRED";
type JobType = "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
type WorkingModel = "ONSITE" | "HYBRID" | "REMOTE";

const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  PENDING: "Chờ xác thực",
  VERIFIED: "Đã xác thực",
  BLOCKED: "Bị khóa",
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

export function RecruiterCompanyPage({ mode = "view" }: RecruiterCompanyPageProps) {
  const { showToast } = useToast();
  const [companyReloadKey, setCompanyReloadKey] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const companyQuery = useAsyncData(() => getMyCompany(), [companyReloadKey]);
  const jobsQuery = useAsyncData(() => getCompanyJobs(jobsPage), [jobsPage]);

  async function copyText(label: string, value: string | null) {
    if (!value) {
      showToast({ type: "info", title: "Chưa có dữ liệu để copy" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      showToast({ type: "success", title: `Đã sao chép ${label}` });
    } catch {
      showToast({ type: "error", title: "Không thể sao chép", message: "Hãy chọn và sao chép nội dung trực tiếp trên trang." });
    }
  }

  async function documentUploaded(saved: VerificationDocumentSnapshot) {
    // Update the known shared revision immediately, even if the subsequent profile read fails.
    companyQuery.setData(current => current ? { ...current, revision: saved.revision, etag: saved.etag } : current);
    companyQuery.setData(await getMyCompany());
  }

  async function saveCompany(form: CompanyForm) {
    try {
      await updateMyCompany(form);
      setCompanyReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã lưu hồ sơ công ty" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu hồ sơ công ty", message: getErrorMessage(error) });
      throw error;
    }
  }

  if (companyQuery.loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (companyQuery.error || !companyQuery.data) {
    return (
      <PageContainer>
        <PageHeader title="Hồ sơ công ty" description="Không thể tải dữ liệu công ty." />
        <EmptyState message={companyQuery.error ?? "Không có dữ liệu công ty."} />
      </PageContainer>
    );
  }

  const company = companyQuery.data;

  if (mode === "verification") {
    return <CompanyVerificationView company={company} onUploaded={documentUploaded} />;
  }

  if (mode === "edit") {
    return <RecruiterCompanyEditView company={company} onSave={saveCompany} />;
  }

  return (
    <PageContainer>
      <PageHeader title="Hồ sơ công ty" description="Quản lý thông tin doanh nghiệp." />

      <CompanyHero company={company} onCopyWebsite={() => copyText("website", company.website)} onCopyAddress={() => copyText("địa chỉ", company.address)} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/recruiter/company/edit"><Button icon={<Pencil size={16} />}>Chỉnh sửa</Button></Link>
        <Link to="/recruiter/company/verification"><Button variant="secondary" icon={<ShieldCheck size={16} />}>Xác thực doanh nghiệp</Button></Link>
        <Link to={`/companies/${company.id}`}>
          <Button variant="secondary" icon={<ExternalLink size={16} />}>Xem trang công khai</Button>
        </Link>
      </div>

      <VerificationNotice company={company} />

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <SectionHeader title="Giới thiệu" />
            {company.description ? <p className="text-sm leading-6 text-slate-700">{company.description}</p> : <EmptyState message="Công ty chưa có mô tả." />}
          </Card>

          <CompanyJobsSection jobsPage={jobsPage} jobsQuery={jobsQuery} onPageChange={setJobsPage} />

          <UnsupportedSection
            title="Chi nhánh"
            message="Chưa có dữ liệu chi nhánh."
          />
        </div>

        <aside className="space-y-5">
          <CompanyInfoCard company={company} />
          <UnsupportedSection title="Phúc lợi" message="Chưa có dữ liệu phúc lợi." />
          <UnsupportedSection title="Hình ảnh công ty" message="Chưa có hình ảnh công ty." icon={<UploadCloud size={18} />} />
          <UnsupportedSection title="Thành viên tuyển dụng" message="Chưa có dữ liệu thành viên tuyển dụng." />
        </aside>
      </div>
    </PageContainer>
  );
}

function CompanyHero({ company, onCopyWebsite, onCopyAddress }: { company: CompanyResponse; onCopyWebsite: () => void; onCopyAddress: () => void }) {
  const name = company.companyName || company.email;
  return (
    <section className="neo-company-hero overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CompanyCover key={company.coverImageUrl ?? ""} company={company} name={name} />
      <div className="flex flex-wrap items-start justify-between gap-4 p-6">
        <div className="flex min-w-0 flex-1 gap-4">
          <CompanyLogo key={company.logoUrl ?? ""} name={name} url={company.logoUrl} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={COMPANY_STATUS_LABELS[company.status]} tone={companyStatusTone(company.status)} />
              {company.industry ? <StatusBadge label={company.industry} /> : null}
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <span className="break-words">Quy mô: <strong>{company.companySize || "Chưa cập nhật"}</strong></span>
              <span>Website: <strong>{company.website || "Chưa cập nhật"}</strong></span>
              <span>Địa chỉ: <strong>{company.address || "Chưa cập nhật"}</strong></span>
              <span>Email: <strong>{company.email}</strong></span>
              <span>Số điện thoại: <strong>{company.phone || "Chưa cập nhật"}</strong></span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Copy size={16} />} onClick={onCopyWebsite}>Copy website</Button>
          <Button variant="secondary" icon={<MapPin size={16} />} onClick={onCopyAddress}>Copy địa chỉ</Button>
        </div>
      </div>
    </section>
  );
}

function VerificationNotice({ company }: { company: CompanyResponse }) {
  const description = {
    PENDING: "Hồ sơ công ty đang ở trạng thái chờ xác thực.",
    VERIFIED: "Doanh nghiệp đã được xác thực.",
    BLOCKED: "Hồ sơ công ty đang bị khóa. Vui lòng liên hệ quản trị viên.",
  }[company.status];

  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionHeader title="Trạng thái xác thực" description={description} />
          <StatusBadge label={COMPANY_STATUS_LABELS[company.status]} tone={companyStatusTone(company.status)} />
        </div>
        <Link to="/recruiter/company/verification"><Button variant="secondary" icon={<FileCheck2 size={16} />}>Chi tiết</Button></Link>
      </div>
    </Card>
  );
}

function CompanyInfoCard({ company }: { company: CompanyResponse }) {
  return (
    <Card>
      <SectionHeader title="Thông tin doanh nghiệp" />
      <div className="space-y-3 text-sm text-slate-700">
        <InfoRow label="Tên công ty" value={company.companyName} />
        <InfoRow label="Mã số thuế" value={company.taxCode} />
        <InfoRow label="Lĩnh vực" value={company.industry} />
        <InfoRow label="Quy mô công ty" value={company.companySize} />
        <InfoRow label="Website" value={company.website} />
        <InfoRow label="Email" value={company.email} />
        <InfoRow label="Số điện thoại" value={company.phone} />
        <InfoRow label="Địa chỉ" value={company.address} />
        <InfoRow label="Cập nhật gần nhất" value={formatDateTime(company.updatedAt)} />
      </div>
    </Card>
  );
}

function CompanyJobsSection({
  jobsPage,
  jobsQuery,
  onPageChange,
}: {
  jobsPage: number;
  jobsQuery: ReturnType<typeof useAsyncData<PageResponse<JobResponse>>>;
  onPageChange: (page: number) => void;
}) {
  const jobs = jobsQuery.data?.items ?? [];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader title="Tin đang tuyển" description="Danh sách tin tuyển dụng của công ty." />
        <Link to="/recruiter/jobs/create"><Button>Tạo tin mới</Button></Link>
      </div>
      {jobsQuery.loading ? <LoadingState /> : null}
      {!jobsQuery.loading && jobsQuery.error ? <EmptyState message={jobsQuery.error} /> : null}
      {!jobsQuery.loading && !jobsQuery.error && jobs.length === 0 ? <EmptyState message="Công ty chưa có tin đang tuyển." /> : null}
      {!jobsQuery.loading && jobs.length > 0 ? (
        <div className="space-y-4">
          <Table
            rows={jobs}
            getRowKey={(job) => String(job.id)}
            columns={[
              { key: "title", header: "Tin tuyển dụng", render: (job) => <div><p className="font-medium text-slate-900">{job.title}</p><p className="text-xs text-slate-500">{job.location || "Chưa cập nhật địa điểm"}</p></div> },
              { key: "type", header: "Loại", render: (job) => formatJobMeta(job) },
              { key: "salary", header: "Lương", render: (job) => formatSalary(job) },
              { key: "deadline", header: "Hạn nộp", render: (job) => formatDate(job.deadline) },
              { key: "status", header: "Trạng thái", render: (job) => <StatusBadge label={JOB_STATUS_LABELS[job.status]} tone={jobStatusTone(job.status)} /> },
              { key: "actions", header: "Thao tác", render: (job) => <Link to={`/recruiter/jobs/${job.id}`}><Button variant="secondary" size="sm">Xem</Button></Link> },
            ]}
          />
          <Pagination page={jobsPage} totalPages={jobsQuery.data?.totalPages ?? 1} onPageChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
}

function RecruiterCompanyEditView({
  company,
  onSave,
}: {
  company: CompanyResponse;
  onSave: (form: CompanyForm) => Promise<void>;
}) {
  const [form, setForm] = useState(() => mapCompanyToForm(company));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState(false);

  useLayoutEffect(() => setForm(mapCompanyToForm(company)), [company]);

  function update<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.companyName.trim()) nextErrors.companyName = "Vui lòng nhập tên công ty.";
    if (form.website && form.website.length > 500) nextErrors.website = "Website tối đa 500 ký tự.";
    if (form.phone && form.phone.length > 50) nextErrors.phone = "Số điện thoại tối đa 50 ký tự.";
    if (form.companySize.length > 100) nextErrors.companySize = "Quy mô công ty tối đa 100 ký tự.";
    if (form.logoUrl.length > 500) nextErrors.logoUrl = "URL logo tối đa 500 ký tự.";
    else if (!isValidCompanyImageUrl(form.logoUrl)) nextErrors.logoUrl = "Nhập URL HTTP/HTTPS có host hợp lệ, không chứa khoảng trắng hoặc thông tin đăng nhập.";
    if (form.coverImageUrl.length > 500) nextErrors.coverImageUrl = "URL ảnh bìa tối đa 500 ký tự.";
    else if (!isValidCompanyImageUrl(form.coverImageUrl)) nextErrors.coverImageUrl = "Nhập URL HTTP/HTTPS có host hợp lệ, không chứa khoảng trắng hoặc thông tin đăng nhập.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    if (saving || conflict || !validate()) return;
    setSaveError("");
    setSaving(true);
    try { await onSave(form); }
    catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        setConflict(true);
        setSaveError("Hồ sơ đã thay đổi ở phiên khác. Bản đang soạn vẫn được giữ và chưa được lưu. Hãy ghi lại nội dung cần giữ trước khi tải lại trang để đối chiếu; hệ thống không tự gửi lại yêu cầu.");
      } else setSaveError(getErrorMessage(error));
    } finally { setSaving(false); }
  }

  return (
    <PageContainer>
      <PageHeader title="Chỉnh sửa hồ sơ công ty" description="Cập nhật thông tin doanh nghiệp." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeader title="Thông tin chính" />
          {saveError ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{saveError}</p> : null}
          <fieldset disabled={saving}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Tên công ty" value={form.companyName} error={errors.companyName} onChange={(event) => update("companyName", event.target.value)} />
            <Input label="Mã số thuế" value={form.taxCode} onChange={(event) => update("taxCode", event.target.value)} />
            <Input label="Lĩnh vực" value={form.industry} onChange={(event) => update("industry", event.target.value)} />
            <Input label="Quy mô công ty" value={form.companySize} error={errors.companySize} onChange={(event) => update("companySize", event.target.value)} />
            <Input label="URL logo" inputMode="url" value={form.logoUrl} aria-describedby="company-logo-hint" error={errors.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} />
            <Input label="URL ảnh bìa" inputMode="url" value={form.coverImageUrl} aria-describedby="company-cover-hint" error={errors.coverImageUrl} onChange={(event) => update("coverImageUrl", event.target.value)} />
            <Input label="Website" value={form.website} error={errors.website} onChange={(event) => update("website", event.target.value)} />
            <Input label="Email đăng nhập" value={company.email} disabled />
            <Input label="Số điện thoại" value={form.phone} error={errors.phone} onChange={(event) => update("phone", event.target.value)} />
          </div>
          <p id="company-cover-hint" className="mt-3 text-sm text-slate-500">URL ảnh bìa HTTP/HTTPS tối đa 500 ký tự. Để trống để xóa; ảnh lỗi sẽ dùng nền Neo-Aurora.</p>
          <p id="company-logo-hint" className="mt-3 text-sm text-slate-500">Quy mô tối đa 100 ký tự. URL logo HTTP/HTTPS tối đa 500 ký tự; để trống để xóa. Logo được tải từ URL, không có chức năng tải ảnh lên.</p>
          <div className="mt-4 grid gap-4">
            <Textarea label="Địa chỉ" value={form.address} onChange={(event) => update("address", event.target.value)} />
            <Textarea label="Giới thiệu công ty" value={form.description} onChange={(event) => update("description", event.target.value)} />
          </div>
          </fieldset>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button loading={saving} disabled={conflict} onClick={save}>Lưu hồ sơ</Button>
            <Link to="/recruiter/company"><Button variant="secondary">Quay lại</Button></Link>
          </div>
        </Card>
        <aside className="space-y-5">
          <Card>
            <SectionHeader title="Trạng thái" />
            <StatusBadge label={COMPANY_STATUS_LABELS[company.status]} tone={companyStatusTone(company.status)} />
            <p className="mt-3 text-sm text-slate-600">Trạng thái xác thực do quản trị viên quản lý.</p>
          </Card>
          <Card><SectionHeader title="Logo và ảnh bìa" description="Dùng URL ảnh HTTP/HTTPS có thể truy cập để cập nhật logo và ảnh bìa. Hệ thống hiện hỗ trợ ảnh qua URL; chưa hỗ trợ tải tệp ảnh lên." /></Card>
          <UnsupportedSection title="Thông tin bổ sung" message="Chưa có dữ liệu chi nhánh, phúc lợi, mạng xã hội và thành viên tuyển dụng." />
        </aside>
      </div>
    </PageContainer>
  );
}

function CompanyVerificationView({ company, onUploaded }: { company: CompanyResponse; onUploaded: (snapshot: VerificationDocumentSnapshot) => Promise<void> }) {
  return (
    <PageContainer>
      <PageHeader title="Xác thực doanh nghiệp" description="Theo dõi trạng thái xác thực công ty." />
      <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Doanh nghiệp mới đăng ký ở trạng thái Chờ xác thực. Chỉ Admin được xác thực hoặc chặn công ty. Bạn có thể lưu bản nháp; tin chỉ được công khai khi công ty đã xác thực và tin được Admin duyệt. Việc chặn công ty không xóa jobs hoặc applications đã có.</p>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeader title={company.companyName || company.email} description="Trạng thái hiện tại của hồ sơ doanh nghiệp." />
          <div className="space-y-3 text-sm text-slate-700">
            <InfoRow label="Trạng thái" value={COMPANY_STATUS_LABELS[company.status]} />
            <InfoRow label="Mã số thuế" value={company.taxCode} />
            <InfoRow label="Email" value={company.email} />
            <InfoRow label="Cập nhật gần nhất" value={formatDateTime(company.updatedAt)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <p className="text-sm leading-6 text-slate-600">Bạn có thể gửi hoặc thay thế tài liệu riêng tư ở bên cạnh. Trạng thái xác thực do quản trị viên quản lý.</p>
            <Link to="/recruiter/company"><Button variant="secondary">Quay lại hồ sơ</Button></Link>
          </div>
        </Card>
        <CompanyVerificationDocumentPanel key={company.id} mode="company" onUploaded={onUploaded} />
      </div>
    </PageContainer>
  );
}

function UnsupportedSection({ title, message, icon, action }: { title: string; message: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <SectionHeader title={title} description={message} />
        {icon ? <div className="rounded-md bg-slate-100 p-2 text-slate-500">{icon}</div> : null}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
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

async function getMyCompany() {
  const response = await httpClient.get<ApiResponse<CompanyResponse>>("/companies/me");
  return { ...response.data.data, etag: response.headers?.etag };
}

async function updateMyCompany(form: CompanyForm) {
  const response = await httpClient.put<ApiResponse<CompanyResponse>>("/companies/me", {
    companyName: emptyToNull(form.companyName),
    taxCode: emptyToNull(form.taxCode),
    description: emptyToNull(form.description),
    website: emptyToNull(form.website),
    address: emptyToNull(form.address),
    phone: emptyToNull(form.phone),
    industry: emptyToNull(form.industry),
    companySize: form.companySize.trim(),
    logoUrl: form.logoUrl,
    coverImageUrl: form.coverImageUrl,
  }, { headers: { "If-Match": form.etag } });
  return response.data.data;
}

const COMPANY_JOBS_PAGE_SIZE = 5;

async function getCompanyJobs(page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<JobResponse>>>("/companies/me/jobs", {
    params: { page, size: COMPANY_JOBS_PAGE_SIZE, status: "ACTIVE" },
  });
  return response.data.data;
}

function mapCompanyToForm(company: CompanyResponse): CompanyForm {
  return {
    revision: company.revision,
    etag: company.etag,
    companyName: company.companyName || "",
    taxCode: company.taxCode || "",
    description: company.description || "",
    website: company.website || "",
    address: company.address || "",
    phone: company.phone || "",
    industry: company.industry || "",
    companySize: company.companySize ?? "",
    logoUrl: company.logoUrl ?? "",
    coverImageUrl: company.coverImageUrl ?? "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function companyStatusTone(status: CompanyStatus) {
  if (status === "VERIFIED") return "success" as const;
  if (status === "BLOCKED") return "danger" as const;
  return "warning" as const;
}

function jobStatusTone(status: JobStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "REJECTED" || status === "CLOSED" || status === "EXPIRED") return "danger" as const;
  return "warning" as const;
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(-2)
    .toUpperCase();
  return initials || "CT";
}

function formatJobMeta(job: JobResponse) {
  const parts = [
    job.jobType ? JOB_TYPE_LABELS[job.jobType] : null,
    job.workingModel ? WORKING_MODEL_LABELS[job.workingModel] : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Chưa cập nhật";
}

function formatSalary(job: JobResponse) {
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

/** Shared company logo/cover URL contract: optional absolute HTTP(S), host, no whitespace or credentials. */
function isValidCompanyImageUrl(value: string) {
  if (value === "") return true;
  if (Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false;
  if (!/^https?:\/\//i.test(value) || /[\s\\]/u.test(value) || /%(?![a-f\d]{2})/i.test(value) || /[<>"{}|^`]/.test(value)) return false;
  const authority = value.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  if (!authority || authority.includes("@") || /[^a-z\d.:[\]-]/i.test(authority)) return false;
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password) return false;
    if (!authority.startsWith("[")) {
      const labels = authority.split(":")[0].split(".");
      if (labels.some((label, index) => !(label === "" && index === labels.length - 1) && !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))) return false;
    }
    return true;
  } catch { return false; }
}

function CompanyLogo({ name, url }: { name: string; url?: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImage = url && url.length <= 500 && isValidCompanyImageUrl(url) && !failed;
  return <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-xl font-semibold text-brand-700">
    {showImage ? <img src={url ?? undefined} alt={`Logo ${name}`} width={64} height={64} referrerPolicy="no-referrer" decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      : <span role="img" aria-label={`Logo mặc định của ${name}`}>{getInitials(name)}</span>}
  </div>;
}

function CompanyCover({ company, name }: { company: CompanyResponse; name: string }) {
  const [failed, setFailed] = useState(false);
  const url = company.coverImageUrl;
  const showImage = url && url.length <= 500 && isValidCompanyImageUrl(url) && !failed;
  return <div className="aurora-panel relative flex min-h-48 items-end p-6 text-white">
    {showImage ? <>
      <img src={url ?? undefined} alt="" aria-hidden="true" referrerPolicy="no-referrer" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/75" />
    </> : null}
    <div className="relative z-10 min-w-0 max-w-3xl break-words">
      <p className="text-sm text-slate-200">{company.industry || "Chưa cập nhật lĩnh vực"}</p>
      <h2 className="mt-2 text-3xl font-semibold text-white">{name}</h2>
    </div>
  </div>;
}
