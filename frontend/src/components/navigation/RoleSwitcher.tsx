import { ShieldCheck, User, Users, LogOut, RotateCcw } from "lucide-react";
import { useAuth } from "../../app/providers/AuthProvider";
import { useToast } from "../../hooks/useToast";
import { resetMockStorage } from "../../utils/localStorage";

export function RoleSwitcher() {
  const { loginAsCandidate, loginAsRecruiter, loginAsAdmin, logout, currentRole } = useAuth();
  const { showToast } = useToast();

  function handleResetMockData() {
    resetMockStorage();
    showToast({
      type: "success",
      title: "Đã khôi phục dữ liệu mẫu",
      message: "Dữ liệu localStorage của prototype đã được xóa.",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={loginAsCandidate}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
      >
        <User size={16} />
        Ứng viên
      </button>
      <button
        onClick={loginAsRecruiter}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
      >
        <Users size={16} />
        Nhà tuyển dụng
      </button>
      <button
        onClick={loginAsAdmin}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
      >
        <ShieldCheck size={16} />
        Admin
      </button>
      {currentRole ? (
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
        >
          <LogOut size={16} />
          Đăng xuất
        </button>
      ) : null}
      <button
        onClick={handleResetMockData}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        <RotateCcw size={16} />
        Reset dữ liệu mẫu
      </button>
    </div>
  );
}
