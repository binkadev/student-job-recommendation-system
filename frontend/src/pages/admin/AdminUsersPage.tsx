import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type UserRole = "STUDENT" | "COMPANY" | "ADMIN";
type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

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

interface AdminUserDetail extends AdminUserRow {
  studentProfile?: Record<string, unknown> | null;
  companyProfile?: Record<string, unknown> | null;
}

const roleLabels: Record<UserRole, string> = {
  STUDENT: "Ứng viên",
  COMPANY: "Nhà tuyển dụng",
  ADMIN: "Quản trị viên",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  BLOCKED: "Đã khóa",
};

export function AdminUsersPage({ mode = "users" }: { mode?: "users" | "recruiters" | "detail" }) {
  const { userId, recruiterId } = useParams();
  const id = Number(userId ?? recruiterId);

  if (mode === "detail" && Number.isFinite(id)) {
    return <AdminUserDetailPage userId={id} />;
  }

  return <AdminUsersListPage mode={mode} />;
}

function AdminUsersListPage({ mode }: { mode: "users" | "recruiters" | "detail" }) {
  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState({
    fullName: "",
    role: mode === "recruiters" ? "COMPANY" : "",
    sort: "createdAt,desc",
    status: "",
  });
  const [targetUser, setTargetUser] = useState<AdminUserRow | null>(null);
  const [nextStatus, setNextStatus] = useState<UserStatus>("ACTIVE");
  const [updating, setUpdating] = useState(false);
  const usersQuery = useAsyncData(() => getAdminUsers(filters, page), [filters, page, reloadKey]);
  const result = usersQuery.data;

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  async function updateStatus() {
    if (!targetUser) return;
    setUpdating(true);
    try {
      await updateAdminUserStatus(targetUser.id, nextStatus);
      setTargetUser(null);
      setReloadKey((current) => current + 1);
      showToast({ type: "success", title: "Đã cập nhật trạng thái người dùng" });
    } catch (error) {
      showToast({ type: "error", title: "Không thể cập nhật trạng thái", message: getErrorMessage(error) });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={mode === "recruiters" ? "Quản lý nhà tuyển dụng" : "Quản lý người dùng"}
        description="Dữ liệu lấy từ GET /api/admin/users theo các trường users trong DB."
      />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Họ tên" value={filters.fullName} onChange={(event) => updateFilter("fullName", event.target.value)} placeholder="Nhập họ tên" />
          <Select label="Role" value={filters.role} onChange={(event) => updateFilter("role", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(roleLabels).map(([value, label]) => ({ value, label }))]} disabled={mode === "recruiters"} />
          <Select label="Sắp xếp" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)} options={[{ label: "Mới nhất", value: "createdAt,desc" }, { label: "Cũ nhất", value: "createdAt,asc" }]} />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Đang hoạt động", value: "ACTIVE" }, { label: "Tạm ngưng", value: "INACTIVE" }, { label: "Đã khóa", value: "BLOCKED" }]} />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng người dùng: {result?.totalItems ?? 0}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Admin có thể xem danh sách, chi tiết và cập nhật trạng thái bằng API backend hiện có.</p>
      </Card>

      {usersQuery.loading ? <LoadingState /> : null}
      {!usersQuery.loading && usersQuery.error ? <EmptyState message={usersQuery.error} /> : null}
      {!usersQuery.loading && !usersQuery.error && (result?.items.length ?? 0) === 0 ? <EmptyState message="Không có người dùng phù hợp." /> : null}
      {!usersQuery.loading && result?.items.length ? (
        <div className="space-y-4">
          <Table
            rows={result.items}
            getRowKey={(user) => String(user.id)}
            columns={[
              { key: "user", header: "Người dùng", render: (user) => <UserSummary user={user} /> },
              { key: "contact", header: "Liên hệ", render: (user) => <ContactSummary user={user} /> },
              { key: "role", header: "Role", render: (user) => <StatusBadge label={roleLabels[user.role]} /> },
              { key: "status", header: "Status", render: (user) => <StatusBadge label={statusLabels[user.status]} tone={getStatusTone(user.status)} /> },
              { key: "time", header: "Thời gian", render: (user) => <TimeSummary user={user} /> },
              { key: "actions", header: "Thao tác", render: (user) => (
                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/users/${user.id}`}><Button variant="secondary" size="sm">Chi tiết</Button></Link>
                  <Button variant="secondary" size="sm" onClick={() => { setTargetUser(user); setNextStatus(user.status); }}>Trạng thái</Button>
                </div>
              ) },
            ]}
          />
          <Pagination page={result.page} totalPages={Math.max(result.totalPages, 1)} onPageChange={setPage} />
        </div>
      ) : null}

      <Modal open={Boolean(targetUser)} title="Cập nhật trạng thái người dùng" onClose={() => setTargetUser(null)}>
        {targetUser ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Cập nhật trạng thái cho <strong>{targetUser.fullName}</strong>.</p>
            <Select label="Trạng thái" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as UserStatus)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTargetUser(null)}>Hủy</Button>
              <Button loading={updating} onClick={() => void updateStatus()}>Cập nhật</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

function AdminUserDetailPage({ userId }: { userId: number }) {
  const userQuery = useAsyncData(() => getAdminUser(userId), [userId]);

  if (userQuery.loading) return <PageContainer><LoadingState /></PageContainer>;
  if (userQuery.error || !userQuery.data) return <PageContainer><EmptyState message={userQuery.error ?? "Không tìm thấy người dùng."} /></PageContainer>;

  const user = userQuery.data;
  const profile = user.studentProfile ?? user.companyProfile;

  return (
    <PageContainer>
      <PageHeader title={user.fullName} description={`Chi tiết user ID ${user.id} từ GET /api/admin/users/${user.id}.`} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <SectionHeader title="Thông tin người dùng" />
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <Info label="Email" value={user.email} />
            <Info label="Số điện thoại" value={user.phone ?? "Chưa cập nhật"} />
            <Info label="Role" value={roleLabels[user.role]} />
            <Info label="Trạng thái" value={statusLabels[user.status]} />
            <Info label="Tạo lúc" value={formatDateTime(user.createdAt)} />
            <Info label="Cập nhật" value={formatDateTime(user.updatedAt)} />
            <Info label="Đăng nhập cuối" value={formatDateTime(user.lastLoginAt)} />
          </div>
        </Card>
        <Card>
          <SectionHeader title="Profile liên quan" />
          {profile ? <pre className="overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(profile, null, 2)}</pre> : <EmptyState message="User chưa có profile liên quan." />}
        </Card>
      </div>
    </PageContainer>
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

async function getAdminUsers(filters: { fullName: string; role: string; sort: string; status: string }, page: number) {
  const response = await httpClient.get<ApiResponse<PageResponse<AdminUserRow>>>("/admin/users", {
    params: {
      page,
      size: 10,
      fullName: filters.fullName || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      sort: filters.sort,
    },
  });
  return response.data.data;
}

async function getAdminUser(userId: number) {
  const response = await httpClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${userId}`);
  return response.data.data;
}

async function updateAdminUserStatus(userId: number, status: UserStatus) {
  const response = await httpClient.patch<ApiResponse<AdminUserRow>>(`/admin/users/${userId}/status`, { status });
  return response.data.data;
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

function getStatusTone(status: UserStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "INACTIVE") return "warning" as const;
  if (status === "BLOCKED") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message ?? "Vui lòng thử lại.";
  }
  return "Vui lòng thử lại.";
}
