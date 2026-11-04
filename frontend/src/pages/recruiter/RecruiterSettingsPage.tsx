import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Tabs } from "../../components/ui/Tabs";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../services/api/httpClient";
import { NotificationPreferences } from "../../features/account/NotificationPreferences";
import { NotificationsPanel } from "../../features/account/NotificationsPanel";
import { PasswordSettings } from "../../features/account/PasswordSettings";
import { SettingsRecovery } from "../../features/account/SettingsRecovery";
import { useSettingsForm } from "../../features/account/useSettingsForm";

type SettingsTab = "account" | "recruitment-process" | "email-templates" | "notifications" | "security";
const fields = { companyName: "Tên công ty", taxCode: "Mã số thuế", industry: "Lĩnh vực", website: "Website", phone: "Số điện thoại", address: "Địa chỉ", description: "Mô tả công ty" };
type CompanyForm = Record<keyof typeof fields, string> & { email: string; status: "PENDING" | "VERIFIED" | "BLOCKED" };

export function RecruiterSettingsPage({ section = "account" }: { section?: "main" | SettingsTab }) {
  const { currentUser } = useAuth();
  return <SettingsPage key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`} section={section} />;
}
function SettingsPage({ section }: { section: "main" | SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(section === "main" ? "account" : section);
  useEffect(() => { if (section !== "main") setTab(section); }, [section]);
  return <PageContainer>
    <PageHeader title="Cài đặt nhà tuyển dụng" description="Quản lý tài khoản, thông báo và bảo mật." />
    <Card><Tabs value={tab} onChange={value => setTab(value as SettingsTab)} items={[
      { label: "Tài khoản", value: "account" }, { label: "Quy trình tuyển dụng", value: "recruitment-process" },
      { label: "Mẫu email", value: "email-templates" }, { label: "Thông báo", value: "notifications" }, { label: "Bảo mật", value: "security" },
    ]} />
      <div className="mt-5 space-y-5">
        {tab === "account" ? <AccountSettings /> : null}
        {tab === "notifications" ? <><NotificationPreferences /><NotificationsPanel role="recruiter" /></> : null}
        {tab === "security" ? <PasswordSettings /> : null}
        {tab === "recruitment-process" || tab === "email-templates" ? <UnsupportedFeature title={tab === "email-templates" ? "Mẫu email" : "Quy trình tuyển dụng"}
          description="Hệ thống chưa hỗ trợ lưu cấu hình này. Quy trình xử lý đơn ứng tuyển tuân theo các trạng thái cố định; chưa có chức năng tùy chỉnh quy trình hoặc mẫu email."
          to="/recruiter/candidates" action="Xem đơn ứng tuyển" /> : null}
      </div>
    </Card>
  </PageContainer>;
}
async function readCompany(): Promise<CompanyForm> {
  const data = (await httpClient.get<{ data: CompanyForm }>("/companies/me")).data.data;
  return { ...data, ...Object.fromEntries(Object.keys(fields).map(key => [key, data[key as keyof typeof fields] ?? ""])) };
}
function AccountSettings() {
  const form = useSettingsForm(readCompany, draft => httpClient.put("/companies/me",
    Object.fromEntries(Object.keys(fields).map(key => [key, draft[key as keyof typeof fields].trim() || null]))),
  (a, b) => Object.keys(fields).every(key => a[key as keyof typeof fields].trim() === b[key as keyof typeof fields]), "Đã cập nhật tài khoản doanh nghiệp");
  if (form.loading) return <LoadingState />;
  const draft = form.draft;
  const statusLabels = { PENDING: "Chờ xác thực", VERIFIED: "Đã xác thực", BLOCKED: "Bị khóa" };
  return <div className="space-y-4">
    <SettingsRecovery {...form} review={form.review ? Object.fromEntries(Object.entries(fields).map(([key, label]) => [label, form.review![key as keyof typeof fields]])) : null}
      onRead={() => void form.readBack()} onReplace={form.replaceWithReview} />
    {draft ? <>
      <fieldset disabled={form.saving} className="grid gap-4 md:grid-cols-2">
        <legend className="sr-only">Tài khoản doanh nghiệp</legend>
        <Input label="Email đăng nhập" value={draft.email} disabled />
        {(Object.entries(fields) as [keyof typeof fields, string][]).map(([key, label]) => {
          const props = { label, value: draft[key], onChange: (e: { target: { value: string } }) => form.setDraft({ ...draft, [key]: e.target.value }) };
          return key === "description" || key === "address" ? <div key={key} className="md:col-span-2"><Textarea {...props} /></div> : <Input key={key} {...props} />;
        })}
        <div><Button loading={form.saving} disabled={form.blocked || !draft.companyName.trim()} onClick={() => void form.save()}>Lưu tài khoản</Button></div>
      </fieldset>
      <div><StatusBadge label={statusLabels[form.snapshot!.status]} /><p className="mt-2 text-sm text-slate-600">Trạng thái xác thực do quản trị viên quản lý.</p></div>
    </> : null}
  </div>;
}
