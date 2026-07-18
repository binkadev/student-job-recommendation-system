import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";

type CompanyStatus = "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";

interface CompanyAdminRow {
  id: number;
  userId: number;
  email: string;
  companyName: string;
  taxCode: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

const statusLabels: Record<CompanyStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  INACTIVE: "Tạm khóa",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));

export function AdminCompaniesPage({ mode = "list" }: { mode?: "list" | "detail" | "verification" }) {
  const { companyId } = useParams();
  const [filters, setFilters] = useState({
    companyName: "",
    taxCode: "",
    industry: "",
    companySize: "",
    status: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  if (mode === "detail" || mode === "verification") {
    return (
      <PageContainer>
        <PageHeader
          title={mode === "verification" ? "Chi tiết xác thực doanh nghiệp" : "Chi tiết doanh nghiệp"}
          description="Backend chưa có API admin lấy chi tiết công ty theo ID."
        />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <SectionHeader title="Chưa có API detail" />
            <EmptyState message="Hiện backend chưa có GET /api/admin/companies/{id} hoặc GET /api/companies/{id} cho admin. Khi có API, trang này sẽ hiển thị dữ liệu từ bảng companies." />
            <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <Info label="Company ID từ URL" value={companyId ?? "Không có"} />
              <Info label="Bảng DB" value="companies" />
              <Info label="Tổng dữ liệu hiện hiển thị" value="0" />
              <Info label="Thao tác duyệt/khóa" value="Chưa có API" />
            </div>
          </Card>
          <CompanyFieldsCard />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý doanh nghiệp" description="Trang admin companies giữ khung theo bảng companies. Backend hiện chưa có API admin list/approve/reject công ty." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Tên công ty" value={filters.companyName} onChange={(event) => updateFilter("companyName", event.target.value)} placeholder="company_name" disabled />
          <Input label="Mã số thuế" value={filters.taxCode} onChange={(event) => updateFilter("taxCode", event.target.value)} placeholder="tax_code" disabled />
          <Input label="Lĩnh vực" value={filters.industry} onChange={(event) => updateFilter("industry", event.target.value)} placeholder="industry" disabled />
          <Input label="Quy mô" value={filters.companySize} onChange={(event) => updateFilter("companySize", event.target.value)} placeholder="company_size" disabled />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...statusOptions]} disabled />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng công ty: 0</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Backend chỉ có `/api/companies/me` cho role COMPANY, chưa có endpoint admin để lấy danh sách hoặc duyệt công ty.</p>
      </Card>

      <Table
        rows={[] as CompanyAdminRow[]}
        getRowKey={(company) => String(company.id)}
        columns={[
          { key: "company", header: "Công ty", render: (company) => <CompanySummary company={company} /> },
          { key: "legal", header: "Pháp lý", render: (company) => <LegalSummary company={company} /> },
          { key: "contact", header: "Liên hệ", render: (company) => <ContactSummary company={company} /> },
          { key: "status", header: "Trạng thái", render: (company) => <StatusBadge label={statusLabels[company.status]} tone={getStatusTone(company.status)} /> },
        ]}
      />
      <div className="mt-4">
        <EmptyState message="Chưa có API admin list companies nên bảng đang hiển thị 0 dòng, không dùng dữ liệu mock." />
      </div>
    </PageContainer>
  );
}

function CompanyFieldsCard() {
  return (
    <Card>
      <SectionHeader title="Field DB cần hiển thị khi có API" />
      <div className="grid gap-2 text-sm text-slate-700">
        {[
          "id",
          "user_id",
          "company_name",
          "tax_code",
          "website_url",
          "logo_url",
          "industry",
          "company_size",
          "description",
          "address",
          "phone",
          "status",
          "created_at",
          "updated_at",
        ].map((field) => <StatusBadge key={field} label={field} />)}
      </div>
    </Card>
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
      <p>{company.website || "Chưa cập nhật"}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getStatusTone(status: CompanyStatus) {
  if (status === "APPROVED") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "REJECTED" || status === "INACTIVE") return "danger" as const;
  return "neutral" as const;
}
