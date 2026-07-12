import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
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
import { Timeline } from "../../components/ui/Timeline";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockCompanyService } from "../../services/mock";
import type { Company, EntityStatus } from "../../types/domain";
import { adminTone, entityStatusLabels } from "../../features/admin/adminLabels";

type CompanyAction = "approve" | "reject" | "request" | "lock" | null;

interface CompanyMeta {
  taxCode: string;
  recruiters: number;
  createdAt: string;
  legalName?: string;
  representative?: {
    name: string;
    title: string;
    email: string;
    phone: string;
  };
  license?: {
    number: string;
    issuedAt: string;
    issuedBy: string;
    attachment: string;
  };
  documents?: Array<{
    id: string;
    name: string;
    status: "received" | "missing" | "optional";
    fileName?: string;
  }>;
}

interface HistoryItem {
  id: string;
  companyId: string;
  label: string;
  at: string;
  note: string;
}

interface AuditItem {
  id: string;
  companyId: string;
  admin: string;
  action: string;
  at: string;
  note: string;
}

const companyMeta: Record<string, CompanyMeta> = {
  "company-1": { taxCode: "0109988123", recruiters: 4, createdAt: "2026-01-12" },
  "company-2": { taxCode: "0314455667", recruiters: 3, createdAt: "2026-02-18" },
  "company-3": { taxCode: "0402233445", recruiters: 2, createdAt: "2026-03-05" },
  "company-4": { taxCode: "0105566778", recruiters: 3, createdAt: "2026-03-22" },
  "company-5": {
    taxCode: "1803344556",
    recruiters: 1,
    createdAt: "2026-06-20",
    legalName: "Công ty TNHH Bright Future Việt Nam",
    representative: { name: "Nguyễn Hoàng Minh", title: "Giám đốc điều hành", email: "minh.nguyen@brightfuture.example.vn", phone: "0908 112 245" },
    license: { number: "1803344556-GPKD", issuedAt: "2022-08-16", issuedBy: "Sở Kế hoạch và Đầu tư Cần Thơ", attachment: "giay-phep-kinh-doanh-brightfuture.pdf" },
    documents: [
      { id: "business-license", name: "Giấy phép kinh doanh", status: "received", fileName: "giay-phep-kinh-doanh-brightfuture.pdf" },
      { id: "tax-document", name: "Tài liệu thuế", status: "received", fileName: "xac-nhan-ma-so-thue.pdf" },
      { id: "authorization-letter", name: "Giấy ủy quyền nếu có", status: "optional" },
    ],
  },
  "company-6": { taxCode: "0319988776", recruiters: 5, createdAt: "2026-04-14" },
  "company-7": { taxCode: "0001122334", recruiters: 2, createdAt: "2026-05-09" },
  "company-8": {
    taxCode: "0206677889",
    recruiters: 2,
    createdAt: "2026-06-28",
    legalName: "Công ty Cổ phần TalentBridge",
    representative: { name: "Trần Minh Quân", title: "Trưởng phòng nhân sự", email: "quan.tran@talentbridge.example.vn", phone: "0912 445 880" },
    license: { number: "0206677889-DKKD", issuedAt: "2023-03-11", issuedBy: "Sở Kế hoạch và Đầu tư Hải Phòng", attachment: "dang-ky-kinh-doanh-talentbridge.pdf" },
    documents: [
      { id: "business-license", name: "Giấy phép kinh doanh", status: "received", fileName: "dang-ky-kinh-doanh-talentbridge.pdf" },
      { id: "tax-document", name: "Tài liệu thuế", status: "missing" },
      { id: "authorization-letter", name: "Giấy ủy quyền nếu có", status: "optional" },
    ],
  },
};

const statusFilterOptions = [
  { label: "Đang hoạt động", value: "approved" },
  { label: "Tạm khóa", value: "inactive" },
  { label: "Chờ duyệt", value: "pending" },
  { label: "Từ chối", value: "rejected" },
];

