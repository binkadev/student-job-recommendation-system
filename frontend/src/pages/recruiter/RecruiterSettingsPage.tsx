import { Bell, CheckCircle2, Send } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type SettingsTab = "account" | "recruitment-process" | "email-templates" | "notifications" | "security";
type CompanyStatus = "PENDING" | "VERIFIED" | "BLOCKED";
type NotificationTab = "all" | "unread";

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

interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface UnreadCountResponse {
  unreadCount: number;
}

interface NotificationSettingsResponse {
  applicationStatusEnabled: boolean;
  jobStatusEnabled: boolean;
  recommendationEnabled: boolean;
  systemEnabled: boolean;
  updatedAt: string | null;
}

const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  PENDING: "Chờ xác thực",
  VERIFIED: "Đã xác thực",
  BLOCKED: "Bị khóa",
};

const notificationPageSize = 10;

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
          {tab === "notifications" ? <NotificationSettings /> : null}
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

function NotificationSettings() {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<NotificationTab>("all");
  const [type, setType] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [settingsReloadKey, setSettingsReloadKey] = useState(0);
  const [settings, setSettings] = useState<NotificationSettingsResponse | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const notificationsQuery = useAsyncData(() => getNotifications(page), [page, reloadKey]);
  const unreadQuery = useAsyncData(() => getUnreadCount(), [reloadKey]);
  const settingsQuery = useAsyncData(() => getNotificationSettings(), [settingsReloadKey]);
  const result = notificationsQuery.data;
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const notifications = useMemo(() => {
    return (result?.items ?? [])
      .filter((notification) => (tab === "unread" ? !notification.isRead : true))
      .filter((notification) => (!type ? true : notification.type === type));
  }, [result?.items, tab, type]);

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  function updateSetting(key: keyof Omit<NotificationSettingsResponse, "updatedAt">, value: boolean) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      await updateNotificationSettings(settings);
      setSettingsReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã lưu cài đặt thông báo" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể lưu cài đặt thông báo", message: getErrorMessage(error) });
    } finally {
      setSavingSettings(false);
    }
  }

  async function markRead(notification: NotificationResponse) {
    if (notification.isRead) return;
    try {
      await markNotificationRead(notification.id);
      setReloadKey((current) => current + 1);
    } catch (error) {
      showToast({ type: "error", title: "Không thể đánh dấu đã đọc", message: getErrorMessage(error) });
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã đánh dấu tất cả đã đọc" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật thông báo", message: getErrorMessage(error) });
    }
  }

  if (notificationsQuery.loading) return <LoadingState />;
  if (notificationsQuery.error) return <EmptyState message={notificationsQuery.error} />;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title="Cấu hình nhận thông báo" />
        {settingsQuery.loading && !settings ? <LoadingState /> : null}
        {settingsQuery.error && !settings ? <EmptyState message={settingsQuery.error} /> : null}
        {settings ? (
          <div className="grid gap-3">
            <Switch label="Trạng thái ứng tuyển" checked={settings.applicationStatusEnabled} onChange={(value) => updateSetting("applicationStatusEnabled", value)} />
            <Switch label="Trạng thái tin tuyển dụng" checked={settings.jobStatusEnabled} onChange={(value) => updateSetting("jobStatusEnabled", value)} />
            <Switch label="Gợi ý ứng viên/việc làm" checked={settings.recommendationEnabled} onChange={(value) => updateSetting("recommendationEnabled", value)} />
            <Switch label="Thông báo hệ thống" checked={settings.systemEnabled} onChange={(value) => updateSetting("systemEnabled", value)} />
            <Button loading={savingSettings} onClick={() => void saveSettings()}>Lưu cấu hình</Button>
          </div>
        ) : null}
      </Card>
      <SectionHeader title="Thông báo" description={`Bạn có ${unreadCount} thông báo chưa đọc từ API backend.`} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          items={[
            { label: "Tất cả", value: "all" },
            { label: `Chưa đọc (${unreadCount})`, value: "unread" },
          ]}
          value={tab}
          onChange={(value) => setTab(value as NotificationTab)}
        />
        <div className="flex flex-wrap gap-2">
          <Select
            label="Loại thông báo"
            value={type}
            onChange={(event) => setType(event.target.value)}
            options={[
              { label: "Tất cả", value: "" },
              ...Array.from(new Set((result?.items ?? []).map((notification) => notification.type))).map((value) => ({ label: value, value })),
            ]}
          />
          <Button variant="secondary" className="self-end" onClick={() => void markAllRead()} disabled={unreadCount === 0}>
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState message="Không có thông báo phù hợp." />
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <RecruiterNotificationItem
              key={notification.id}
              notification={notification}
              onOpen={() => void markRead(notification)}
              onMarkRead={() => void markRead(notification)}
            />
          ))}
        </div>
      )}

      <Pagination page={result?.page ?? page} totalPages={result?.totalPages ?? 1} onPageChange={setPage} />
    </div>
  );
}

