import { Camera, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { useLocalStorageState } from "../../hooks/useLocalStorageState";
import { useToast } from "../../hooks/useToast";

type SettingsTab = "account" | "security" | "privacy" | "notifications";

interface CandidateSettings {
  account: {
    avatar: string;
    fullName: string;
    email: string;
    phone: string;
  };
  security: {
    twoFactor: boolean;
  };
  privacy: {
    discoverable: boolean;
    showEmail: boolean;
    showPhone: boolean;
    allowCvDownload: boolean;
    allowInvitations: boolean;
    publicExperience: boolean;
  };
  notifications: {
    jobMatchEmail: boolean;
    applicationStatusEmail: boolean;
    interviewEmail: boolean;
    invitationEmail: boolean;
    inApp: boolean;
    message: boolean;
  };
}

const defaultSettings: CandidateSettings = {
  account: {
    avatar: "NA",
    fullName: "Nguyễn Văn An",
    email: "candidate@example.com",
    phone: "0901 234 567",
  },
  security: {
    twoFactor: false,
  },
  privacy: {
    discoverable: true,
    showEmail: false,
    showPhone: false,
    allowCvDownload: true,
    allowInvitations: true,
    publicExperience: true,
  },
  notifications: {
    jobMatchEmail: true,
    applicationStatusEmail: true,
    interviewEmail: true,
    invitationEmail: true,
    inApp: true,
    message: true,
  },
};

export function CandidateSettingsPage({ section = "account" }: { section?: "main" | SettingsTab }) {
  const { showToast } = useToast();
  const [settings, setSettings] = useLocalStorageState<CandidateSettings>("candidate-settings-v2", defaultSettings);
  const [tab, setTab] = useLocalStorageState<SettingsTab>("candidate-settings-tab", section === "main" ? "account" : section);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (section !== "main") setTab(section);
  }, [section, setTab]);

  return (
    <PageContainer>
      <PageHeader title="Cài đặt ứng viên" description="Quản lý tài khoản, bảo mật, quyền riêng tư và thông báo. Dữ liệu được lưu trong localStorage." />
      <Card>
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
        <div className="mt-5">
          {tab === "account" ? (
            <AccountSettings
              account={settings.account}
              onSave={(account) => {
                setSettings((current) => ({ ...current, account }));
                showToast({ type: "success", title: "Đã lưu thông tin tài khoản" });
              }}
            />
          ) : null}
          {tab === "security" ? (
            <SecuritySettings
              twoFactor={settings.security.twoFactor}
              onToggleTwoFactor={(checked) => setSettings((current) => ({ ...current, security: { ...current.security, twoFactor: checked } }))}
            />
          ) : null}
          {tab === "privacy" ? (
            <PrivacySettings
              privacy={settings.privacy}
              onChange={(privacy) => {
                setSettings((current) => ({ ...current, privacy }));
                showToast({ type: "success", title: "Đã lưu quyền riêng tư" });
              }}
            />
          ) : null}
          {tab === "notifications" ? (
            <NotificationSettings
              notifications={settings.notifications}
              onChange={(notifications) => {
                setSettings((current) => ({ ...current, notifications }));
                showToast({ type: "success", title: "Đã lưu cài đặt thông báo" });
              }}
            />
          ) : null}
        </div>
      </Card>

      <Card className="mt-5 border-red-100">
        <SectionHeader title="Khu vực nguy hiểm" description="Các thao tác ảnh hưởng lớn đến tài khoản. Prototype chỉ mô phỏng, không xóa dữ liệu thật." />
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>Xóa tài khoản</Button>
      </Card>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          showToast({ type: "error", title: "Đã mô phỏng xóa tài khoản", message: "Không có dữ liệu thật nào bị xóa." });
        }}
      />
    </PageContainer>
  );
}

