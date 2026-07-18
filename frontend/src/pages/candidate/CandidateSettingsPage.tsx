import { Camera, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type SettingsTab = "account" | "security" | "privacy" | "notifications";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface StudentResponse {
  id: number;
  userId: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  studentCode: string | null;
  major: string | null;
  university: string | null;
  graduationYear: number | null;
  location: string | null;
  headline: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountSettingsForm {
  avatar: string;
  fullName: string;
  email: string;
  phone: string;
}

const INITIAL_PRIVACY_SETTINGS = {
  discoverable: false,
  showEmail: false,
  showPhone: false,
  allowCvDownload: false,
  allowInvitations: false,
  publicExperience: false,
};

const INITIAL_NOTIFICATION_SETTINGS = {
  jobMatchEmail: false,
  applicationStatusEmail: false,
  interviewEmail: false,
  invitationEmail: false,
  inApp: false,
  message: false,
};

export function CandidateSettingsPage({ section = "account" }: { section?: "main" | SettingsTab }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<SettingsTab>(section === "main" ? "account" : section);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const studentQuery = useAsyncData(() => getStudentSettings(), [reloadKey]);

  useEffect(() => {
    if (section !== "main") setTab(section);
  }, [section]);

  async function saveAccount(account: AccountSettingsForm) {
    try {
      await updateStudentAccount(account);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật thông tin tài khoản" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật tài khoản", message: getErrorMessage(error) });
    }
  }

  function notifyUnsupported(feature: string) {
    showToast({
      type: "info",
      title: "Chức năng chưa có API backend",
      message: `${feature} hiện chưa có endpoint để lưu dữ liệu thật.`,
    });
  }

  return (
    <PageContainer>
      <PageHeader title="Cài đặt ứng viên" description="Quản lý thông tin tài khoản và các tùy chọn hệ thống theo API hiện có." />
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
            <>
              {studentQuery.loading ? <LoadingState /> : null}
              {!studentQuery.loading && studentQuery.error ? <EmptyState message={studentQuery.error} /> : null}
              {!studentQuery.loading && studentQuery.data ? <AccountSettings account={mapStudentToAccount(studentQuery.data)} onSave={saveAccount} onUnsupported={notifyUnsupported} /> : null}
            </>
          ) : null}
          {tab === "security" ? <SecuritySettings onUnsupported={notifyUnsupported} /> : null}
          {tab === "privacy" ? <PrivacySettings onUnsupported={notifyUnsupported} /> : null}
          {tab === "notifications" ? <NotificationSettings onUnsupported={notifyUnsupported} /> : null}
        </div>
      </Card>

      <Card className="mt-5 border-red-100">
        <SectionHeader title="Khu vực nguy hiểm" description="Backend hiện chưa có API xóa tài khoản ứng viên từ giao diện." />
        <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>Xóa tài khoản</Button>
      </Card>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          notifyUnsupported("Xóa tài khoản");
        }}
      />
    </PageContainer>
  );
}

function AccountSettings({
  account,
  onSave,
  onUnsupported,
}: {
  account: AccountSettingsForm;
  onSave: (account: AccountSettingsForm) => Promise<void>;
  onUnsupported: (feature: string) => void;
}) {
  const [form, setForm] = useState(account);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(account), [account]);

  function update<K extends keyof AccountSettingsForm>(key: K, value: AccountSettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Vui lòng nhập họ tên.";
    if (form.phone.trim() && !/^(0|\+84)[0-9\s]{8,13}$/.test(form.phone.replace(/-/g, " "))) {
      nextErrors.phone = "Số điện thoại không hợp lệ.";
    }
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
    <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
      <Card>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-700">{form.avatar}</div>
          <Button className="mt-4" variant="secondary" icon={<Camera size={16} />} onClick={() => onUnsupported("Upload avatar")}>Upload avatar</Button>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Họ tên" value={form.fullName} error={errors.fullName} onChange={(event) => update("fullName", event.target.value)} />
        <Input label="Email" value={form.email} disabled />
        <Input label="Số điện thoại" value={form.phone} error={errors.phone} onChange={(event) => update("phone", event.target.value)} />
        <div className="self-end">
          <Button loading={saving} onClick={save}>Cập nhật thông tin</Button>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  const { logout } = useAuth();
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
    onUnsupported("Đổi mật khẩu");
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
        <Switch label="Bật xác thực hai bước" checked={false} onChange={() => onUnsupported("Xác thực hai bước")} />
        <Button variant="secondary" icon={<LogOut size={16} />} onClick={logout}>
          Đăng xuất phiên hiện tại
        </Button>
      </div>
      <Button icon={<ShieldAlert size={16} />} onClick={changePassword}>Đổi mật khẩu</Button>
    </div>
  );
}

