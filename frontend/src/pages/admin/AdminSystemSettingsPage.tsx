import { useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Checkbox } from "../../components/ui/Checkbox";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { Timeline } from "../../components/ui/Timeline";
import { useToast } from "../../hooks/useToast";

type SettingsTab = "general" | "cv" | "jobs" | "email" | "notifications" | "security" | "privacy";
type ResetTarget = "tab" | "all" | null;
type SaveTarget = SettingsTab | null;

interface SystemSettings {
  general: {
    systemName: string;
    logoPlaceholder: string;
    supportEmail: string;
    defaultLanguage: string;
    timezone: string;
  };
  cv: {
    fileTypes: string[];
    maxFileSize: number;
    maxCvPerCandidate: number;
    analysisTimeout: number;
  };
  jobs: {
    defaultExpiryDays: number;
    requireModeration: boolean;
    maxActiveJobs: number;
    allowHiddenSalary: boolean;
  };
  email: {
    senderName: string;
    senderEmail: string;
    replyToEmail: string;
  };
  notifications: {
    candidateNotifications: boolean;
    recruiterNotifications: boolean;
    adminAlertThreshold: number;
  };
  security: {
    minPasswordLength: number;
    maxLoginAttempts: number;
    sessionTimeout: number;
    requireRecruiterVerification: boolean;
  };
  privacy: {
    defaultProfileVisibility: string;
    dataRetentionDays: number;
    allowCvDownload: boolean;
    requireConsent: boolean;
  };
}

interface AuditItem {
  id: string;
  label: string;
  at: string;
  note: string;
}

const tabs = [
  { label: "General", value: "general" },
  { label: "CV Upload", value: "cv" },
  { label: "Jobs", value: "jobs" },
  { label: "Email", value: "email" },
  { label: "Notifications", value: "notifications" },
  { label: "Security", value: "security" },
  { label: "Privacy", value: "privacy" },
];

const defaultSettings: SystemSettings = {
  general: {
    systemName: "Hệ thống gợi ý việc làm sinh viên IT",
    logoPlaceholder: "SJR",
    supportEmail: "hotro@vieclam-it.vn",
    defaultLanguage: "vi",
    timezone: "Asia/Ho_Chi_Minh",
  },
  cv: {
    fileTypes: ["PDF", "DOCX"],
    maxFileSize: 10,
    maxCvPerCandidate: 5,
    analysisTimeout: 120,
  },
  jobs: {
    defaultExpiryDays: 30,
    requireModeration: true,
    maxActiveJobs: 20,
    allowHiddenSalary: true,
  },
  email: {
    senderName: "Vieclam IT",
    senderEmail: "no-reply@vieclam-it.vn",
    replyToEmail: "hotro@vieclam-it.vn",
  },
  notifications: {
    candidateNotifications: true,
    recruiterNotifications: true,
    adminAlertThreshold: 10,
  },
  security: {
    minPasswordLength: 8,
    maxLoginAttempts: 5,
    sessionTimeout: 120,
    requireRecruiterVerification: true,
  },
  privacy: {
    defaultProfileVisibility: "private",
    dataRetentionDays: 365,
    allowCvDownload: true,
    requireConsent: true,
  },
};

const importantTabs: SettingsTab[] = ["cv", "jobs", "security", "privacy"];

