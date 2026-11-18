import { ArrowLeft, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { LoadingState } from "../../components/feedback/LoadingState";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Tabs } from "../../components/ui/Tabs";
import { NotificationPreferences } from "../../features/account/NotificationPreferences";
import { PasswordSettings } from "../../features/account/PasswordSettings";
import { SettingsRecovery } from "../../features/account/SettingsRecovery";
import { useSettingsForm } from "../../features/account/useSettingsForm";
import { useAuth } from "../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../services/api/httpClient";

type SettingsTab = "account" | "security" | "privacy" | "notifications";
interface Account {
  fullName: string;
  phone: string;
  email: string;
  profileEtag: string;
}

export function CandidateSettingsPage({ section = "account" }: { section?: "main" | SettingsTab }) {
  const { currentUser } = useAuth();
  return (
    <SettingsPage
      key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`}
      section={section}
    />
  );
}

function SettingsPage({ section }: { section: "main" | SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(section === "main" ? "account" : section);
  useEffect(() => {
    if (section !== "main") setTab(section);
  }, [section]);

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* NOVA MOTION Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0C111C] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5 text-teal-300" />
                <span>CÀI ĐẶT ỨNG VIÊN</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Cài đặt tài khoản & hệ thống
              </h1>
              <p className="text-sm leading-relaxed text-slate-300">
                Quản lý thông tin tài khoản cá nhân, mật khẩu bảo mật và tùy chọn nhận thông báo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/candidate/profile">
                <Button
                  variant="secondary"
                  className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20"
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  Quay lại hồ sơ
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Settings Card with Tabs */}
        <Card className="border border-slate-200/80 bg-white p-6 shadow-sm rounded-2xl">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as SettingsTab)}
            items={[
              { label: "Tài khoản", value: "account" },
              { label: "Bảo mật", value: "security" },
              { label: "Quyền riêng tư", value: "privacy" },
              { label: "Thông báo", value: "notifications" },
            ]}
          />
          <div className="mt-6 border-t border-slate-100 pt-5">
            {tab === "account" ? <AccountSettings /> : null}
            {tab === "security" ? <PasswordSettings /> : null}
            {tab === "notifications" ? <NotificationPreferences /> : null}
            {tab === "privacy" ? (
              <UnsupportedFeature
                title="Chưa thể thiết lập quyền riêng tư"
                description="Hệ thống chưa hỗ trợ lưu tùy chọn ẩn email, số điện thoại, CV hoặc khả năng tìm thấy hồ sơ. Không có lựa chọn quyền riêng tư nào được áp dụng từ trang này. Quyền truy cập hồ sơ và CV hiện tuân theo quyền của đơn ứng tuyển."
                to="/candidate/applications"
                action="Xem đơn ứng tuyển"
              />
            ) : null}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

async function readAccount(): Promise<Account> {
  const response = await httpClient.get<{ data: { fullName: string | null; phone: string | null; email: string } }>(
    "/students/me",
  );
  return {
    ...response.data.data,
    fullName: response.data.data.fullName ?? "",
    phone: response.data.data.phone ?? "",
    profileEtag: response.headers.etag,
  };
}

function AccountSettings() {
  const form = useSettingsForm(
    readAccount,
    (draft) =>
      httpClient.put(
        "/students/me",
        { fullName: draft.fullName.trim(), phone: draft.phone.trim() },
        { headers: { "If-Match": draft.profileEtag } },
      ),
    (a, b) => a.fullName.trim() === b.fullName && a.phone.trim() === b.phone,
    "Đã cập nhật thông tin tài khoản",
  );

  if (form.loading) return <LoadingState />;
  const draft = form.draft;

  return (
    <div className="space-y-4">
      <SettingsRecovery
        {...form}
        review={form.review ? { "Họ tên": form.review.fullName, "Số điện thoại": form.review.phone } : null}
        onRead={() => void form.readBack()}
        onReplace={form.replaceWithReview}
      />
      {draft ? (
        <fieldset disabled={form.saving} className="grid gap-4 md:grid-cols-2">
          <legend className="sr-only">Thông tin tài khoản</legend>
          <Input
            label="Họ tên"
            value={draft.fullName}
            maxLength={255}
            required
            onChange={(e) => form.setDraft({ ...draft, fullName: e.target.value })}
          />
          <Input label="Email" value={draft.email} disabled />
          <Input
            label="Số điện thoại"
            value={draft.phone}
            maxLength={50}
            onChange={(e) => form.setDraft({ ...draft, phone: e.target.value })}
          />
          <div className="self-end">
            <Button
              className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
              loading={form.saving}
              disabled={form.blocked || !draft.profileEtag || !draft.fullName.trim()}
              onClick={() => void form.save()}
            >
              Cập nhật thông tin
            </Button>
          </div>
        </fieldset>
      ) : null}
      <p className="text-xs text-slate-500">
        Email đăng nhập và ảnh đại diện chưa hỗ trợ chỉnh sửa tại đây.
      </p>
    </div>
  );
}
