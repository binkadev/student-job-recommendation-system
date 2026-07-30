import { isAxiosError } from "axios";
import { FileText, LockKeyhole, Mail, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
      showToast({ type: "success", title: "Đăng nhập thành công", message: "Phiên đăng nhập đã được xác thực." });
    } catch (error) {
      showToast({ type: "error", title: "Đăng nhập thất bại", message: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <Card className="mx-auto max-w-5xl overflow-hidden p-0">
        <div className="grid min-h-[430px] lg:grid-cols-[0.95fr_1.05fr]">
          <section className="flex items-center justify-center border-b border-slate-100 bg-slate-50 px-6 py-10 lg:border-b-0 lg:border-r">
            <div className="text-center">
              <div className="relative mx-auto h-52 w-64">
                <div className="absolute bottom-4 left-4 right-4 h-20 rounded-lg border border-brand-200 bg-white shadow-sm" />
                <div className="absolute bottom-9 left-8 right-8 h-24 rounded-lg border border-brand-300 bg-brand-50 shadow-sm">
                  <div className="mt-4 grid grid-cols-4 gap-2 px-4">
                    {Array.from({ length: 12 }).map((_, index) => <span key={index} className="h-3 rounded-sm bg-white" />)}
                  </div>
                </div>
                <div className="absolute left-20 top-4 h-28 w-20 rotate-[-10deg] rounded-md border border-brand-100 bg-white p-3 shadow-md">
                  <FileText className="text-brand-500" size={28} />
                  <div className="mt-4 space-y-2">
                    <span className="block h-2 rounded bg-brand-100" />
                    <span className="block h-2 rounded bg-slate-100" />
                    <span className="block h-2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="absolute left-28 top-1 h-32 w-20 rotate-[4deg] rounded-md border border-brand-200 bg-white p-3 shadow-lg">
                  <FileText className="text-brand-600" size={30} />
                  <div className="mt-4 space-y-2">
                    <span className="block h-2 rounded bg-brand-100" />
                    <span className="block h-2 rounded bg-slate-100" />
                    <span className="block h-2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="absolute left-36 top-7 h-28 w-20 rotate-[12deg] rounded-md border border-slate-200 bg-white p-3 shadow-md">
                  <FileText className="text-slate-500" size={28} />
                  <div className="mt-4 space-y-2">
                    <span className="block h-2 rounded bg-slate-200" />
                    <span className="block h-2 rounded bg-slate-100" />
                    <span className="block h-2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-7 right-7 h-3 rounded-full bg-slate-200" />
              </div>
              <h1 className="mt-5 text-2xl font-semibold text-brand-700">JobRecommend</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Kết nối sinh viên IT với công việc phù hợp từ CV và kỹ năng.</p>
            </div>
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
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Email</span>
                  <span className="mt-1 flex h-12 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                    <Mail size={18} className="text-slate-400" />
                    <input
                      name="email"
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
                      type="password"
                      placeholder="Nhập mật khẩu"
                      value={credentials.password}
                      onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                      className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                      required
                    />
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
