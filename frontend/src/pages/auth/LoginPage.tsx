import { isAxiosError } from "axios";
import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { RoleSwitcher } from "../../components/navigation/RoleSwitcher";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../hooks/useToast";
import type { UserRole } from "../../types/auth";

const dashboardByRole: Record<UserRole, string> = {
  candidate: "/candidate/dashboard",
  recruiter: "/recruiter/dashboard",
  admin: "/admin/dashboard",
};

const demoAccounts = [
  { label: "Ứng viên", email: "candidate@example.com", password: "123456" },
  { label: "Nhà tuyển dụng", email: "recruiter@example.com", password: "123456" },
  { label: "Quản trị viên", email: "admin@example.com", password: "123456" },
];

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? "Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.";
  }
  return "Không thể đăng nhập. Vui lòng thử lại.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [prefill, setPrefill] = useState({ email: "", password: "" });

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(dashboardByRole[user.role]);
      showToast({ type: "success", title: "Đăng nhập thành công", message: "Phiên đăng nhập đã được xác thực bằng backend." });
    } catch (error) {
      showToast({ type: "error", title: "Đăng nhập thất bại", message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  function fillDemoAccount(account: (typeof demoAccounts)[number]) {
    setPrefill({ email: account.email, password: account.password });
  }

  return (
    <PageContainer>
      <PageHeader title="Đăng nhập" description="Nhập email và mật khẩu để truy cập hệ thống." />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <form className="space-y-4" onSubmit={submitLogin}>
            <Input
              name="email"
              label="Email"
              type="email"
              placeholder="email@example.com"
              value={prefill.email}
              onChange={(event) => setPrefill((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <Input
              name="password"
              label="Mật khẩu"
              type="password"
              placeholder="Nhập mật khẩu"
              value={prefill.password}
              onChange={(event) => setPrefill((current) => ({ ...current, password: event.target.value }))}
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Đăng nhập
            </Button>
          </form>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {demoAccounts.map((account) => (
              <Button key={account.email} type="button" variant="secondary" onClick={() => fillDemoAccount(account)}>
                {account.label}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Tài khoản demo</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p><strong>Ứng viên:</strong> candidate@example.com / 123456</p>
            <p><strong>Nhà tuyển dụng:</strong> recruiter@example.com / 123456</p>
            <p><strong>Quản trị viên:</strong> admin@example.com / 123456</p>
          </div>
          <div className="mt-5">
            <RoleSwitcher />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