export function AdminCompaniesPage({ mode = "list" }: { mode?: "list" | "detail" | "verification" }) {
  const { companyId } = useParams();
  const { showToast } = useToast();
  const companiesQuery = useAsyncData(() => mockCompanyService.getCompanies({ pageSize: 100 }), []);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState("");
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<Company | null>(null);
  const [actionType, setActionType] = useState<CompanyAction>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionTemplate, setActionTemplate] = useState("");
  const [supplementDocs, setSupplementDocs] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  useEffect(() => {
    if (companiesQuery.data?.items) {
      setCompanies(companiesQuery.data.items);
    }
  }, [companiesQuery.data?.items]);

  const selectedCompany = companies.find((company) => company.id === companyId) ?? companies[0];
  const industries = useMemo(() => unique(companies.map((company) => company.industry)), [companies]);
  const locations = useMemo(() => unique(companies.map((company) => getDisplayLocation(company))), [companies]);
  const sizes = useMemo(() => unique(companies.map((company) => company.size)), [companies]);
  const filteredCompanies = useMemo(() => companies.filter((company) => {
    const meta = getCompanyMeta(company);
    const matchQuery = !query || `${company.name} ${company.industry} ${company.location} ${meta.taxCode}`.toLowerCase().includes(query.toLowerCase());
    const matchStatus = !status || company.status === status;
    const matchIndustry = !industry || company.industry === industry;
    const matchLocation = !location || getDisplayLocation(company) === location;
    const matchSize = !size || company.size === size;
    return matchQuery && matchStatus && matchIndustry && matchLocation && matchSize;
  }), [companies, industry, location, query, size, status]);
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / 8));
  const pagedCompanies = filteredCompanies.slice((page - 1) * 8, page * 8);

  async function updateCompany(id: string, payload: Partial<Company>, message: string, note = "") {
    setCompanies((current) => current.map((company) => company.id === id ? { ...company, ...payload } : company));
    await mockCompanyService.updateCompany(id, payload);
    addHistory(id, message, note);
    addAudit(id, message, note);
    showToast({ type: "success", title: message });
  }

  function addHistory(id: string, label: string, note: string) {
    setHistory((current) => [{ id: `history-${Date.now()}`, companyId: id, label, note, at: new Date().toISOString() }, ...current]);
  }

  function addAudit(id: string, action: string, note: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}`, companyId: id, admin: "Admin hệ thống", action, note, at: new Date().toISOString() }, ...current]);
  }

  function openAction(company: Company, action: CompanyAction) {
    setActionTarget(company);
    setActionType(action);
    setActionReason("");
    setActionTemplate("");
    setSupplementDocs([]);
  }

  async function approveCompany(company: Company) {
    await updateCompany(company.id, { status: "approved", verified: true }, "Đã duyệt doanh nghiệp", "Admin duyệt xác thực doanh nghiệp.");
  }

  async function unlockCompany(company: Company) {
    await updateCompany(company.id, { status: company.verified ? "approved" : "pending" }, "Đã mở khóa doanh nghiệp", "Admin mở khóa tài khoản doanh nghiệp.");
  }

  async function confirmAction() {
    if (!actionTarget || !actionType) return;
    if (actionType === "reject" && !actionTemplate) {
      showToast({ type: "error", title: "Vui lòng chọn lý do từ chối" });
      return;
    }
    if (actionType === "request" && supplementDocs.length === 0) {
      showToast({ type: "error", title: "Vui lòng chọn tài liệu cần bổ sung" });
      return;
    }
    if ((actionType === "reject" || actionType === "request" || actionType === "lock") && !actionReason.trim()) {
      const title = actionType === "reject" ? "Vui lòng nhập lý do từ chối chi tiết" : actionType === "request" ? "Vui lòng nhập thông điệp bổ sung" : "Vui lòng nhập lý do khóa";
      showToast({ type: "error", title });
      return;
    }
    if (actionType === "approve") await updateCompany(actionTarget.id, { status: "approved", verified: true }, "Đã duyệt xác thực doanh nghiệp", actionReason || "Admin duyệt hồ sơ xác thực.");
    if (actionType === "reject") await updateCompany(actionTarget.id, { status: "rejected", verified: false }, "Đã từ chối doanh nghiệp", `${actionTemplate}: ${actionReason}`);
    if (actionType === "request") await updateCompany(actionTarget.id, { status: "pending" }, "Đã yêu cầu bổ sung thông tin", `Tài liệu cần bổ sung: ${supplementDocs.join(", ")}. ${actionReason}`);
    if (actionType === "lock") await updateCompany(actionTarget.id, { status: "inactive" as EntityStatus }, "Đã khóa doanh nghiệp", `Thông báo gửi doanh nghiệp: ${actionReason}`);
    setActionTarget(null);
    setActionType(null);
    setActionReason("");
    setActionTemplate("");
    setSupplementDocs([]);
  }

  if (companiesQuery.loading) return <PageContainer><LoadingState /></PageContainer>;

  if (mode === "verification" && selectedCompany) {
    const meta = getVerificationMeta(selectedCompany);
    const companyHistory = getCompanyHistory(selectedCompany, history);
    const companyAuditLogs = getCompanyAuditLogs(selectedCompany, auditLogs);
    return (
      <PageContainer>
        <PageHeader title="Chi tiết xác thực doanh nghiệp" description="Kiểm tra hồ sơ pháp lý, tài liệu đính kèm, lịch sử duyệt và thao tác xác thực doanh nghiệp." />
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">Thông tin doanh nghiệp</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedCompany.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedCompany.description}</p>
                </div>
                <CompanyStatusSummary company={selectedCompany} />
              </div>
              <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <InfoRow label="Tên thương mại" value={selectedCompany.name} />
                <InfoRow label="Tên pháp lý" value={meta.legalName} />
                <InfoRow label="Mã số thuế" value={meta.taxCode} />
                <InfoRow label="Lĩnh vực" value={selectedCompany.industry} />
                <InfoRow label="Quy mô" value={selectedCompany.size} />
                <InfoRow label="Website" value={selectedCompany.website} />
                <InfoRow className="md:col-span-2" label="Địa chỉ" value={getDisplayLocation(selectedCompany)} />
              </div>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <h3 className="text-base font-semibold text-slate-950">Người đại diện</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <InfoRow label="Họ tên" value={meta.representative.name} />
                  <InfoRow label="Chức vụ" value={meta.representative.title} />
                  <InfoRow label="Email" value={meta.representative.email} />
                  <InfoRow label="Số điện thoại" value={meta.representative.phone} />
                </div>
              </Card>

              <Card>
                <h3 className="text-base font-semibold text-slate-950">Giấy phép</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <InfoRow label="Số giấy phép" value={meta.license.number} />
                  <InfoRow label="Ngày cấp" value={formatDate(meta.license.issuedAt)} />
                  <InfoRow label="Nơi cấp" value={meta.license.issuedBy} />
                  <InfoRow label="File đính kèm" value={meta.license.attachment} />
                </div>
              </Card>
            </div>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Tài liệu</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {meta.documents.map((document) => (
                  <div key={document.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{document.name}</p>
                      <DocumentStatusBadge status={document.status} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{document.fileName ?? "Chưa có file đính kèm"}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <h3 className="text-base font-semibold text-slate-950">Actions</h3>
              <div className="mt-4 grid gap-2">
                {canApproveCompany(selectedCompany) && <Button className="w-full" onClick={() => openAction(selectedCompany, "approve")}>Duyệt</Button>}
                {selectedCompany.status === "pending" && <Button className="w-full" variant="danger" onClick={() => openAction(selectedCompany, "reject")}>Từ chối</Button>}
                <Button className="w-full" variant="secondary" onClick={() => openAction(selectedCompany, "request")}>Yêu cầu bổ sung</Button>
                {selectedCompany.status === "inactive" ? <Button className="w-full" variant="secondary" onClick={() => void unlockCompany(selectedCompany)}>Mở khóa công ty</Button> : <Button className="w-full" variant="secondary" onClick={() => openAction(selectedCompany, "lock")}>Khóa công ty</Button>}
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Lịch sử duyệt</h3>
              <div className="mt-4">
                <Timeline items={companyHistory.map((item) => ({ label: `${item.admin} - ${item.action}`, at: item.at, note: item.note }))} />
              </div>
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-slate-950">Audit log</h3>
              <div className="mt-4 space-y-3">
                {companyAuditLogs.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{item.action}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.admin}</p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDateTime(item.at)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{item.note}</p>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
        <CompanyActionModal actionType={actionType} target={actionTarget} reason={actionReason} template={actionTemplate} supplementDocs={supplementDocs} documents={meta.documents} setReason={setActionReason} setTemplate={setActionTemplate} setSupplementDocs={setSupplementDocs} onClose={() => setActionTarget(null)} onConfirm={() => void confirmAction()} />
      </PageContainer>
    );
  }

  if (mode === "detail" && selectedCompany) {
    const meta = getCompanyMeta(selectedCompany);
    const companyHistory = history.filter((item) => item.companyId === selectedCompany.id);
    return (
      <PageContainer>
        <PageHeader title="Chi tiết doanh nghiệp" description="Thông tin pháp lý, trạng thái xác thực, lịch sử kiểm duyệt và thao tác quản trị doanh nghiệp." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{selectedCompany.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{selectedCompany.description}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <p><strong>Mã số thuế:</strong> {meta.taxCode}</p>
              <p><strong>Lĩnh vực:</strong> {selectedCompany.industry}</p>
              <p><strong>Quy mô:</strong> {selectedCompany.size}</p>
              <p><strong>Địa điểm:</strong> {getDisplayLocation(selectedCompany)}</p>
              <p><strong>Số recruiter:</strong> {meta.recruiters}</p>
              <p><strong>Tin đang hoạt động:</strong> {selectedCompany.openJobs}</p>
              <p><strong>Website:</strong> {selectedCompany.website}</p>
              <p><strong>Ngày tạo:</strong> {formatDate(meta.createdAt)}</p>
              <p className="md:col-span-2"><strong>Địa chỉ:</strong> {getDisplayLocation(selectedCompany)}</p>
            </div>
          </Card>
          <aside className="space-y-4">
            <Card>
              <div className="flex flex-wrap gap-2">
                {selectedCompany.status !== "approved" && <StatusBadge label={entityStatusLabels[selectedCompany.status]} tone={adminTone(selectedCompany.status)} />}
                <StatusBadge label={selectedCompany.verified ? "Đã xác thực" : "Chưa xác thực"} tone={selectedCompany.verified ? "success" : "warning"} />
              </div>
              <div className="mt-4">
                <Timeline items={(companyHistory.length ? companyHistory : [
                  { label: "Gửi xác thực", at: meta.createdAt, note: "Doanh nghiệp gửi hồ sơ." },
                  { label: "Đang kiểm tra", at: "2026-07-09", note: "Quản trị viên mở hồ sơ." },
                ]).map((item) => ({ label: item.label, at: item.at, note: item.note }))} />
              </div>
            </Card>
            <div className="flex flex-wrap gap-2">
              {canApproveCompany(selectedCompany) && <Button onClick={() => void approveCompany(selectedCompany)}>Duyệt</Button>}
              {selectedCompany.status === "pending" && <Button variant="danger" onClick={() => openAction(selectedCompany, "reject")}>Từ chối</Button>}
              <Button variant="secondary" onClick={() => openAction(selectedCompany, "request")}>Yêu cầu bổ sung</Button>
              {selectedCompany.status === "inactive" ? <Button variant="secondary" onClick={() => void unlockCompany(selectedCompany)}>Mở khóa</Button> : <Button variant="secondary" onClick={() => openAction(selectedCompany, "lock")}>Khóa</Button>}
            </div>
          </aside>
        </div>
        <CompanyActionModal actionType={actionType} target={actionTarget} reason={actionReason} setReason={setActionReason} onClose={() => setActionTarget(null)} onConfirm={() => void confirmAction()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý doanh nghiệp" description="Danh sách doanh nghiệp, trạng thái xác thực, thông tin pháp lý và thao tác kiểm duyệt." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Input label="Search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tên, MST, lĩnh vực..." />
          <Select label="Trạng thái xác thực" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...statusFilterOptions]} />
          <Select label="Lĩnh vực" value={industry} onChange={(event) => setIndustry(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...industries.map((value) => ({ label: value, value }))]} />
          <Select label="Địa điểm" value={location} onChange={(event) => setLocation(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...locations.map((value) => ({ label: value, value }))]} />
          <Select label="Quy mô" value={size} onChange={(event) => setSize(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...sizes.map((value) => ({ label: value, value }))]} />
        </div>
      </Card>

      <Table
        rows={pagedCompanies}
        getRowKey={(company) => company.id}
        columns={[
          { key: "company", header: "Công ty", render: (company) => <CompanySummary company={company} /> },
          { key: "legal", header: "Pháp lý & quy mô", render: (company) => <LegalSummary company={company} /> },
          { key: "hiring", header: "Tuyển dụng", render: (company) => <HiringSummary company={company} /> },
          { key: "status", header: "Trạng thái", render: (company) => <CompanyStatusSummary company={company} /> },
          { key: "actions", header: "Thao tác", render: (company) => <CompanyActions company={company} onApprove={approveCompany} onReject={(item) => openAction(item, "reject")} onRequest={(item) => openAction(item, "request")} onLock={(item) => openAction(item, "lock")} onUnlock={unlockCompany} /> },
        ]}
      />
      <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
      <CompanyActionModal actionType={actionType} target={actionTarget} reason={actionReason} setReason={setActionReason} onClose={() => setActionTarget(null)} onConfirm={() => void confirmAction()} />
    </PageContainer>
  );
}

function CompanySummary({ company }: { company: Company }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{company.name}</p>
      <p className="mt-1 text-xs text-slate-500">{company.industry}</p>
      <p className="mt-1 text-xs text-slate-500">{getDisplayLocation(company)}</p>
      <p className="mt-1 text-xs text-slate-500">{company.website}</p>
    </div>
  );
}

function LegalSummary({ company }: { company: Company }) {
  const meta = getCompanyMeta(company);
  return (
    <div className="min-w-[160px] space-y-1 text-xs text-slate-600">
      <p><span className="text-slate-500">MST:</span> {meta.taxCode}</p>
      <p><span className="text-slate-500">Quy mô:</span> {company.size}</p>
      <p><span className="text-slate-500">Ngày tạo:</span> {formatDate(meta.createdAt)}</p>
    </div>
  );
}

function HiringSummary({ company }: { company: Company }) {
  const meta = getCompanyMeta(company);
  return (
    <div className="min-w-[120px] space-y-1 text-sm text-slate-700">
      <p><strong>{meta.recruiters}</strong> recruiter</p>
      <p><strong>{company.openJobs}</strong> tin hoạt động</p>
    </div>
  );
}

function CompanyStatusSummary({ company }: { company: Company }) {
  return (
    <div className="flex min-w-[150px] flex-wrap gap-2">
      {company.status !== "approved" && <StatusBadge label={entityStatusLabels[company.status]} tone={adminTone(company.status)} />}
      <StatusBadge label={company.verified ? "Đã xác thực" : "Chưa xác thực"} tone={company.verified ? "success" : "warning"} />
    </div>
  );
}

function CompanyActions({ company, onApprove, onReject, onLock, onUnlock }: { company: Company; onApprove: (company: Company) => Promise<void>; onReject: (company: Company) => void; onRequest: (company: Company) => void; onLock: (company: Company) => void; onUnlock: (company: Company) => Promise<void> }) {
  return (
    <div className="grid w-[104px] gap-2">
      <Link to={`/admin/companies/${company.id}`} className="block"><Button variant="secondary" size="sm" className="w-full">Chi tiết</Button></Link>
      {canApproveCompany(company) && <Button size="sm" className="w-full" onClick={() => void onApprove(company)}>Duyệt</Button>}
      {company.status === "pending" && <Button size="sm" variant="danger" className="w-full" onClick={() => onReject(company)}>Từ chối</Button>}
      {company.status === "inactive" ? <Button size="sm" variant="secondary" className="w-full" onClick={() => void onUnlock(company)}>Mở</Button> : <Button size="sm" variant="secondary" className="w-full" onClick={() => onLock(company)}>Khóa</Button>}
    </div>
  );
}

function CompanyActionModal({
  actionType,
  target,
  reason,
  template = "",
  supplementDocs = [],
  documents = [],
  setReason,
  setTemplate,
  setSupplementDocs,
  onClose,
  onConfirm,
}: {
  actionType: CompanyAction;
  target: Company | null;
  reason: string;
  template?: string;
  supplementDocs?: string[];
  documents?: CompanyMeta["documents"];
  setReason: (value: string) => void;
  setTemplate?: (value: string) => void;
  setSupplementDocs?: (value: string[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isApprove = actionType === "approve";
  const isLock = actionType === "lock";
  const title = isApprove ? "Duyệt xác thực doanh nghiệp" : actionType === "reject" ? "Từ chối doanh nghiệp" : actionType === "request" ? "Yêu cầu bổ sung" : "Khóa doanh nghiệp";
  const rejectTemplates = [
    { label: "Tất cả", value: "" },
    { label: "Giấy phép không hợp lệ", value: "Giấy phép không hợp lệ" },
    { label: "Thông tin doanh nghiệp không khớp", value: "Thông tin doanh nghiệp không khớp" },
    { label: "Không xác minh được người đại diện", value: "Không xác minh được người đại diện" },
  ];
  function toggleSupplementDoc(documentName: string) {
    if (!setSupplementDocs) return;
    setSupplementDocs(supplementDocs.includes(documentName) ? supplementDocs.filter((item) => item !== documentName) : [...supplementDocs, documentName]);
  }
  return (
    <Modal open={Boolean(target && actionType)} title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700"><strong>{target?.name}</strong></p>
        {isApprove && <Textarea label="Ghi chú tùy chọn" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập ghi chú duyệt nếu cần..." />}
        {actionType === "reject" && (
          <>
            <Select label="Reason template" value={template} onChange={(event) => setTemplate?.(event.target.value)} options={rejectTemplates} />
            <Textarea label="Lý do chi tiết" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập lý do từ chối để gửi cho doanh nghiệp..." />
          </>
        )}
        {actionType === "request" && (
          <>
            <div>
              <p className="text-sm font-medium text-slate-700">Tài liệu cần bổ sung</p>
              <div className="mt-2 grid gap-2">
                {documents.map((document) => (
                  <Checkbox key={document.id} label={document.name} checked={supplementDocs.includes(document.name)} onChange={() => toggleSupplementDoc(document.name)} />
                ))}
              </div>
            </div>
            <Textarea label="Thông điệp" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Nhập nội dung cần bổ sung để gửi cho doanh nghiệp..." />
          </>
        )}
        {isLock && (
          <>
            <p className="text-sm text-slate-700">Nhập lý do khóa để hệ thống ghi nhận và gửi thông báo cho doanh nghiệp.</p>
            <Textarea label="Lý do khóa / thông báo cho doanh nghiệp" value={reason} onChange={(event) => setReason(event.target.value)} />
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant={actionType === "reject" || isLock ? "danger" : "primary"} onClick={onConfirm}>{isApprove ? "Duyệt" : isLock ? "Xác nhận khóa" : "Xác nhận"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function getCompanyMeta(company: Company) {
  return companyMeta[company.id] ?? { taxCode: "0000000000", recruiters: 1, createdAt: "2026-07-01" };
}

function getVerificationMeta(company: Company): Required<Pick<CompanyMeta, "taxCode" | "recruiters" | "createdAt" | "legalName" | "representative" | "license" | "documents">> {
  const meta = getCompanyMeta(company);
  return {
    taxCode: meta.taxCode,
    recruiters: meta.recruiters,
    createdAt: meta.createdAt,
    legalName: meta.legalName ?? company.name,
    representative: meta.representative ?? {
      name: "Lê Minh Anh",
      title: "Đại diện pháp luật",
      email: `legal@${company.website.replace(/^https?:\/\//, "")}`,
      phone: "0901 234 567",
    },
    license: meta.license ?? {
      number: `${meta.taxCode}-GPKD`,
      issuedAt: meta.createdAt,
      issuedBy: `Sở Kế hoạch và Đầu tư ${company.location === "Remote" ? "Hà Nội" : company.location}`,
      attachment: "giay-phep-kinh-doanh.pdf",
    },
    documents: meta.documents ?? [
      { id: "business-license", name: "Giấy phép kinh doanh", status: "received", fileName: "giay-phep-kinh-doanh.pdf" },
      { id: "tax-document", name: "Tài liệu thuế", status: "received", fileName: "tai-lieu-thue.pdf" },
      { id: "authorization-letter", name: "Giấy ủy quyền nếu có", status: "optional" },
    ],
  };
}

