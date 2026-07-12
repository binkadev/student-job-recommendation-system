import { useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useToast } from "../../hooks/useToast";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Recruitment Manager" | "Recruiter" | "Interviewer";
  status: "active" | "locked" | "invited";
  joinedAt: string;
  assignedJobs: number;
}

const initialMembers: Member[] = [
  { id: "member-1", name: "Trần Thị Bình", email: "recruiter@example.com", role: "Recruitment Manager", status: "active", joinedAt: "2026-02-20", assignedJobs: 4 },
  { id: "member-2", name: "Nguyễn Kim Oanh", email: "oanh.nguyen@example.com", role: "Interviewer", status: "active", joinedAt: "2026-04-12", assignedJobs: 2 },
  { id: "member-3", name: "Phan Đức Tài", email: "tai.phan@example.com", role: "Recruiter", status: "invited", joinedAt: "2026-07-01", assignedJobs: 1 },
];

export function RecruiterMembersPage({ mode = "list" }: { mode?: "list" | "invite" }) {
  const { showToast } = useToast();
  const [members, setMembers] = useState(initialMembers);

  function inviteMember() {
    const member: Member = { id: `member-${Date.now()}`, name: "Thành viên mới", email: "new.member@example.com", role: "Recruiter", status: "invited", joinedAt: new Date().toISOString().slice(0, 10), assignedJobs: 0 };
    setMembers((current) => [member, ...current]);
    showToast({ type: "success", title: "Đã gửi lời mời thành viên" });
  }

  if (mode === "invite") {
    return (
      <PageContainer>
        <PageHeader title="Mời thành viên" description="Mời thành viên tham gia tài khoản doanh nghiệp và phân quyền tuyển dụng." />
        <Card className="max-w-2xl">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Email" placeholder="member@example.com" />
            <Select label="Vai trò" options={["Recruiter", "Interviewer", "Recruitment Manager"].map((value) => ({ label: value, value }))} />
            <Select label="Tin tuyển dụng phụ trách" options={[{ label: "Frontend Developer", value: "job-1" }, { label: "Backend Developer", value: "job-2" }]} />
          </div>
          <div className="mt-5"><Button onClick={inviteMember}>Gửi lời mời</Button></div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Thành viên doanh nghiệp" description="Quản lý thành viên, vai trò, trạng thái và tin tuyển dụng phụ trách." />
      <div className="mb-5 flex justify-end"><Button onClick={inviteMember}>Mời thành viên</Button></div>
      <Table
        rows={members}
        getRowKey={(member) => member.id}
        columns={[
          { key: "name", header: "Thành viên", render: (member) => <div><p className="font-medium text-slate-900">{member.name}</p><p className="text-xs text-slate-500">{member.email}</p></div> },
          { key: "role", header: "Vai trò", render: (member) => member.role },
          { key: "status", header: "Trạng thái", render: (member) => <StatusBadge label={member.status === "active" ? "Đang hoạt động" : member.status === "locked" ? "Đã khóa" : "Đã mời"} tone={member.status === "active" ? "success" : member.status === "locked" ? "danger" : "warning"} /> },
          { key: "jobs", header: "Tin phụ trách", render: (member) => member.assignedJobs },
          { key: "actions", header: "Thao tác", render: (member) => <div className="flex gap-2"><Button variant="secondary" size="sm">Sửa vai trò</Button><Button variant="secondary" size="sm">Gán tin</Button><Button variant="danger" size="sm" onClick={() => setMembers((current) => current.map((item) => item.id === member.id ? { ...item, status: "locked" } : item))}>Khóa</Button></div> },
        ]}
      />
    </PageContainer>
  );
}
