import { getApiErrorMessage } from "../../utils/apiErrors";
import { Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MatchingIllustration } from "../../components/common/AuroraHero";
import { PageContainer } from "../../components/common/PageContainer";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import type { UserRole } from "../../types/auth";

const dashboardByRole: Record<UserRole, string> = {
  candidate: "/candidate/dashboard",
  recruiter: "/recruiter/dashboard",
  admin: "/admin/dashboard",
};

function getErrorMessage(error: unknown) {
  return getApiErrorMessage(error, "Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.");
}

export function LoginPage() {
  const errorRef = useRef<HTMLParagraphElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
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

  useEffect(() => { if (loginError) errorRef.current?.focus(); }, [loginError]);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    setLoginError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(dashboardByRole[user.role]);
      showToast({ type: "success", title: "Đăng nhập thành công", message: "Phiên đăng nhập đã được xác thực." });
    } catch (error) {
      setLoginError(getErrorMessage(error));
      showToast({ type: "error", title: "Đăng nhập thất bại", message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <Card padding="none" className="mx-auto max-w-5xl overflow-hidden">
        <div className="grid min-h-[430px] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="neo-auth-visual flex flex-col justify-center overflow-hidden px-6 py-10 sm:px-10">
            <p className="aurora-eyebrow">JOBRECOMMEND · CƠ HỘI TỪ KỸ NĂNG</p>
            <h1 className="mt-5 text-3xl font-semibold leading-snug">Bước tiếp theo,<br />bắt đầu từ bạn.</h1>
            <p className="aurora-description mt-4 text-sm leading-7">Quản lý CV, hiểu kết quả đối sánh và theo dõi hành trình ứng tuyển trong cùng một không gian.</p>
            <MatchingIllustration />
          </section>

          <section className="flex items-center px-6 py-10 sm:px-10">
            <div className="w-full">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                  <Sparkles size={16} />
                  Đăng nhập hệ thống
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">Chào mừng bạn quay lại</h2>
                <p className="mt-2 text-sm text-slate-600">Nhập email và mật khẩu để truy cập đúng vai trò tài khoản.</p>
              </div>

              <form className="space-y-4" onSubmit={submitLogin}>
                {loginError ? <p ref={errorRef} tabIndex={-1} id="login-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{loginError}</p> : null}
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Email</span>
                  <span className="mt-1 flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                    <Mail size={18} className="text-slate-400" />
                    <input
                      name="email"
                      autoComplete="username"
                      aria-describedby={loginError ? "login-error" : undefined}
                      type="email"
                      placeholder="email@example.com"
                      value={credentials.email}
                      onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      required
                    />
                  </span>
                </label>

                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Mật khẩu</span>
                  <span className="mt-1 flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                    <LockKeyhole size={18} className="text-slate-400" />
                    <input
                      name="password"
                      autoComplete="current-password"
                      aria-describedby={loginError ? "login-error" : undefined}
                      type={showPassword ? "text" : "password"}
                      placeholder="Nhập mật khẩu"
                      value={credentials.password}
                      onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>

                <Button type="submit" className="w-full" loading={loading}>
                  Đăng nhập
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-slate-600">
                Bạn chưa có tài khoản?{" "}
                <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </section>
        </div>
      </Card>
    </PageContainer>
  );
}