function RecruiterNotificationItem({
  notification,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationResponse;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const targetPath = resolveRecruiterNotificationPath(notification);
  return (
    <div className={`rounded-lg border p-4 ${notification.isRead ? "border-slate-100 bg-white" : "border-brand-200 bg-brand-50/40"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Link to={targetPath} onClick={onOpen} className="flex min-w-0 flex-1 gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${notification.isRead ? "bg-slate-100 text-slate-600" : "bg-brand-600 text-white"}`}>
            {notification.referenceType === "APPLICATION" ? <Send size={18} /> : <Bell size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-slate-950">{notification.title}</h2>
              <StatusBadge label={notification.type} />
              <StatusBadge label={notification.isRead ? "Đã đọc" : "Chưa đọc"} tone={notification.isRead ? "neutral" : "warning"} />
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{notification.message}</p>
            <p className="mt-1 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
          </div>
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <Link to={targetPath} onClick={onOpen}><Button variant="secondary" size="sm">Mở</Button></Link>
          <Button variant="secondary" size="sm" icon={<CheckCircle2 size={16} />} onClick={onMarkRead} disabled={notification.isRead}>Đánh dấu đã đọc</Button>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    if (!currentPassword || newPassword.length < 6) {
      showToast({ type: "error", title: "Vui lòng nhập mật khẩu hợp lệ" });
      return;
    }
    setSaving(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      showToast({ type: "success", title: "Đã đổi mật khẩu" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể đổi mật khẩu", message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Input label="Mật khẩu hiện tại" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      <Input label="Mật khẩu mới" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      <Switch label="Bật xác thực hai bước" checked={false} onChange={() => onUnsupported("Xác thực hai bước")} />
      <Button loading={saving} onClick={() => void changePassword()}>Đổi mật khẩu</Button>
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

async function getNotifications(page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<NotificationResponse>>>("/notifications", {
    params: { page, size: notificationPageSize },
  });
  return response.data.data;
}

async function getUnreadCount() {
  const response = await httpClient.get<ApiResponse<UnreadCountResponse>>("/notifications/unread-count");
  return response.data.data;
}

async function markNotificationRead(id: number) {
  await httpClient.patch<ApiResponse<NotificationResponse>>(`/notifications/${id}/read`);
}

async function markAllNotificationsRead() {
  await httpClient.patch<ApiResponse<null>>("/notifications/read-all");
}

async function changeMyPassword(currentPassword: string, newPassword: string) {
  await httpClient.patch<ApiResponse<null>>("/users/me/password", {
    currentPassword,
    newPassword,
  });
}

async function getNotificationSettings() {
  const response = await httpClient.get<ApiResponse<NotificationSettingsResponse>>("/users/me/notification-settings");
  return response.data.data;
}

async function updateNotificationSettings(settings: NotificationSettingsResponse) {
  const response = await httpClient.put<ApiResponse<NotificationSettingsResponse>>("/users/me/notification-settings", {
    applicationStatusEnabled: settings.applicationStatusEnabled,
    jobStatusEnabled: settings.jobStatusEnabled,
    recommendationEnabled: settings.recommendationEnabled,
    systemEnabled: settings.systemEnabled,
  });
  return response.data.data;
}

function resolveRecruiterNotificationPath(notification: NotificationResponse) {
  if (notification.referenceType === "APPLICATION" && notification.referenceId) return `/recruiter/candidates/${notification.referenceId}`;
  if (notification.referenceType === "JOB" && notification.referenceId) return `/recruiter/jobs/${notification.referenceId}`;
  return "/recruiter/settings/notifications";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
