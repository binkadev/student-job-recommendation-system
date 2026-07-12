import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { RichTextPlaceholder } from "../../components/ui/RichTextPlaceholder";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";

export function RecruiterSettingsPage({ section = "account" }: { section?: "main" | "account" | "recruitment-process" | "email-templates" | "notifications" | "security" }) {
  const { showToast } = useToast();
  const [tab, setTab] = useLocalStorageState<string>("recruiter-settings-tab", section === "main" ? "account" : section);
  const [settings, setSettings] = useLocalStorageState("recruiter-settings", {
    emailNotification: true,
    candidateNotification: true,
    twoFactor: false,
    autoMovePipeline: false,
  });

  return (
    <PageContainer>
      <PageHeader title="Cài đặt nhà tuyển dụng" description="Quản lý tài khoản, quy trình tuyển dụng, mẫu email, thông báo và bảo mật." />
      <Card>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { label: "Tài khoản", value: "account" },
            { label: "Quy trình tuyển dụng", value: "recruitment-process" },
            { label: "Mẫu email", value: "email-templates" },
            { label: "Thông báo", value: "notifications" },
            { label: "Bảo mật", value: "security" },
          ]}
        />
        <div className="mt-5 space-y-5">
          {tab === "account" ? <div className="grid gap-4 md:grid-cols-2"><Input label="Tên tài khoản" defaultValue="Trần Thị Bình" /><Input label="Email" defaultValue="recruiter@example.com" /><Button onClick={() => showToast({ type: "success", title: "Đã lưu tài khoản" })}>Lưu</Button></div> : null}
          {tab === "recruitment-process" ? <div className="space-y-4"><Textarea label="Các bước pipeline" defaultValue="Mới nhận, Đang xem xét, Qua vòng CV, Phỏng vấn, Offer, Đã tuyển, Không phù hợp" /><Switch label="Tự động chuyển ứng viên khi tạo lịch phỏng vấn" checked={settings.autoMovePipeline} onChange={(checked) => setSettings((current) => ({ ...current, autoMovePipeline: checked }))} /></div> : null}
          {tab === "email-templates" ? <RichTextPlaceholder label="Mẫu email mời phỏng vấn" /> : null}
          {tab === "notifications" ? <div className="space-y-4"><Switch label="Thông báo qua email" checked={settings.emailNotification} onChange={(checked) => setSettings((current) => ({ ...current, emailNotification: checked }))} /><Switch label="Thông báo ứng viên mới" checked={settings.candidateNotification} onChange={(checked) => setSettings((current) => ({ ...current, candidateNotification: checked }))} /></div> : null}
          {tab === "security" ? <div className="space-y-4"><Input label="Mật khẩu hiện tại" type="password" /><Input label="Mật khẩu mới" type="password" /><Switch label="Bật xác thực hai bước" checked={settings.twoFactor} onChange={(checked) => setSettings((current) => ({ ...current, twoFactor: checked }))} /><Button onClick={() => showToast({ type: "success", title: "Đã đổi mật khẩu mock" })}>Đổi mật khẩu</Button></div> : null}
        </div>
      </Card>
      <div className="mt-5 max-w-xl"><ConfirmDialog danger title="Khóa tài khoản doanh nghiệp" description="Thao tác này chỉ mô phỏng confirm dialog trong frontend prototype." confirmLabel="Khóa tài khoản" /></div>
    </PageContainer>
  );
}
