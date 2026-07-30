import { Shield, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

export function RecruiterMembersPage({ mode = "list" }: { mode?: "list" | "invite" }) {
  if (mode === "invite") {
    return (
      <PageContainer>
        <PageHeader title="Mời thành viên" description="Mời thành viên tham gia quản lý tuyển dụng." />
        <Card className="max-w-2xl">
          <SectionHeader title="Chưa thể gửi lời mời" description="Chưa có dữ liệu để gửi lời mời thành viên." />
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Email" placeholder="member@example.com" disabled />
            <Select label="Vai trò" disabled options={[{ label: "Recruiter", value: "Recruiter" }, { label: "Interviewer", value: "Interviewer" }, { label: "Recruitment Manager", value: "Recruitment Manager" }]} />
          </div>
          <div className="mt-5 flex gap-2">
            <Button disabled>Gửi lời mời</Button>
            <Link to="/recruiter/members"><Button variant="secondary">Quay lại</Button></Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Thành viên doanh nghiệp" description="Quản lý thành viên tham gia tuyển dụng của công ty." />
      <div className="mb-5 flex justify-end">
        <Link to="/recruiter/members/invite"><Button icon={<UserPlus size={16} />}>Mời thành viên</Button></Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeader title="Danh sách thành viên" />
          <EmptyState message="Chưa có dữ liệu thành viên." />
        </Card>

        <aside className="space-y-5">
          <InfoCard icon={<Users size={18} />} title="Thành viên" message="Chưa có danh sách thành viên." />
          <InfoCard icon={<Shield size={18} />} title="Vai trò và quyền" message="Chưa có dữ liệu phân quyền." />
          <InfoCard icon={<UserPlus size={18} />} title="Mời thành viên" message="Chưa có trạng thái lời mời." />
        </aside>
      </div>
    </PageContainer>
  );
}

function InfoCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-brand-50 p-2 text-brand-700">{icon}</div>
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
        </div>
      </div>
    </Card>
  );
}