function AccountSettings({ account, onSave }: { account: CandidateSettings["account"]; onSave: (account: CandidateSettings["account"]) => void }) {
  const [form, setForm] = useState(account);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setForm(account), [account]);

  function update<K extends keyof CandidateSettings["account"]>(key: K, value: CandidateSettings["account"][K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Vui lòng nhập họ tên.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Email không hợp lệ.";
    if (!/^(0|\+84)[0-9\s]{8,13}$/.test(form.phone.replace(/-/g, " "))) nextErrors.phone = "Số điện thoại không hợp lệ.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function save() {
    if (!validate()) return;
    onSave(form);
  }

  function uploadAvatarMock() {
    const initials = form.fullName
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(-2)
      .toUpperCase();
    update("avatar", initials || "UV");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-700">{form.avatar}</div>
          <Button className="mt-4" variant="secondary" icon={<Camera size={16} />} onClick={uploadAvatarMock}>Upload avatar giả lập</Button>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Họ tên" value={form.fullName} error={errors.fullName} onChange={(event) => update("fullName", event.target.value)} />
        <Input label="Email" value={form.email} error={errors.email} onChange={(event) => update("email", event.target.value)} />
        <Input label="Số điện thoại" value={form.phone} error={errors.phone} onChange={(event) => update("phone", event.target.value)} />
        <div className="self-end">
          <Button onClick={save}>Cập nhật thông tin</Button>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings({ twoFactor, onToggleTwoFactor }: { twoFactor: boolean; onToggleTwoFactor: (checked: boolean) => void }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const strength = getPasswordStrength(newPassword);

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại.";
    if (newPassword.length < 8) nextErrors.newPassword = "Mật khẩu tối thiểu 8 ký tự.";
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      nextErrors.newPassword = "Mật khẩu cần có chữ hoa, chữ thường và số.";
    }
    if (newPassword !== confirmPassword) nextErrors.confirmPassword = "Xác nhận mật khẩu phải khớp.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function changePassword() {
    if (!validate()) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    showToast({ type: "success", title: "Đã đổi mật khẩu mock" });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Mật khẩu hiện tại" type="password" value={currentPassword} error={errors.currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        <Input label="Mật khẩu mới" type="password" value={newPassword} error={errors.newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        <Input label="Xác nhận mật khẩu" type="password" value={confirmPassword} error={errors.confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        <div className="self-end">
          <ProgressBar label={`Độ mạnh mật khẩu: ${getStrengthLabel(strength)}`} value={strength} />
        </div>
      </div>
      <div className="space-y-4 rounded-lg border border-slate-200 p-4">
        <Switch label="Bật xác thực hai bước placeholder" checked={twoFactor} onChange={onToggleTwoFactor} />
        <Button variant="secondary" icon={<LogOut size={16} />} onClick={() => showToast({ type: "info", title: "Đã mô phỏng đăng xuất khỏi tất cả thiết bị" })}>
          Đăng xuất khỏi tất cả thiết bị
        </Button>
      </div>
      <Button icon={<ShieldAlert size={16} />} onClick={changePassword}>Đổi mật khẩu</Button>
    </div>
  );
}

function PrivacySettings({ privacy, onChange }: { privacy: CandidateSettings["privacy"]; onChange: (privacy: CandidateSettings["privacy"]) => void }) {
  function update<K extends keyof CandidateSettings["privacy"]>(key: K, value: CandidateSettings["privacy"][K]) {
    onChange({ ...privacy, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Switch label="Cho phép recruiter tìm thấy hồ sơ" checked={privacy.discoverable} onChange={(checked) => update("discoverable", checked)} />
      <Switch label="Hiển thị email" checked={privacy.showEmail} onChange={(checked) => update("showEmail", checked)} />
      <Switch label="Hiển thị số điện thoại" checked={privacy.showPhone} onChange={(checked) => update("showPhone", checked)} />
      <Switch label="Cho phép tải CV" checked={privacy.allowCvDownload} onChange={(checked) => update("allowCvDownload", checked)} />
      <Switch label="Cho phép gửi lời mời ứng tuyển" checked={privacy.allowInvitations} onChange={(checked) => update("allowInvitations", checked)} />
      <Switch label="Công khai kinh nghiệm làm việc" checked={privacy.publicExperience} onChange={(checked) => update("publicExperience", checked)} />
    </div>
  );
}

function NotificationSettings({ notifications, onChange }: { notifications: CandidateSettings["notifications"]; onChange: (notifications: CandidateSettings["notifications"]) => void }) {
  function update<K extends keyof CandidateSettings["notifications"]>(key: K, value: CandidateSettings["notifications"][K]) {
    onChange({ ...notifications, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Switch label="Email việc làm phù hợp" checked={notifications.jobMatchEmail} onChange={(checked) => update("jobMatchEmail", checked)} />
      <Switch label="Email trạng thái ứng tuyển" checked={notifications.applicationStatusEmail} onChange={(checked) => update("applicationStatusEmail", checked)} />
      <Switch label="Email phỏng vấn" checked={notifications.interviewEmail} onChange={(checked) => update("interviewEmail", checked)} />
      <Switch label="Email lời mời" checked={notifications.invitationEmail} onChange={(checked) => update("invitationEmail", checked)} />
      <Switch label="Thông báo trong hệ thống" checked={notifications.inApp} onChange={(checked) => update("inApp", checked)} />
      <Switch label="Thông báo tin nhắn" checked={notifications.message} onChange={(checked) => update("message", checked)} />
    </div>
  );
}

function DeleteAccountModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (open) setConfirmation("");
  }, [open]);

  return (
    <Modal open={open} title="Xóa tài khoản" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Nhập <strong>XOA TAI KHOAN</strong> để xác nhận. Đây chỉ là mô phỏng, hệ thống không xóa dữ liệu thật.</p>
        <Input label="Mã xác nhận" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" disabled={confirmation !== "XOA TAI KHOAN"} onClick={onConfirm}>Xóa tài khoản</Button>
        </div>
      </div>
    </Modal>
  );
}

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (/[A-Z]/.test(password)) score += 25;
  if (/[a-z]/.test(password)) score += 25;
  if (/[0-9]/.test(password)) score += 25;
  return score;
}

function getStrengthLabel(score: number) {
  if (score >= 100) return "Mạnh";
  if (score >= 75) return "Khá";
  if (score >= 50) return "Trung bình";
  return "Yếu";
}
