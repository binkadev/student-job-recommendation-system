import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Tabs } from "../../components/ui/Tabs";
import { Textarea } from "../../components/ui/Textarea";
import { Timeline } from "../../components/ui/Timeline";
import { useAuth } from "../../app/providers/AuthProvider";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockAdminService } from "../../services/mock";
import type { EntityStatus, UserAccount } from "../../types/domain";
import { adminTone, entityStatusLabels } from "../../features/admin/adminLabels";

type ManagedUser = Omit<UserAccount, "status"> & {
  status: EntityStatus;
  emailVerified: boolean;
};

type UserAction = "lock" | null;

interface AuditLogItem {
  id: string;
  action: string;
  target: string;
  reason: string;
  at: string;
}

export function AdminUsersPage({ mode = "users" }: { mode?: "users" | "recruiters" | "detail" }) {
  const { userId, recruiterId } = useParams();
  const id = userId ?? recruiterId;
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const usersQuery = useAsyncData(() => mockAdminService.getUsers({ pageSize: 100 }), []);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(mode === "recruiters" ? "recruiter" : "");
  const [status, setStatus] = useState("");
  const [createdMonth, setCreatedMonth] = useState("");
  const [lastActiveMonth, setLastActiveMonth] = useState("");
  const [emailVerified, setEmailVerified] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState("account");
  const [actionTarget, setActionTarget] = useState<ManagedUser | null>(null);
  const [actionType, setActionType] = useState<UserAction>(null);
  const [actionReason, setActionReason] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  useEffect(() => {
    if (usersQuery.data?.items) {
      setUsers(usersQuery.data.items.map((user) => ({
        ...user,
        emailVerified: user.status === "active" || user.role === "admin",
      })));
    }
  }, [usersQuery.data?.items]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchQuery = !query || `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase());
    const matchRole = !role || user.role === role;
    const matchStatus = !status || user.status === status;
    const matchCreated = !createdMonth || user.createdAt.startsWith(createdMonth);
    const matchLastActive = !lastActiveMonth || user.lastLoginAt.startsWith(lastActiveMonth);
    const matchVerified = !emailVerified || String(user.emailVerified) === emailVerified;
    return matchQuery && matchRole && matchStatus && matchCreated && matchLastActive && matchVerified;
  }), [createdMonth, emailVerified, lastActiveMonth, query, role, status, users]);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / 8));
  const pagedUsers = filteredUsers.slice((page - 1) * 8, page * 8);
  const selectedUser = users.find((user) => user.id === id) ?? filteredUsers[0];

  async function updateUser(idToUpdate: string, payload: Partial<ManagedUser>, message: string, reason = "") {
    setUsers((current) => current.map((user) => user.id === idToUpdate ? { ...user, ...payload } : user));
    await mockAdminService.updateUser(idToUpdate, payload as Partial<UserAccount>);
    const target = users.find((user) => user.id === idToUpdate);
    addAuditLog(message, target?.email ?? idToUpdate, reason);
    showToast({ type: "success", title: message });
  }

  function addAuditLog(action: string, target: string, reason: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}`, action, target, reason, at: new Date().toISOString() }, ...current]);
  }

  function openAction(user: ManagedUser, action: UserAction) {
    if (action === "lock" && isSelf(user, currentUser?.email)) {
      showToast({ type: "error", title: "Không thể tự khóa tài khoản admin hiện tại" });
      return;
    }
    setActionTarget(user);
    setActionType(action);
    setActionReason("");
  }

  async function confirmAction() {
    if (!actionTarget || !actionType) return;
    if (!actionReason.trim()) {
      showToast({ type: "error", title: "Vui lòng nhập lý do" });
      return;
    }
    await updateUser(actionTarget.id, { status: "inactive" }, "Đã khóa tài khoản", actionReason);
    setActionTarget(null);
    setActionType(null);
  }

  async function bulkUpdate(nextStatus: EntityStatus) {
    const targets = users.filter((user) => selectedIds.includes(user.id));
    if (nextStatus === "inactive" && targets.some((user) => isSelf(user, currentUser?.email))) {
      showToast({ type: "error", title: "Không thể tự khóa tài khoản admin hiện tại" });
      return;
    }
    await Promise.all(targets.map((user) => updateUser(user.id, { status: nextStatus }, nextStatus === "active" ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản", "Bulk action")));
    setSelectedIds([]);
  }

  async function verifyEmail(user: ManagedUser) {
    await updateUser(user.id, { emailVerified: true }, "Đã xác thực email mock");
  }

  function resetPassword(user: ManagedUser) {
    addAuditLog("Reset mật khẩu mock", user.email, "Admin tạo yêu cầu reset mật khẩu mock");
    showToast({ type: "success", title: "Đã gửi reset mật khẩu mock" });
  }

  function exportCsv() {
    const rows = [
      ["id", "name", "email", "role", "createdAt", "lastLoginAt", "status", "emailVerified", "activityCount"],
      ...filteredUsers.map((user) => [user.id, user.name, user.email, user.role, user.createdAt, user.lastLoginAt, user.status, user.emailVerified, getActivityCount(user)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-users-filtered.csv";
    link.click();
    URL.revokeObjectURL(url);
    addAuditLog("Export CSV người dùng", `${filteredUsers.length} records`, "Export dữ liệu đang filter");
    showToast({ type: "success", title: "Đã export CSV" });
  }

  if (usersQuery.loading) return <PageContainer><LoadingState /></PageContainer>;

  if (mode === "detail" && selectedUser) {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết người dùng" description="Thông tin tài khoản, hồ sơ, lịch sử hoạt động, CV, đơn ứng tuyển và báo cáo liên quan." />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card>
            <Tabs items={[{ label: "Tài khoản", value: "account" }, { label: "Hồ sơ", value: "profile" }, { label: "Hoạt động", value: "activity" }, { label: "CV/Ứng tuyển", value: "data" }, { label: "Audit", value: "audit" }]} value={tab} onChange={setTab} />
            <div className="mt-5">
              {tab === "account" ? <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2"><p><strong>Tên:</strong> {selectedUser.name}</p><p><strong>Email:</strong> {selectedUser.email}</p><p><strong>Vai trò:</strong> {selectedUser.role}</p><p><strong>Ngày tạo:</strong> {formatDate(selectedUser.createdAt)}</p><p><strong>Lần đăng nhập cuối:</strong> {formatDateTime(selectedUser.lastLoginAt)}</p><p><strong>Email xác thực:</strong> {selectedUser.emailVerified ? "Đã xác thực" : "Chưa xác thực"}</p></div> : null}
              {tab === "profile" ? <UserProfilePanel user={selectedUser} /> : null}
              {tab === "activity" ? <Timeline items={[{ label: "Đăng nhập", at: selectedUser.lastLoginAt, note: "Người dùng đăng nhập hệ thống." }, { label: "Cập nhật hồ sơ", at: "2026-07-09", note: "Thay đổi thông tin cá nhân." }]} /> : null}
              {tab === "data" ? <p className="text-sm text-slate-700">CV, đơn ứng tuyển và báo cáo liên quan sẽ hiển thị ở đây.</p> : null}
              {tab === "audit" ? <AuditLogList logs={auditLogs.filter((log) => log.target === selectedUser.email)} /> : null}
            </div>
          </Card>
          <aside className="space-y-4">
            <Card><StatusBadge label={getUserStatusLabel(selectedUser.status)} tone={getUserTone(selectedUser.status)} /></Card>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => openAction(selectedUser, "lock")}>Khóa</Button>
              <Button variant="secondary" onClick={() => void updateUser(selectedUser.id, { status: "active" }, "Đã mở khóa tài khoản")}>Mở khóa</Button>
              <Button onClick={() => void verifyEmail(selectedUser)}>Xác thực email</Button>
              <Button variant="secondary" onClick={() => resetPassword(selectedUser)}>Reset mật khẩu</Button>
            </div>
          </aside>
        </div>
        <ReasonModal actionType={actionType} target={actionTarget} reason={actionReason} setReason={setActionReason} onClose={() => setActionTarget(null)} onConfirm={() => void confirmAction()} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={mode === "recruiters" ? "Quản lý nhà tuyển dụng" : "Quản lý người dùng"} description="Tìm kiếm, lọc người dùng, khóa/mở khóa, xác thực email, reset mật khẩu mock và ghi audit log." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input label="Search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
          <Select label="Role" value={role} onChange={(event) => setRole(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Ứng viên", value: "candidate" }, { label: "Nhà tuyển dụng", value: "recruiter" }, { label: "Quản trị viên", value: "admin" }]} />
          <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(entityStatusLabels).map(([value, label]) => ({ label, value }))]} />
          <Input label="Ngày đăng ký" type="month" value={createdMonth} onChange={(event) => setCreatedMonth(event.target.value)} />
          <Input label="Lần hoạt động cuối" type="month" value={lastActiveMonth} onChange={(event) => setLastActiveMonth(event.target.value)} />
          <Select label="Email xác thực" value={emailVerified} onChange={(event) => setEmailVerified(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Đã xác thực", value: "true" }, { label: "Chưa xác thực", value: "false" }]} />
        </div>
      </Card>

      {selectedIds.length ? (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">Đã chọn {selectedIds.length} người dùng</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => void bulkUpdate("inactive")}>Khóa</Button>
              <Button variant="secondary" size="sm" onClick={() => void bulkUpdate("active")}>Mở khóa</Button>
              <Button variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds([])}>Bỏ chọn</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Table
        rows={pagedUsers}
        getRowKey={(user) => user.id}
        columns={[
          { key: "select", header: "", render: (user) => <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} /> },
          { key: "user", header: "Người dùng", render: (user) => <UserSummary user={user} /> },
          { key: "role", header: "Phân quyền", render: (user) => <RoleSummary user={user} /> },
          { key: "time", header: "Thời gian", render: (user) => <TimeSummary user={user} /> },
          { key: "status", header: "Trạng thái", render: (user) => <StatusBadge label={getUserStatusLabel(user.status)} tone={getUserTone(user.status)} /> },
          { key: "activity", header: "Hoạt động", render: (user) => <ActivitySummary user={user} /> },
          { key: "actions", header: "Thao tác", render: (user) => <UserActions user={user} onLock={() => openAction(user, "lock")} onUnlock={() => void updateUser(user.id, { status: "active" }, "Đã mở khóa tài khoản")} /> },
        ]}
      />
      <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>

      <Card className="mt-5">
        <SectionHeader title="Audit log" description="Mọi action trên trang quản lý người dùng được ghi lại ở đây." />
        <AuditLogList logs={auditLogs} />
      </Card>

      <ReasonModal actionType={actionType} target={actionTarget} reason={actionReason} setReason={setActionReason} onClose={() => setActionTarget(null)} onConfirm={() => void confirmAction()} />
    </PageContainer>
  );
}

function UserSummary({ user }: { user: ManagedUser }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{user.name}</p>
      <p className="mt-1 text-xs text-slate-500">{user.email}</p>
      <p className="mt-1 text-xs text-slate-500">{user.emailVerified ? "Email đã xác thực" : "Email chưa xác thực"}</p>
    </div>
  );
}

function RoleSummary({ user }: { user: ManagedUser }) {
  return (
    <div className="min-w-[110px] text-sm text-slate-700">
      <p className="font-medium capitalize text-slate-900">{user.role}</p>
      <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>
    </div>
  );
}

function TimeSummary({ user }: { user: ManagedUser }) {
  return (
    <div className="min-w-[150px] space-y-1 text-xs text-slate-600">
      <p><span className="text-slate-500">Tạo:</span> {formatDate(user.createdAt)}</p>
      <p><span className="text-slate-500">Login:</span> {formatDateTime(user.lastLoginAt)}</p>
    </div>
  );
}

function ActivitySummary({ user }: { user: ManagedUser }) {
  return (
    <div className="min-w-[110px] text-sm text-slate-700">
      <p className="font-medium text-slate-900">{getActivityCount(user)} hoạt động</p>
      <p className="mt-1 text-xs text-slate-500">Liên quan hồ sơ</p>
    </div>
  );
}

function UserActions({ user, onLock, onUnlock }: { user: ManagedUser; onLock: () => void; onUnlock: () => void }) {
  return (
    <div className="flex min-w-[160px] flex-wrap gap-2">
      <Link to={`/admin/users/${user.id}`}><Button variant="secondary" size="sm">Chi tiết</Button></Link>
      {user.status === "inactive" ? <Button variant="secondary" size="sm" onClick={onUnlock}>Mở</Button> : <Button variant="secondary" size="sm" onClick={onLock}>Khóa</Button>}
    </div>
  );
}

function UserProfilePanel({ user }: { user: ManagedUser }) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  return (
    <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
      <Card>
        <SectionHeader title="Thông tin hồ sơ" />
        <div className="space-y-2">
          <p><strong>Họ tên:</strong> {user.name}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Vai trò:</strong> {roleLabel(user.role)}</p>
          <p><strong>Trạng thái:</strong> {getUserStatusLabel(user.status)}</p>
        </div>
      </Card>
      <Card>
        <SectionHeader title={isCandidate ? "Hồ sơ ứng viên" : isRecruiter ? "Hồ sơ recruiter" : "Hồ sơ quản trị"} />
        {isCandidate ? (
          <div className="space-y-2">
            <p><strong>Vị trí mong muốn:</strong> Frontend Developer</p>
            <p><strong>Kinh nghiệm:</strong> 2 năm</p>
            <p><strong>Kỹ năng:</strong> React, TypeScript, Tailwind CSS</p>
            <p><strong>CV:</strong> Nguyen-Van-An-Frontend-CV.pdf</p>
          </div>
        ) : isRecruiter ? (
          <div className="space-y-2">
            <p><strong>Công ty:</strong> Công ty TNHH Công nghệ NovaTech</p>
            <p><strong>Chức danh:</strong> Recruiter</p>
            <p><strong>Tin đang quản lý:</strong> 5 tin tuyển dụng</p>
            <p><strong>Ứng viên phụ trách:</strong> 27 hồ sơ</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p><strong>Nhóm quyền:</strong> Super Admin</p>
            <p><strong>Phạm vi:</strong> Quản trị toàn hệ thống</p>
            <p><strong>Hoạt động gần nhất:</strong> Kiểm duyệt báo cáo và audit log</p>
          </div>
        )}
      </Card>
      <Card className="md:col-span-2">
        <SectionHeader title="Tóm tắt hoạt động liên quan" />
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="Hoạt động" value={getActivityCount(user)} />
          <Metric label="Lần đăng nhập cuối" value={formatDateTime(user.lastLoginAt)} />
          <Metric label="Email" value={user.emailVerified ? "Đã xác thực" : "Chưa xác thực"} />
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-medium text-slate-900">{value}</p></div>;
}

function ReasonModal({ actionType, target, reason, setReason, onClose, onConfirm }: { actionType: UserAction; target: ManagedUser | null; reason: string; setReason: (value: string) => void; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open={Boolean(target && actionType)} title="Khóa tài khoản" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">Vui lòng nhập lý do khóa tài khoản.</p>
        <p className="text-sm text-slate-700"><strong>{target?.name}</strong> - {target?.email}</p>
        <Textarea label="Lý do" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button onClick={onConfirm}>Xác nhận khóa</Button>
        </div>
      </div>
    </Modal>
  );
}

function AuditLogList({ logs }: { logs: AuditLogItem[] }) {
  if (!logs.length) return <p className="text-sm text-slate-500">Chưa có audit log trong phiên làm việc này.</p>;
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">{log.action}</p>
          <p className="mt-1 text-xs text-slate-500">{log.target} • {formatDateTime(log.at)}</p>
          {log.reason ? <p className="mt-1">{log.reason}</p> : null}
        </div>
      ))}
    </div>
  );
}

function getUserStatusLabel(status: ManagedUser["status"]) {
  return entityStatusLabels[status];
}

function getUserTone(status: ManagedUser["status"]) {
  return adminTone(status);
}

function roleLabel(role: ManagedUser["role"]) {
  if (role === "candidate") return "Ứng viên";
  if (role === "recruiter") return "Nhà tuyển dụng";
  return "Quản trị viên";
}

function getActivityCount(user: ManagedUser) {
  return user.role === "candidate" ? 18 : user.role === "recruiter" ? 27 : 42;
}

function isSelf(user: ManagedUser, currentEmail?: string) {
  return user.email === currentEmail || user.email === "admin@example.com";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