export function AdminSystemSettingsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [resetTarget, setResetTarget] = useState<ResetTarget>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(null);
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([
    {
      id: "init",
      label: "Khởi tạo cấu hình",
      at: "2026-07-12T08:00:00",
      note: "Trang cấu hình hệ thống sẵn sàng chỉnh sửa.",
    },
  ]);

  function updateTab<Tab extends SettingsTab, Key extends keyof SystemSettings[Tab]>(tab: Tab, key: Key, value: SystemSettings[Tab][Key]) {
    setSettings((current) => ({ ...current, [tab]: { ...current[tab], [key]: value } }));
  }

  function requestSaveCurrentTab() {
    const error = validateTab(activeTab, settings[activeTab]);
    if (error) {
      showToast({ type: "error", title: error });
      return;
    }
    if (importantTabs.includes(activeTab)) {
      setSaveTarget(activeTab);
      return;
    }
    saveTab(activeTab);
  }

  function saveTab(tab: SettingsTab) {
    addAudit("Lưu cấu hình", `Đã lưu tab ${getTabLabel(tab)}.`);
    showToast({ type: "success", title: `Đã lưu ${getTabLabel(tab)}` });
    setSaveTarget(null);
  }

  function confirmReset() {
    if (resetTarget === "tab") {
      setSettings((current) => ({ ...current, [activeTab]: defaultSettings[activeTab] }));
      addAudit("Reset tab", `Reset tab ${getTabLabel(activeTab)} về mặc định.`);
      showToast({ type: "success", title: "Đã reset tab hiện tại" });
    }
    if (resetTarget === "all") {
      setSettings(defaultSettings);
      addAudit("Reset toàn bộ", "Reset toàn bộ cấu hình hệ thống về mặc định.");
      showToast({ type: "success", title: "Đã reset toàn bộ cấu hình" });
    }
    setResetTarget(null);
  }

  function addAudit(label: string, note: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}`, label, note, at: new Date().toISOString() }, ...current]);
  }

  return (
    <PageContainer>
      <PageHeader title="Cấu hình hệ thống" description="Thiết lập cấu hình admin theo từng tab, có validation, reset, xác nhận thay đổi quan trọng và audit log." />

      <Card className="mb-5">
        <Tabs items={tabs} value={activeTab} onChange={(value) => setActiveTab(value as SettingsTab)} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <StatusBadge label={`Tab hiện tại: ${getTabLabel(activeTab)}`} tone="neutral" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={requestSaveCurrentTab}>Lưu tab này</Button>
            <Button variant="secondary" onClick={() => setResetTarget("tab")}>Reset tab hiện tại</Button>
            <Button variant="danger" onClick={() => setResetTarget("all")}>Reset toàn bộ</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div>
          {activeTab === "general" ? <GeneralSettings data={settings.general} onChange={(key, value) => updateTab("general", key, value)} /> : null}
          {activeTab === "cv" ? <CvUploadSettings data={settings.cv} onChange={(key, value) => updateTab("cv", key, value)} /> : null}
          {activeTab === "jobs" ? <JobsSettings data={settings.jobs} onChange={(key, value) => updateTab("jobs", key, value)} /> : null}
          {activeTab === "email" ? <EmailSettings data={settings.email} onChange={(key, value) => updateTab("email", key, value)} /> : null}
          {activeTab === "notifications" ? <NotificationSettings data={settings.notifications} onChange={(key, value) => updateTab("notifications", key, value)} /> : null}
          {activeTab === "security" ? <SecuritySettings data={settings.security} onChange={(key, value) => updateTab("security", key, value)} /> : null}
          {activeTab === "privacy" ? <PrivacySettings data={settings.privacy} onChange={(key, value) => updateTab("privacy", key, value)} /> : null}
        </div>

        <Card>
          <h3 className="text-base font-semibold text-slate-950">Audit log</h3>
          <p className="mt-1 text-sm text-slate-500">Ghi lại thao tác lưu và reset cấu hình.</p>
          <div className="mt-4">
            <Timeline items={auditLogs.map((item) => ({ label: item.label, at: item.at, note: item.note }))} />
          </div>
        </Card>
      </div>

      <ConfirmSaveModal target={saveTarget} onClose={() => setSaveTarget(null)} onConfirm={() => saveTarget && saveTab(saveTarget)} />
      <ConfirmResetModal target={resetTarget} activeTab={activeTab} onClose={() => setResetTarget(null)} onConfirm={confirmReset} />
    </PageContainer>
  );
}

function GeneralSettings({ data, onChange }: { data: SystemSettings["general"]; onChange: <Key extends keyof SystemSettings["general"]>(key: Key, value: SystemSettings["general"][Key]) => void }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">General</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Tên hệ thống" value={data.systemName} onChange={(event) => onChange("systemName", event.target.value)} />
        <Input label="Logo placeholder" value={data.logoPlaceholder} onChange={(event) => onChange("logoPlaceholder", event.target.value)} />
        <Input label="Support email" value={data.supportEmail} onChange={(event) => onChange("supportEmail", event.target.value)} />
        <Select label="Ngôn ngữ mặc định" value={data.defaultLanguage} onChange={(event) => onChange("defaultLanguage", event.target.value)} options={[{ label: "Tiếng Việt", value: "vi" }, { label: "English", value: "en" }]} />
        <Select label="Timezone" value={data.timezone} onChange={(event) => onChange("timezone", event.target.value)} options={[{ label: "Asia/Ho_Chi_Minh", value: "Asia/Ho_Chi_Minh" }, { label: "UTC", value: "UTC" }]} />
      </div>
    </Card>
  );
}

function CvUploadSettings({ data, onChange }: { data: SystemSettings["cv"]; onChange: <Key extends keyof SystemSettings["cv"]>(key: Key, value: SystemSettings["cv"][Key]) => void }) {
  function toggleFileType(type: string) {
    onChange("fileTypes", data.fileTypes.includes(type) ? data.fileTypes.filter((item) => item !== type) : [...data.fileTypes, type]);
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">CV Upload</h3>
      <div className="mt-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-700">File type cho phép</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {["PDF", "DOCX", "DOC"].map((type) => <Checkbox key={type} label={type} checked={data.fileTypes.includes(type)} onChange={() => toggleFileType(type)} />)}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Dung lượng tối đa (MB)" type="number" min={1} max={100} value={data.maxFileSize} onChange={(event) => onChange("maxFileSize", Number(event.target.value))} />
          <Input label="Số CV tối đa mỗi ứng viên" type="number" min={1} max={20} value={data.maxCvPerCandidate} onChange={(event) => onChange("maxCvPerCandidate", Number(event.target.value))} />
          <Input label="Analysis timeout (giây)" type="number" min={1} max={600} value={data.analysisTimeout} onChange={(event) => onChange("analysisTimeout", Number(event.target.value))} />
        </div>
      </div>
    </Card>
  );
}

function JobsSettings({ data, onChange }: { data: SystemSettings["jobs"]; onChange: <Key extends keyof SystemSettings["jobs"]>(key: Key, value: SystemSettings["jobs"][Key]) => void }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">Jobs</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Số ngày hết hạn mặc định" type="number" min={1} max={365} value={data.defaultExpiryDays} onChange={(event) => onChange("defaultExpiryDays", Number(event.target.value))} />
        <Input label="Số tin active tối đa" type="number" min={1} max={500} value={data.maxActiveJobs} onChange={(event) => onChange("maxActiveJobs", Number(event.target.value))} />
        <Switch label="Yêu cầu kiểm duyệt" checked={data.requireModeration} onChange={(value) => onChange("requireModeration", value)} />
        <Switch label="Cho phép ẩn lương" checked={data.allowHiddenSalary} onChange={(value) => onChange("allowHiddenSalary", value)} />
      </div>
    </Card>
  );
}

function EmailSettings({ data, onChange }: { data: SystemSettings["email"]; onChange: <Key extends keyof SystemSettings["email"]>(key: Key, value: SystemSettings["email"][Key]) => void }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">Email</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Sender name" value={data.senderName} onChange={(event) => onChange("senderName", event.target.value)} />
        <Input label="Sender email" value={data.senderEmail} onChange={(event) => onChange("senderEmail", event.target.value)} />
        <Input label="Reply-to email" value={data.replyToEmail} onChange={(event) => onChange("replyToEmail", event.target.value)} />
      </div>
    </Card>
  );
}

function NotificationSettings({ data, onChange }: { data: SystemSettings["notifications"]; onChange: <Key extends keyof SystemSettings["notifications"]>(key: Key, value: SystemSettings["notifications"][Key]) => void }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">Notifications</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Switch label="Candidate notifications" checked={data.candidateNotifications} onChange={(value) => onChange("candidateNotifications", value)} />
        <Switch label="Recruiter notifications" checked={data.recruiterNotifications} onChange={(value) => onChange("recruiterNotifications", value)} />
        <Input label="Admin alert threshold" type="number" min={0} value={data.adminAlertThreshold} onChange={(event) => onChange("adminAlertThreshold", Number(event.target.value))} />
      </div>
    </Card>
  );
}

function SecuritySettings({ data, onChange }: { data: SystemSettings["security"]; onChange: <Key extends keyof SystemSettings["security"]>(key: Key, value: SystemSettings["security"][Key]) => void }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">Security</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Độ dài mật khẩu tối thiểu" type="number" min={6} max={64} value={data.minPasswordLength} onChange={(event) => onChange("minPasswordLength", Number(event.target.value))} />
        <Input label="Số lần login sai" type="number" min={1} max={20} value={data.maxLoginAttempts} onChange={(event) => onChange("maxLoginAttempts", Number(event.target.value))} />
        <Input label="Session timeout (phút)" type="number" min={1} value={data.sessionTimeout} onChange={(event) => onChange("sessionTimeout", Number(event.target.value))} />
        <Switch label="Yêu cầu recruiter verification" checked={data.requireRecruiterVerification} onChange={(value) => onChange("requireRecruiterVerification", value)} />
      </div>
    </Card>
  );
}

function PrivacySettings({ data, onChange }: { data: SystemSettings["privacy"]; onChange: <Key extends keyof SystemSettings["privacy"]>(key: Key, value: SystemSettings["privacy"][Key]) => void }) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-950">Privacy</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Select label="Profile visibility mặc định" value={data.defaultProfileVisibility} onChange={(event) => onChange("defaultProfileVisibility", event.target.value)} options={[{ label: "Riêng tư", value: "private" }, { label: "Chỉ nhà tuyển dụng", value: "recruiters" }, { label: "Công khai", value: "public" }]} />
        <Input label="Data retention days" type="number" min={1} value={data.dataRetentionDays} onChange={(event) => onChange("dataRetentionDays", Number(event.target.value))} />
        <Switch label="Cho phép tải CV" checked={data.allowCvDownload} onChange={(value) => onChange("allowCvDownload", value)} />
        <Switch label="Yêu cầu consent" checked={data.requireConsent} onChange={(value) => onChange("requireConsent", value)} />
      </div>
    </Card>
  );
}

function ConfirmSaveModal({ target, onClose, onConfirm }: { target: SaveTarget; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={Boolean(target)} title="Xác nhận thay đổi quan trọng" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Bạn có chắc muốn lưu thay đổi trong tab {target ? getTabLabel(target) : ""}? Thiết lập này có thể ảnh hưởng đến luồng upload CV, tin tuyển dụng, bảo mật hoặc quyền riêng tư.
        </p>
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Thao tác sẽ hiển thị toast và được ghi vào audit log.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={onConfirm}>Đồng ý lưu</Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmResetModal({ target, activeTab, onClose, onConfirm }: { target: ResetTarget; activeTab: SettingsTab; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={Boolean(target)} title="Xác nhận reset cấu hình" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          {target === "all" ? "Bạn có chắc muốn reset toàn bộ cấu hình hệ thống về mặc định không?" : `Bạn có chắc muốn reset tab ${getTabLabel(activeTab)} về mặc định không?`}
        </p>
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Đây là thay đổi quan trọng và sẽ được ghi audit log.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" onClick={onConfirm}>Xác nhận reset</Button>
        </div>
      </div>
    </Modal>
  );
}

function validateTab(tab: SettingsTab, data: SystemSettings[SettingsTab]) {
  if (tab === "general" && !isValidEmail((data as SystemSettings["general"]).supportEmail)) return "Support email không hợp lệ.";
  if (tab === "cv") {
    const cv = data as SystemSettings["cv"];
    if (!cv.fileTypes.length) return "File type không được rỗng.";
    if (cv.maxFileSize <= 0 || cv.maxFileSize > 100) return "Dung lượng CV tối đa phải trong khoảng 1-100MB.";
    if (cv.maxCvPerCandidate <= 0 || cv.maxCvPerCandidate > 20) return "Số CV tối đa mỗi ứng viên phải trong khoảng 1-20.";
    if (cv.analysisTimeout <= 0 || cv.analysisTimeout > 600) return "Analysis timeout phải trong khoảng 1-600 giây.";
  }
  if (tab === "jobs") {
    const jobs = data as SystemSettings["jobs"];
    if (jobs.defaultExpiryDays <= 0 || jobs.defaultExpiryDays > 365) return "Số ngày hết hạn mặc định phải trong khoảng 1-365.";
    if (jobs.maxActiveJobs <= 0 || jobs.maxActiveJobs > 500) return "Số tin active tối đa phải trong khoảng 1-500.";
  }
  if (tab === "email") {
    const email = data as SystemSettings["email"];
    if (!isValidEmail(email.senderEmail) || !isValidEmail(email.replyToEmail)) return "Sender email hoặc reply-to email không hợp lệ.";
  }
  if (tab === "notifications" && (data as SystemSettings["notifications"]).adminAlertThreshold < 0) return "Admin alert threshold không hợp lệ.";
  if (tab === "security") {
    const security = data as SystemSettings["security"];
    if (security.minPasswordLength < 6 || security.minPasswordLength > 64) return "Độ dài mật khẩu tối thiểu phải từ 6 đến 64.";
    if (security.maxLoginAttempts <= 0 || security.maxLoginAttempts > 20) return "Số lần login sai phải trong khoảng 1-20.";
    if (security.sessionTimeout <= 0) return "Session timeout phải lớn hơn 0.";
  }
  if (tab === "privacy" && (data as SystemSettings["privacy"]).dataRetentionDays <= 0) return "Data retention days phải lớn hơn 0.";
  return "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getTabLabel(tab: SettingsTab) {
  return tabs.find((item) => item.value === tab)?.label ?? tab;
}