function PrivacySettings({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  return (
    <div className="space-y-4">
      <EmptyState message="Backend hiện chưa có API lưu cài đặt quyền riêng tư của ứng viên." />
      <Switch label="Cho phép recruiter tìm thấy hồ sơ" checked={INITIAL_PRIVACY_SETTINGS.discoverable} onChange={() => onUnsupported("Quyền riêng tư")} />
      <Switch label="Hiển thị email" checked={INITIAL_PRIVACY_SETTINGS.showEmail} onChange={() => onUnsupported("Quyền riêng tư")} />
      <Switch label="Hiển thị số điện thoại" checked={INITIAL_PRIVACY_SETTINGS.showPhone} onChange={() => onUnsupported("Quyền riêng tư")} />
      <Switch label="Cho phép tải CV" checked={INITIAL_PRIVACY_SETTINGS.allowCvDownload} onChange={() => onUnsupported("Quyền riêng tư")} />
      <Switch label="Cho phép gửi lời mời ứng tuyển" checked={INITIAL_PRIVACY_SETTINGS.allowInvitations} onChange={() => onUnsupported("Quyền riêng tư")} />
      <Switch label="Công khai kinh nghiệm làm việc" checked={INITIAL_PRIVACY_SETTINGS.publicExperience} onChange={() => onUnsupported("Quyền riêng tư")} />
    </div>
  );
}

function NotificationSettings({ onUnsupported }: { onUnsupported: (feature: string) => void }) {
  return (
    <div className="space-y-4">
      <EmptyState message="Backend hiện chỉ có API danh sách thông báo, chưa có API lưu tùy chọn nhận thông báo." />
      <Switch label="Email việc làm phù hợp" checked={INITIAL_NOTIFICATION_SETTINGS.jobMatchEmail} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Email trạng thái ứng tuyển" checked={INITIAL_NOTIFICATION_SETTINGS.applicationStatusEmail} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Email phỏng vấn" checked={INITIAL_NOTIFICATION_SETTINGS.interviewEmail} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Email lời mời" checked={INITIAL_NOTIFICATION_SETTINGS.invitationEmail} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Thông báo trong hệ thống" checked={INITIAL_NOTIFICATION_SETTINGS.inApp} onChange={() => onUnsupported("Cài đặt thông báo")} />
      <Switch label="Thông báo tin nhắn" checked={INITIAL_NOTIFICATION_SETTINGS.message} onChange={() => onUnsupported("Cài đặt thông báo")} />
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
        <p className="text-sm text-slate-700">Nhập <strong>XOA TAI KHOAN</strong> để xác nhận. Backend hiện chưa có API xóa tài khoản từ frontend nên thao tác này sẽ không xóa dữ liệu.</p>
        <Input label="Mã xác nhận" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" disabled={confirmation !== "XOA TAI KHOAN"} onClick={onConfirm}>Xóa tài khoản</Button>
        </div>
      </div>
    </Modal>
  );
}

async function getStudentSettings() {
  const response = await httpClient.get<ApiResponse<StudentResponse>>("/students/me");
  return response.data.data;
}

async function updateStudentAccount(account: AccountSettingsForm) {
  await httpClient.put<ApiResponse<StudentResponse>>("/students/me", {
    fullName: emptyToNull(account.fullName),
    phone: emptyToNull(account.phone),
  });
}

function mapStudentToAccount(student: StudentResponse): AccountSettingsForm {
  const fullName = student.fullName || student.email;
  return {
    avatar: getInitials(fullName),
    fullName,
    email: student.email,
    phone: student.phone || "",
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getInitials(value: string) {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(-2)
    .toUpperCase();
  return initials || "UV";
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

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
