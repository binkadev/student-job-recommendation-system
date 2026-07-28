import { useState } from "react";
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
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type CompanyStatus = "PENDING" | "VERIFIED" | "BLOCKED";

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

interface CompanyAdminRow {
  id: number;
  userId: number;
  email: string;
  companyName: string;
  taxCode: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  status: CompanyStatus;
  openJobs: number;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<CompanyStatus, string> = {
  PENDING: "Chờ xác thực",
  VERIFIED: "Đã xác thực",
  BLOCKED: "Bị khóa",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

export function AdminCompaniesPage({ mode = "list" }: { mode?: "list" | "detail" | "verification" }) {
  const { companyId } = useParams();
  const id = Number(companyId);

  if ((mode === "detail" || mode === "verification") && Number.isFinite(id)) {
    return <AdminCompanyDetailPage companyId={id} mode={mode} />;
  }

  return <AdminCompaniesListPage />;
}

function AdminCompaniesListPage() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState({
    companyName: "",
    taxCode: "",
    industry: "",
    status: "",
    sort: "createdAt,desc",
  });
  const [targetCompany, setTargetCompany] = useState<CompanyAdminRow | null>(null);
  const [nextStatus, setNextStatus] = useState<CompanyStatus>("PENDING");
  const [updating, setUpdating] = useState(false);
  const companiesQuery = useAsyncData(() => getAdminCompanies(filters, page), [filters, page, reloadKey]);
  const result = companiesQuery.data;

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  async function updateStatus() {
    if (!targetCompany) return;
    setUpdating(true);
    try {
      await updateAdminCompanyStatus(targetCompany.id, nextStatus);
      setTargetCompany(null);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật trạng thái công ty" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(error) });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý doanh nghiệp" description="Dữ liệu lấy từ GET /api/admin/companies theo bảng companies." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Tên công ty" value={filters.companyName} onChange={(event) => updateFilter("companyName", event.target.value)} placeholder="Nhập tên công ty" />
          <Input label="Mã số thuế" value={filters.taxCode} onChange={(event) => updateFilter("taxCode", event.target.value)} placeholder="Nhập mã số thuế" />
          <Input label="Lĩnh vực" value={filters.industry} onChange={(event) => updateFilter("industry", event.target.value)} placeholder="Nhập lĩnh vực" />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...statusOptions]} />
          <Select label="Sắp xếp" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)} options={[{ label: "Mới nhất", value: "createdAt,desc" }, { label: "Cũ nhất", value: "createdAt,asc" }]} />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng công ty: {result?.totalItems ?? 0}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Admin có thể xem chi tiết và cập nhật trạng thái xác thực công ty bằng API backend hiện có.</p>
      </Card>

      {companiesQuery.loading ? <LoadingState /> : null}
      {!companiesQuery.loading && companiesQuery.error ? <EmptyState message={companiesQuery.error} /> : null}
      {!companiesQuery.loading && !companiesQuery.error && (result?.items.length ?? 0) === 0 ? <EmptyState message="Không có công ty phù hợp." /> : null}
      {!companiesQuery.loading && result?.items.length ? (
        <div className="space-y-4">
          <Table
            rows={result.items}
            getRowKey={(company) => String(company.id)}
            columns={[
              { key: "company", header: "Công ty", render: (company) => <CompanySummary company={company} /> },
              { key: "legal", header: "Pháp lý", render: (company) => <LegalSummary company={company} /> },
              { key: "contact", header: "Liên hệ", render: (company) => <ContactSummary company={company} /> },
              { key: "jobs", header: "Tin mở", render: (company) => company.openJobs ?? 0 },
              { key: "status", header: "Trạng thái", render: (company) => <StatusBadge label={statusLabels[company.status]} tone={getStatusTone(company.status)} /> },
              { key: "actions", header: "Thao tác", render: (company) => (
                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/companies/${company.id}`}><Button variant="secondary" size="sm">Chi tiết</Button></Link>
                  <Button variant="secondary" size="sm" onClick={() => { setTargetCompany(company); setNextStatus(company.status); }}>Trạng thái</Button>
                </div>
              ) },
            ]}
          />
          <Pagination page={result.page} totalPages={Math.max(result.totalPages, 1)} onPageChange={setPage} />
        </div>
      ) : null}

      <Modal open={Boolean(targetCompany)} title="Cập nhật trạng thái công ty" onClose={() => setTargetCompany(null)}>
        {targetCompany ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Cập nhật trạng thái cho <strong>{targetCompany.companyName}</strong>.</p>
            <Select label="Trạng thái" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as CompanyStatus)} options={statusOptions} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTargetCompany(null)}>Hủy</Button>
              <Button loading={updating} onClick={() => void updateStatus()}>Cập nhật</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

function AdminCompanyDetailPage({ companyId, mode }: { companyId: number; mode: "detail" | "verification" }) {
  const companyQuery = useAsyncData(() => getAdminCompany(companyId), [companyId]);

  if (companyQuery.loading) return <PageContainer><LoadingState /></PageContainer>;
  if (companyQuery.error || !companyQuery.data) return <PageContainer><EmptyState message={companyQuery.error ?? "Không tìm thấy công ty."} /></PageContainer>;

  const company = companyQuery.data;
  return (
    <PageContainer>
      <PageHeader
        title={mode === "verification" ? "Chi tiết xác thực doanh nghiệp" : company.companyName}
        description={`Chi tiết công ty ID ${company.id} từ GET /api/admin/companies/${company.id}.`}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <SectionHeader title="Thông tin công ty" />
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <Info label="Tên công ty" value={company.companyName} />
            <Info label="Email" value={company.email} />
            <Info label="Mã số thuế" value={company.taxCode ?? "Chưa cập nhật"} />
            <Info label="Lĩnh vực" value={company.industry ?? "Chưa cập nhật"} />
            <Info label="Quy mô" value={company.companySize ?? "Chưa cập nhật"} />
            <Info label="Website" value={company.websiteUrl ?? "Chưa cập nhật"} />
            <Info label="Số điện thoại" value={company.phone ?? "Chưa cập nhật"} />
            <Info label="Địa chỉ" value={company.address ?? "Chưa cập nhật"} />
            <Info label="Tin đang mở" value={String(company.openJobs ?? 0)} />
            <Info label="Tạo lúc" value={formatDateTime(company.createdAt)} />
            <Info label="Cập nhật" value={formatDateTime(company.updatedAt)} />
          </div>
        </Card>
        <Card>
          <SectionHeader title="Trạng thái" />
          <StatusBadge label={statusLabels[company.status]} tone={getStatusTone(company.status)} />
          <p className="mt-4 text-sm leading-6 text-slate-600">{company.description || "Công ty chưa cập nhật mô tả."}</p>
        </Card>
      </div>
    </PageContainer>
  );
}

function CompanySummary({ company }: { company: CompanyAdminRow }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{company.companyName}</p>
      <p className="mt-1 text-xs text-slate-500">ID: {company.id} - User ID: {company.userId}</p>
      <p className="mt-1 text-xs text-slate-500">{company.industry || "Chưa cập nhật"}</p>
    </div>
  );
}

function LegalSummary({ company }: { company: CompanyAdminRow }) {
  return (
    <div className="min-w-[160px] space-y-1 text-xs text-slate-600">
      <p><span className="text-slate-500">MST:</span> {company.taxCode || "Chưa cập nhật"}</p>
      <p><span className="text-slate-500">Quy mô:</span> {company.companySize || "Chưa cập nhật"}</p>
    </div>
  );
}

function ContactSummary({ company }: { company: CompanyAdminRow }) {
  return (
    <div className="min-w-[180px] space-y-1 text-xs text-slate-600">
      <p>{company.email}</p>
      <p>{company.phone || "Chưa cập nhật"}</p>
      <p>{company.websiteUrl || "Chưa cập nhật"}</p>
    </div>
  );
}

async function getAdminCompanies(filters: { companyName: string; taxCode: string; industry: string; status: string; sort: string }, page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<CompanyAdminRow>>>("/admin/companies", {
    params: {
      page,
      size: 10,
      companyName: filters.companyName || undefined,
      taxCode: filters.taxCode || undefined,
      industry: filters.industry || undefined,
      status: filters.status || undefined,
      sort: filters.sort,
    },
  });
  return response.data.data;
}

async function getAdminCompany(companyId: number) {
  const response = await httpClient.get<ApiResponse<CompanyAdminRow>>(`/admin/companies/${companyId}`);
  return response.data.data;
}

async function updateAdminCompanyStatus(companyId: number, status: CompanyStatus) {
  const response = await httpClient.patch<ApiResponse<CompanyAdminRow>>(`/admin/companies/${companyId}/status`, { status });
  return response.data.data;
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getStatusTone(status: CompanyStatus) {
  if (status === "VERIFIED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "BLOCKED") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
