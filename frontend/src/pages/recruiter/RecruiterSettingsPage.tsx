import { useEffect, useState, type ReactNode } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type SettingsTab = "account" | "recruitment-process" | "email-templates" | "notifications" | "security";
type CompanyStatus = "PENDING" | "VERIFIED" | "BLOCKED";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface CompanyResponse {
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
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

interface CompanySettingsForm {
  companyName: string;
  taxCode: string;
  description: string;
  website: string;
  address: string;
  phone: string;
  industry: string;
}

const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  PENDING: "Chờ xác thực",
  VERIFIED: "Đã xác thực",
  BLOCKED: "Bị khóa",
};

export function RecruiterSettingsPage({ section = "account" }: { section?: "main" | SettingsTab }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<SettingsTab>(section === "main" ? "account" : section);
  const [reloadKey, setReloadKey] = useState(0);
  const companyQuery = useAsyncData(() => getMyCompany(), [reloadKey]);

  useEffect(() => {
    if (section !== "main") setTab(section);
  }, [section]);

  function notifyUnsupported(feature: string) {
    showToast({
      type: "info",
      title: "Chức năng chưa có API backend",
      message: `${feature} hiện chưa có endpoint để lưu dữ liệu thật.`,
    });
  }

  async function saveCompany(form: CompanySettingsForm) {
    try {
      await updateMyCompany(form);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật tài khoản doanh nghiệp" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật tài khoản", message: getErrorMessage(error) });
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Cài đặt nhà tuyển dụng" description="Quản lý thông tin doanh nghiệp theo API hiện có. Các cấu hình chưa có endpoint sẽ không lưu giả." />
      <Card>
        <Tabs
          value={tab}
          onChange={(value) => setTab(value as SettingsTab)}
          items={[
            { label: "Tài khoản", value: "account" },
            { label: "Quy trình tuyển dụng", value: "recruitment-process" },
            { label: "Mẫu email", value: "email-templates" },
            { label: "Thông báo", value: "notifications" },
            { label: "Bảo mật", value: "security" },
          ]}
        />
        <div className="mt-5 space-y-5">
          {tab === "account" ? (
            <>
              {companyQuery.loading ? <LoadingState /> : null}
              {!companyQuery.loading && companyQuery.error ? <EmptyState message={companyQuery.error} /> : null}
              {!companyQuery.loading && companyQuery.data ? <AccountSettings company={companyQuery.data} onSave={saveCompany} /> : null}
            </>
          ) : null}
          {tab === "recruitment-process" ? <UnsupportedSettingsPanel title="Quy trình tuyển dụng" onUnsupported={notifyUnsupported} /> : null}
          {tab === "email-templates" ? <UnsupportedSettingsPanel title="Mẫu email" onUnsupported={notifyUnsupported} /> : null}
          {tab === "notifications" ? <NotificationSettings onUnsupported={notifyUnsupported} /> : null}
          {tab === "security" ? <SecuritySettings onUnsupported={notifyUnsupported} /> : null}
        </div>
      </Card>
      <div className="mt-5 max-w-xl">
        <DangerZone onUnsupported={notifyUnsupported} />
      </div>
    </PageContainer>
  );
}