function getCompanyHistory(company: Company, history: HistoryItem[]) {
  const currentHistory = history.filter((item) => item.companyId === company.id);
  if (currentHistory.length) {
    return currentHistory.map((item) => ({ admin: "Admin hệ thống", action: item.label, at: item.at, note: item.note }));
  }
  const meta = getCompanyMeta(company);
  return [
    { admin: "Hệ thống", action: "Tiếp nhận hồ sơ", at: meta.createdAt, note: "Doanh nghiệp gửi hồ sơ xác thực." },
    { admin: "Admin hệ thống", action: "Kiểm tra hồ sơ", at: "2026-07-09T09:30:00", note: "Đối chiếu thông tin pháp lý và tài liệu đính kèm." },
  ];
}

function getCompanyAuditLogs(company: Company, auditLogs: AuditItem[]) {
  const currentLogs = auditLogs.filter((item) => item.companyId === company.id);
  if (currentLogs.length) return currentLogs;
  const meta = getCompanyMeta(company);
  return [
    { id: `${company.id}-audit-1`, companyId: company.id, admin: "Hệ thống", action: "Tạo yêu cầu xác thực", at: meta.createdAt, note: "Hồ sơ xác thực được tạo từ cổng nhà tuyển dụng." },
    { id: `${company.id}-audit-2`, companyId: company.id, admin: "Admin hệ thống", action: "Mở chi tiết xác thực", at: "2026-07-09T09:30:00", note: "Admin bắt đầu rà soát hồ sơ doanh nghiệp." },
  ];
}

function InfoRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <p className={`text-slate-700 ${className}`}>
      <span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span>
    </p>
  );
}

function DocumentStatusBadge({ status }: { status: "received" | "missing" | "optional" }) {
  const labels = { received: "Đã nhận", missing: "Thiếu", optional: "Nếu có" };
  const tones = { received: "success", missing: "danger", optional: "neutral" } as const;
  return <StatusBadge label={labels[status]} tone={tones[status]} />;
}

function canApproveCompany(company: Company) {
  return company.status !== "approved" || !company.verified;
}

function getDisplayLocation(company: Company) {
  if (company.location.toLowerCase() !== "remote") return company.location;
  if (company.address && company.address.toLowerCase() !== "làm việc từ xa") return company.address;
  return "Tầng 6, tòa nhà Cloud Hub, Hà Nội";
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
