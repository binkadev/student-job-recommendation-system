import { isAxiosError } from "axios";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
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

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? "Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.";
  }
  return "Không thể đăng nhập. Vui lòng thử lại.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });

  useEffect(() => {
    const state = location.state as { registrationSuccess?: boolean; title?: string; message?: string } | null;
    const storedMessage = window.sessionStorage.getItem("registrationSuccessMessage");
    const storedTitle = window.sessionStorage.getItem("registrationSuccessTitle");
    if (!state?.registrationSuccess && !storedMessage) return;

    showToast({
      type: "success",
      title: state?.title ?? storedTitle ?? "Đăng ký thành công",
      message: state?.message ?? storedMessage ?? "Vui lòng đăng nhập bằng email và mật khẩu vừa đăng ký.",
    });
    window.sessionStorage.removeItem("registrationSuccessMessage");
    window.sessionStorage.removeItem("registrationSuccessTitle");
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, showToast]);

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
              value={credentials.email}
              onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
              required
            />
            <Input
              name="password"
              label="Mật khẩu"
              type="password"
              placeholder="Nhập mật khẩu"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
              required
            />
            <Button type="submit" className="w-full" loading={loading}>
              Đăng nhập
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Truy cập theo vai trò</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Hệ thống sẽ tự điều hướng đến trang ứng viên, nhà tuyển dụng hoặc quản trị viên theo role backend trả về sau khi đăng nhập thành công.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Nếu chưa có tài khoản, hãy đăng ký ứng viên hoặc nhà tuyển dụng từ thanh điều hướng phía trên.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