function AccountSettings({ company, onSave }: { company: CompanyResponse; onSave: (form: CompanySettingsForm) => Promise<void> }) {
  const [form, setForm] = useState(() => mapCompanyToForm(company));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(mapCompanyToForm(company)), [company]);

  function update<K extends keyof CompanySettingsForm>(key: K, value: CompanySettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.companyName.trim()) nextErrors.companyName = "Vui lòng nhập tên công ty.";
    if (form.phone.length > 50) nextErrors.phone = "Số điện thoại tối đa 50 ký tự.";
    if (form.website.length > 500) nextErrors.website = "Website tối đa 500 ký tự.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên công ty" value={form.companyName} error={errors.companyName} onChange={(event) => update("companyName", event.target.value)} />
        <Input label="Email đăng nhập" value={company.email} disabled />
        <Input label="Mã số thuế" value={form.taxCode} onChange={(event) => update("taxCode", event.target.value)} />
        <Input label="Lĩnh vực" value={form.industry} onChange={(event) => update("industry", event.target.value)} />
        <Input label="Website" value={form.website} error={errors.website} onChange={(event) => update("website", event.target.value)} />
        <Input label="Số điện thoại" value={form.phone} error={errors.phone} onChange={(event) => update("phone", event.target.value)} />
        <div className="md:col-span-2">
          <Textarea label="Địa chỉ" value={form.address} onChange={(event) => update("address", event.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Textarea label="Mô tả công ty" value={form.description} onChange={(event) => update("description", event.target.value)} />
        </div>
        <div>
          <Button loading={saving} onClick={save}>Lưu tài khoản</Button>
        </div>
      </div>
      <Card>
        <SectionHeader title="Trạng thái doanh nghiệp" />
        <StatusBadge label={COMPANY_STATUS_LABELS[company.status]} tone={company.status === "VERIFIED" ? "success" : company.status === "BLOCKED" ? "danger" : "warning"} />
        <p className="mt-3 text-sm leading-6 text-slate-600">Trạng thái xác thực do backend/quản trị viên quản lý. Frontend không tự thay đổi trường này.</p>
      </Card>
    </div>
  );
}

function UnsupportedSettingsPanel({ title, onUnsupported }: { title: string; onUnsupported: (feature: string) => void }) {
  return (
    <div className="space-y-4">
      <EmptyState message={`${title} chưa có API backend để lưu cấu hình.`} />
      <Textarea label={title} value="" disabled placeholder="Chưa có endpoint backend" />
      <Button variant="secondary" onClick={() => onUnsupported(title)}>Lưu cấu hình</Button>
    </div>
  );
}

function NotificationSettings({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  return (
    <div className="space-y-4">
      <EmptyState message="Backend hiện có API danh sách thông báo, chưa có API lưu tùy chọn nhận thông báo cho nhà tuyển dụng." />
      <Switch label="Thông báo qua email" checked={false} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Thông báo ứng viên mới" checked={false} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Thông báo thay đổi trạng thái tin" checked={false} onChange={() => onUnsupported("Cài đặt thông báo")} />
    </div>
  );
}

function SecuritySettings({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  return (
    <div className="space-y-4">
      <EmptyState message="Backend hiện chưa có API đổi mật khẩu, 2FA hoặc đăng xuất khỏi tất cả thiết bị." />
      <Input label="Mật khẩu hiện tại" type="password" disabled />
      <Input label="Mật khẩu mới" type="password" disabled />
      <Switch label="Bật xác thực hai bước" checked={false} onChange={() => onUnsupported("Xác thực hai bước")} />
      <Button onClick={() => onUnsupported("Đổi mật khẩu")}>Đổi mật khẩu</Button>
    </div>
  );
}

function DangerZone({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  return (
    <Card>
      <SectionHeader title="Khu vực nguy hiểm" description="Backend hiện chưa có API khóa/xóa tài khoản doanh nghiệp từ frontend." />
      <Button variant="danger" onClick={() => onUnsupported("Khóa tài khoản doanh nghiệp")}>Khóa tài khoản</Button>
    </Card>
  );
}

async function getMyCompany() {
  const response = await httpClient.get<ApiResponse<CompanyResponse>>("/companies/me");
  return response.data.data;
}

async function updateMyCompany(form: CompanySettingsForm) {
  const response = await httpClient.put<ApiResponse<CompanyResponse>>("/companies/me", {
    companyName: emptyToNull(form.companyName),
    taxCode: emptyToNull(form.taxCode),
    description: emptyToNull(form.description),
    website: emptyToNull(form.website),
    address: emptyToNull(form.address),
    phone: emptyToNull(form.phone),
    industry: emptyToNull(form.industry),
  });
  return response.data.data;
}

function mapCompanyToForm(company: CompanyResponse): CompanySettingsForm {
  return {
    companyName: company.companyName || "",
    taxCode: company.taxCode || "",
    description: company.description || "",
    website: company.website || "",
    address: company.address || "",
    phone: company.phone || "",
    industry: company.industry || "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
