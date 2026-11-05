import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Tabs } from "../../components/ui/Tabs";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../services/api/httpClient";
import { NotificationPreferences } from "../../features/account/NotificationPreferences";
import { PasswordSettings } from "../../features/account/PasswordSettings";
import { SettingsRecovery } from "../../features/account/SettingsRecovery";
import { useSettingsForm } from "../../features/account/useSettingsForm";

type SettingsTab = "account" | "security" | "privacy" | "notifications";
interface Account { fullName: string; phone: string; email: string; profileEtag: string }

export function CandidateSettingsPage({ section = "account" }: { section?: "main" | SettingsTab }) {
  const { currentUser } = useAuth();
  return <SettingsPage key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`} section={section} />;
}
function SettingsPage({ section }: { section: "main" | SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(section === "main" ? "account" : section);
  useEffect(() => { if (section !== "main") setTab(section); }, [section]);
  return <PageContainer>
    <PageHeader title="Cài đặt ứng viên" description="Quản lý thông tin tài khoản và các tùy chọn hệ thống." />
    <Card>
      <Tabs value={tab} onChange={value => setTab(value as SettingsTab)} items={[
        { label: "Tài khoản", value: "account" }, { label: "Bảo mật", value: "security" },
        { label: "Quyền riêng tư", value: "privacy" }, { label: "Thông báo", value: "notifications" },
      ]} />
      <div className="mt-5">
        {tab === "account" ? <AccountSettings /> : null}
        {tab === "security" ? <PasswordSettings /> : null}
        {tab === "notifications" ? <NotificationPreferences /> : null}
        {tab === "privacy" ? <UnsupportedFeature title="Chưa thể thiết lập quyền riêng tư"
          description="Hệ thống chưa hỗ trợ lưu tùy chọn ẩn email, số điện thoại, CV hoặc khả năng tìm thấy hồ sơ. Không có lựa chọn quyền riêng tư nào được áp dụng từ trang này. Quyền truy cập hồ sơ và CV hiện tuân theo quyền của đơn ứng tuyển."
          to="/candidate/applications" action="Xem đơn ứng tuyển" /> : null}
      </div>
    </Card>
  </PageContainer>;
}
async function readAccount(): Promise<Account> {
  const response = await httpClient.get<{ data: { fullName: string | null; phone: string | null; email: string } }>("/students/me");
  return { ...response.data.data, fullName: response.data.data.fullName ?? "", phone: response.data.data.phone ?? "", profileEtag: response.headers.etag };
}
function AccountSettings() {
  const form = useSettingsForm(readAccount, draft => httpClient.put("/students/me",
    { fullName: draft.fullName.trim(), phone: draft.phone.trim() }, { headers: { "If-Match": draft.profileEtag } }),
  (a, b) => a.fullName.trim() === b.fullName && a.phone.trim() === b.phone, "Đã cập nhật thông tin tài khoản");
  if (form.loading) return <LoadingState />;
  const draft = form.draft;
  return <div className="space-y-4">
    <SettingsRecovery {...form} review={form.review ? { "Họ tên": form.review.fullName, "Số điện thoại": form.review.phone } : null}
      onRead={() => void form.readBack()} onReplace={form.replaceWithReview} />
    {draft ? <fieldset disabled={form.saving} className="grid gap-4 md:grid-cols-2">
      <legend className="sr-only">Thông tin tài khoản</legend>
      <Input label="Họ tên" value={draft.fullName} maxLength={255} required onChange={e => form.setDraft({ ...draft, fullName: e.target.value })} />
      <Input label="Email" value={draft.email} disabled />
      <Input label="Số điện thoại" value={draft.phone} maxLength={50} onChange={e => form.setDraft({ ...draft, phone: e.target.value })} />
      <div className="self-end"><Button loading={form.saving} disabled={form.blocked || !draft.profileEtag || !draft.fullName.trim()} onClick={() => void form.save()}>Cập nhật thông tin</Button></div>
    </fieldset> : null}
    <p className="text-sm text-slate-600">Email đăng nhập và ảnh đại diện chưa hỗ trợ chỉnh sửa tại đây.</p>
  </div>;
}
