import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";

type UserRole = "STUDENT" | "COMPANY" | "ADMIN";
type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "REJECTED";

interface AdminUserRow {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

const roleLabels: Record<UserRole, string> = {
  STUDENT: "Ứng viên",
  COMPANY: "Nhà tuyển dụng",
  ADMIN: "Quản trị viên",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm khóa",
  PENDING: "Chờ duyệt",
  REJECTED: "Từ chối",
};

export function AdminUsersPage({ mode = "users" }: { mode?: "users" | "recruiters" | "detail" }) {
  const { userId, recruiterId } = useParams();
  const id = userId ?? recruiterId;
  const [filters, setFilters] = useState({
    fullName: "",
    role: mode === "recruiters" ? "COMPANY" : "",
    sort: "newest",
    status: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  if (mode === "detail") {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết người dùng" description="Backend chưa có API admin lấy chi tiết user theo ID." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <SectionHeader title="Chưa có API detail" />
            <EmptyState message="Hiện backend chưa có GET /api/admin/users/{id}. Khi có API, trang này sẽ hiển thị dữ liệu từ bảng users và các bảng profile liên quan." />
            <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <Info label="User ID từ URL" value={id ?? "Không có"} />
              <Info label="Bảng DB" value="users" />
              <Info label="Không hiển thị" value="password_hash" />
              <Info label="Dữ liệu hiện hiển thị" value="0" />
            </div>
          </Card>
          <UserFieldsCard />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "recruiters" ? "Quản lý nhà tuyển dụng" : "Quản lý người dùng"}
        description="Trang giữ khung quản trị theo bảng users. Backend hiện chưa có API admin list/update users."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Họ tên" value={filters.fullName} onChange={(event) => updateFilter("fullName", event.target.value)} placeholder="full_name" disabled />
          <Select label="Role" value={filters.role} onChange={(event) => updateFilter("role", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(roleLabels).map(([value, label]) => ({ value, label }))]} disabled={mode === "recruiters"} />
          <Select label="Sắp xếp" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)} options={[{ label: "Mới nhất", value: "newest" }, { label: "Cũ nhất", value: "oldest" }]} disabled />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Đang hoạt động", value: "ACTIVE" }, { label: "Đã khóa", value: "INACTIVE" }]} disabled />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng người dùng: 0</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Backend chưa có endpoint admin để lấy danh sách, khóa/mở khóa, reset mật khẩu hoặc xác thực email người dùng.</p>
      </Card>

      <Table
        rows={[] as AdminUserRow[]}
        getRowKey={(user) => String(user.id)}
        columns={[
          { key: "user", header: "Người dùng", render: (user) => <UserSummary user={user} /> },
          { key: "contact", header: "Liên hệ", render: (user) => <ContactSummary user={user} /> },
          { key: "role", header: "Role", render: (user) => <StatusBadge label={roleLabels[user.role]} /> },
          { key: "status", header: "Status", render: (user) => <StatusBadge label={statusLabels[user.status]} tone={getStatusTone(user.status)} /> },
          { key: "time", header: "Thời gian", render: (user) => <TimeSummary user={user} /> },
        ]}
      />
      <div className="mt-4">
        <EmptyState message="Chưa có API admin users nên bảng đang hiển thị 0 dòng, không dùng dữ liệu mock." />
      </div>
    </PageContainer>
  );
}

function UserFieldsCard() {
  return (
    <Card>
      <SectionHeader title="Field DB cần hiển thị khi có API" />
      <div className="flex flex-wrap gap-2">
        {["id", "email", "full_name", "phone", "role", "status", "created_at", "updated_at", "last_login_at"].map((field) => <StatusBadge key={field} label={field} />)}
      </div>
      <p className="mt-4 text-sm text-slate-600">Không hiển thị `password_hash` trên frontend.</p>
    </Card>
  );
}

function UserSummary({ user }: { user: AdminUserRow }) {
  return (
    <div className="min-w-[200px]">
      <p className="font-medium text-slate-900">{user.fullName}</p>
      <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>
    </div>
  );
}

function ContactSummary({ user }: { user: AdminUserRow }) {
  return (
    <div className="min-w-[180px] space-y-1 text-xs text-slate-600">
      <p>{user.email}</p>
      <p>{user.phone || "Chưa cập nhật"}</p>
    </div>
  );
}

function TimeSummary({ user }: { user: AdminUserRow }) {
  return (
    <div className="min-w-[150px] space-y-1 text-xs text-slate-600">
      <p><span className="text-slate-500">Tạo:</span> {formatDateTime(user.createdAt)}</p>
      <p><span className="text-slate-500">Cập nhật:</span> {formatDateTime(user.updatedAt)}</p>
      <p><span className="text-slate-500">Login:</span> {formatDateTime(user.lastLoginAt)}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getStatusTone(status: UserStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  if (status === "INACTIVE" || status === "REJECTED") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
