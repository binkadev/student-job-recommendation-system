import { useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Tabs } from "../../components/ui/Tabs";
import { getSystemSettings } from "../../utils/systemSettings";

type SettingsTab = "general" | "cv" | "jobs" | "email" | "notifications" | "security" | "privacy";

const tabs = [
  { label: "General", value: "general" },
  { label: "CV Upload", value: "cv" },
  { label: "Jobs", value: "jobs" },
  { label: "Email", value: "email" },
  { label: "Notifications", value: "notifications" },
  { label: "Security", value: "security" },
  { label: "Privacy", value: "privacy" },
];

export function AdminSystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState(() => getSystemSettings());

  return (
    <PageContainer>
      <PageHeader title="Cấu hình hệ thống" description="Theo dõi các thiết lập đang hiển thị trên giao diện." />

      <Card className="mb-5">
        <Tabs items={tabs} value={activeTab} onChange={(value) => setActiveTab(value as SettingsTab)} />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-700">Tab hiện tại: {getTabLabel(activeTab)}</p>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div>
          {activeTab === "general" ? <GeneralSettings /> : null}
          {activeTab === "cv" ? <CvUploadSettings settings={settings.cv} onChange={(cv) => setSettings((current) => ({ ...current, cv }))} /> : null}
          {activeTab === "jobs" ? <JobsSettings /> : null}
          {activeTab === "email" ? <EmailSettings /> : null}
          {activeTab === "notifications" ? <NotificationSettings /> : null}
          {activeTab === "security" ? <SecuritySettings /> : null}
          {activeTab === "privacy" ? <PrivacySettings /> : null}
        </div>

        <Card>
          <SectionHeader title="Thông tin cấu hình" />
          <EmptyState message="Các cấu hình trong màn hình này đang ở trạng thái chỉ xem và chưa lưu thay đổi." />
        </Card>
      </div>
    </PageContainer>
  );
}

function GeneralSettings() {
  return (
    <Card>
      <SectionHeader title="General" />
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên hệ thống" value="" onChange={() => undefined} placeholder="setting_key: system.name" disabled />
        <Input label="Logo hệ thống" value="" onChange={() => undefined} placeholder="setting_key: system.logo" disabled />
        <Input label="Email hỗ trợ" value="" onChange={() => undefined} placeholder="Email hỗ trợ" disabled />
        <Select label="Ngôn ngữ mặc định" value="" onChange={() => undefined} options={[{ label: "Chưa cập nhật", value: "" }]} disabled />
        <Select label="Múi giờ" value="" onChange={() => undefined} options={[{ label: "Chưa cập nhật", value: "" }]} disabled />
      </div>
    </Card>
  );
}

function CvUploadSettings({
  settings,
  onChange,
}: {
  settings: { maxFileSizeMb: number; maxCvsPerUser: number };
  onChange: (settings: { maxFileSizeMb: number; maxCvsPerUser: number }) => void;
}) {
  return (
    <Card>
      <SectionHeader title="CV Upload" />
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="File type cho phép" value="PDF,DOCX" onChange={() => undefined} disabled />
        <Input label="Dung lượng tối đa đang hiển thị (MB)" type="number" min="1" value={String(settings.maxFileSizeMb)} onChange={(event) => onChange({ ...settings, maxFileSizeMb: Math.max(1, Number(event.target.value) || 1) })} disabled />
        <Input label="Số CV tối đa đang hiển thị" type="number" min="1" value={String(settings.maxCvsPerUser)} onChange={(event) => onChange({ ...settings, maxCvsPerUser: Math.max(1, Number(event.target.value) || 1) })} disabled />
        <Input label="Thời gian phân tích tối đa (giây)" type="number" value="" onChange={() => undefined} disabled />
      </div>
      <div className="mt-5">
        <Button disabled>Đang khóa cấu hình</Button>
      </div>
    </Card>
  );
}

function JobsSettings() {
  return (
    <Card>
      <SectionHeader title="Jobs" />
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Số ngày hết hạn mặc định" type="number" value="" onChange={() => undefined} disabled />
        <Input label="Số tin active tối đa" type="number" value="" onChange={() => undefined} disabled />
        <Switch label="Yêu cầu kiểm duyệt" checked={false} onChange={() => undefined} disabled />
        <Switch label="Cho phép ẩn lương" checked={false} onChange={() => undefined} disabled />
      </div>
    </Card>
  );
}

function EmailSettings() {
  return (
    <Card>
      <SectionHeader title="Email" />
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên người gửi" value="" onChange={() => undefined} disabled />
        <Input label="Email người gửi" value="" onChange={() => undefined} disabled />
        <Input label="Email phản hồi" value="" onChange={() => undefined} disabled />
      </div>
    </Card>
  );
}

function NotificationSettings() {
  return (
    <Card>
      <SectionHeader title="Notifications" />
      <div className="grid gap-4 md:grid-cols-2">
        <Switch label="Candidate notifications" checked={false} onChange={() => undefined} disabled />
        <Switch label="Recruiter notifications" checked={false} onChange={() => undefined} disabled />
        <Input label="Admin alert threshold" type="number" value="" onChange={() => undefined} disabled />
      </div>
    </Card>
  );
}

function SecuritySettings() {
  return (
    <Card>
      <SectionHeader title="Security" />
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Độ dài mật khẩu tối thiểu" type="number" value="" onChange={() => undefined} disabled />
        <Input label="Số lần login sai" type="number" value="" onChange={() => undefined} disabled />
        <Input label="Session timeout (phút)" type="number" value="" onChange={() => undefined} disabled />
        <Switch label="Yêu cầu recruiter verification" checked={false} onChange={() => undefined} disabled />
      </div>
    </Card>
  );
}

function PrivacySettings() {
  return (
    <Card>
      <SectionHeader title="Privacy" />
      <div className="grid gap-4 md:grid-cols-2">
        <Select label="Hiển thị hồ sơ mặc định" value="" onChange={() => undefined} options={[{ label: "Chưa cập nhật", value: "" }]} disabled />
        <Input label="Số ngày lưu dữ liệu" type="number" value="" onChange={() => undefined} disabled />
        <Switch label="Cho phép tải CV" checked={false} onChange={() => undefined} disabled />
        <Switch label="Yêu cầu consent" checked={false} onChange={() => undefined} disabled />
      </div>
    </Card>
  );
}

function getTabLabel(tab: SettingsTab) {
  return tabs.find((item) => item.value === tab)?.label ?? tab;
}
