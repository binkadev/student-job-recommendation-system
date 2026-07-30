import { isAxiosError } from "axios";
import { BriefcaseBusiness, Building2, CheckCircle2, FileText, GraduationCap, Sparkles, UserRoundSearch } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { registerRequest } from "../../services/auth/authService";
import type { RegisterRequest } from "../../types/auth";

interface AuthFlowPageProps {
  type: "register" | "candidate" | "recruiter" | "forgot" | "reset";
}

const copy = {
  register: {
    title: "Đăng ký tài khoản",
    description: "Chọn loại tài khoản để bắt đầu sử dụng hệ thống.",
  },
  candidate: {
    title: "Đăng ký ứng viên",
    description: "Tạo tài khoản ứng viên. Sau khi đăng ký thành công, bạn cần đăng nhập lại bằng thông tin vừa tạo.",
  },
  recruiter: {
    title: "Đăng ký doanh nghiệp",
    description: "Tạo tài khoản doanh nghiệp. Sau khi đăng ký thành công, bạn cần đăng nhập lại bằng thông tin vừa tạo.",
  },
  forgot: {
    title: "Quên mật khẩu",
    description: "Nhập email để nhận hướng dẫn đặt lại mật khẩu.",
  },
  reset: {
    title: "Đặt lại mật khẩu",
    description: "Thiết lập mật khẩu mới cho tài khoản.",
  },
};

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? "Không thể xử lý yêu cầu. Vui lòng kiểm tra lại thông tin.";
  }
  return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

export function AuthFlowPage({ type }: AuthFlowPageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { logout } = useAuth();
  const page = copy[type];
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (type === "candidate" || type === "recruiter") {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      const phone = String(formData.get("phone") ?? "").trim();
      const fullName = type === "candidate" ? String(formData.get("fullName") ?? "").trim() : String(formData.get("contactName") ?? "").trim();
      const companyName = String(formData.get("companyName") ?? "").trim();
      const missingField = !email || !password || !confirmPassword || (type === "candidate" ? !fullName : !companyName);

      if (missingField) {
        showToast({ type: "error", title: "Vui lòng nhập đầy đủ thông tin" });
        return;
      }
      if (password.length < 6) {
        showToast({ type: "error", title: "Mật khẩu phải có ít nhất 6 ký tự" });
        return;
      }
      if (password !== confirmPassword) {
        showToast({ type: "error", title: "Xác nhận mật khẩu không khớp" });
        return;
      }

      const payload: RegisterRequest = {
        email,
        password,
        role: type === "candidate" ? "STUDENT" : "COMPANY",
        fullName: type === "candidate" ? fullName : fullName || companyName,
        phone: phone || undefined,
        companyName: type === "recruiter" ? companyName : undefined,
      };

      setLoading(true);
      try {
        await registerRequest(payload);
        const successTitle = type === "recruiter" ? "Đăng ký doanh nghiệp thành công" : "Đăng ký ứng viên thành công";
        window.sessionStorage.setItem("registrationSuccessMessage", "Vui lòng đăng nhập bằng email và mật khẩu vừa đăng ký.");
        window.sessionStorage.setItem("registrationSuccessTitle", successTitle);
        logout();
        navigate("/login", {
          replace: true,
          state: {
            registrationSuccess: true,
            title: successTitle,
            message: "Vui lòng đăng nhập bằng email và mật khẩu vừa đăng ký.",
          },
        });
      } catch (error) {
        showToast({ type: "error", title: "Đăng ký thất bại", message: getErrorMessage(error) });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (type === "reset") {
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");
      if (!password || password !== confirmPassword) {
        showToast({ type: "error", title: "Vui lòng kiểm tra lại mật khẩu" });
        return;
      }
    }

    showToast({ type: "success", title: "Đã ghi nhận thông tin", message: "Chức năng sẽ được xử lý khi sẵn sàng." });
  }

  if (type === "register") {
    return (
      <PageContainer>
        <Card className="mx-auto max-w-6xl overflow-hidden p-0">
          <div className="grid min-h-[520px] lg:grid-cols-[1fr_1.05fr]">
            <section className="relative overflow-hidden border-b border-slate-100 bg-brand-50 px-6 py-10 text-slate-950 lg:border-b-0 lg:border-r">
              <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-brand-200/60 blur-2xl" />
              <div className="absolute bottom-10 right-8 h-32 w-32 rounded-full bg-slate-200/70 blur-2xl" />
              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
                    <Sparkles size={16} />
                    Nền tảng tuyển dụng IT
                  </div>
                  <h1 className="mt-5 text-3xl font-semibold leading-tight">Tạo tài khoản và bắt đầu kết nối cơ hội phù hợp</h1>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
                    JobRecommend hỗ trợ ứng viên quản lý CV, tìm việc làm phù hợp và giúp doanh nghiệp tiếp cận ứng viên IT đúng nhu cầu.
                  </p>
                </div>

                <div className="mt-8">
                  <div className="relative mx-auto h-56 max-w-sm">
                    <div className="absolute bottom-0 left-4 right-4 h-24 rounded-lg bg-white shadow-sm" />
                    <div className="absolute bottom-6 left-8 right-8 rounded-lg border border-brand-100 bg-white p-4 shadow-sm">
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }).map((_, index) => <span key={index} className="h-3 rounded bg-brand-100" />)}
                      </div>
                    </div>
                    <CvSheet className="left-20 top-4 rotate-[-10deg]" icon={<GraduationCap size={26} />} title="Student CV" tone="text-brand-500" />
                    <CvSheet className="left-36 top-0 rotate-[4deg]" icon={<FileText size={26} />} title="Profile" tone="text-brand-600" />
                    <CvSheet className="left-52 top-8 rotate-[12deg]" icon={<UserRoundSearch size={26} />} title="Match" tone="text-slate-500" />
                  </div>
                </div>
              </div>
            </section>

            <section className="px-6 py-10 sm:px-10">
              <PageHeader title="Đăng ký tài khoản" description="Chọn loại tài khoản phù hợp để bắt đầu sử dụng hệ thống." />

              <div className="grid gap-4 sm:grid-cols-2">
                <Link to="/register/candidate" className="group">
                  <div className="h-full rounded-lg border border-brand-100 bg-brand-50 p-5 transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:bg-white hover:shadow-md">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white">
                      <GraduationCap size={22} />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-950">Tôi là ứng viên</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Tạo hồ sơ, tải CV, lưu việc làm và ứng tuyển các vị trí IT đang tuyển.</p>
                    <span className="mt-5 inline-flex text-sm font-semibold text-brand-700 group-hover:text-brand-800">Đăng ký ứng viên</span>
                  </div>
                </Link>

                <Link to="/register/recruiter" className="group">
                  <div className="h-full rounded-lg border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-md">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Building2 size={22} />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-950">Tôi là doanh nghiệp</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Tạo tài khoản công ty, đăng tin tuyển dụng và theo dõi hồ sơ ứng viên.</p>
                    <span className="mt-5 inline-flex text-sm font-semibold text-brand-700 group-hover:text-brand-800">Đăng ký doanh nghiệp</span>
                  </div>
                </Link>
              </div>

              <div className="mt-6 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-3">
                {["Tìm việc theo kỹ năng", "Theo dõi ứng tuyển", "Kết nối doanh nghiệp"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={17} className="text-brand-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-center text-sm text-slate-600">
                Bạn đã có tài khoản?{" "}
                <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">
                  Đăng nhập
                </Link>
              </p>
            </section>
          </div>
        </Card>
      </PageContainer>
    );
  }

  if (type === "candidate" || type === "recruiter") {
    const isCandidate = type === "candidate";
    const benefits = isCandidate
      ? ["Tạo tài khoản ứng viên", "Quản lý CV và hồ sơ", "Lưu việc làm quan tâm", "Theo dõi trạng thái ứng tuyển"]
      : ["Tạo tài khoản doanh nghiệp", "Quản lý hồ sơ công ty", "Đăng tin tuyển dụng", "Theo dõi hồ sơ ứng viên"];

    return (
      <PageContainer>
        <Card className="mx-auto max-w-6xl overflow-hidden p-0">
          <div className="grid lg:grid-cols-[360px_1fr]">
            <section className="relative overflow-hidden border-b border-slate-100 bg-brand-50 p-6 lg:border-b-0 lg:border-r lg:p-8">
              <div className="absolute left-8 top-8 h-24 w-24 rounded-full bg-brand-200/60 blur-2xl" />
              <div className="absolute bottom-10 right-8 h-28 w-28 rounded-full bg-slate-200/70 blur-2xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
                  {isCandidate ? <GraduationCap size={16} /> : <Building2 size={16} />}
                  {isCandidate ? "Ứng viên IT" : "Doanh nghiệp tuyển dụng"}
                </div>
                <h1 className="mt-5 text-2xl font-semibold leading-tight text-slate-950">{page.title}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">{page.description}</p>

                <div className="mt-8">
                  <div className="relative mx-auto h-52 w-72 max-w-full">
                    <div className="absolute bottom-3 left-6 right-6 h-20 rounded-lg bg-white shadow-sm" />
                    <div className="absolute bottom-8 left-10 right-10 rounded-lg border border-brand-100 bg-white p-3 shadow-sm">
                      <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 9 }).map((_, index) => <span key={index} className="h-2 rounded bg-brand-100" />)}
                      </div>
                    </div>
                    <CvSheet className="left-10 top-5 rotate-[-8deg]" icon={isCandidate ? <FileText size={26} /> : <Building2 size={26} />} title={isCandidate ? "CV" : "Company"} tone="text-brand-500" />
                    <CvSheet className="left-28 top-1 rotate-[4deg]" icon={isCandidate ? <GraduationCap size={26} /> : <BriefcaseBusiness size={26} />} title={isCandidate ? "Profile" : "Jobs"} tone="text-brand-600" />
                    <CvSheet className="left-44 top-7 rotate-[10deg]" icon={<UserRoundSearch size={26} />} title="Match" tone="text-slate-500" />
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {benefits.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle2 size={17} className="text-brand-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="p-6 lg:p-8">
              <PageHeader title={page.title} description={isCandidate ? "Điền thông tin cơ bản để tạo hồ sơ ứng viên." : "Điền thông tin cơ bản để tạo tài khoản doanh nghiệp."} />
              <form className="space-y-4" onSubmit={submit}>
                {isCandidate ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input name="email" label="Email" type="email" placeholder="ungvien@example.com" required />
                    <Input name="fullName" label="Họ và tên" placeholder="Nguyễn Văn An" required />
                    <Input name="phone" label="Số điện thoại" placeholder="0901234567" />
                    <Input name="password" label="Mật khẩu" type="password" minLength={6} required />
                    <div className="md:col-span-2">
                      <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input name="email" label="Email doanh nghiệp" type="email" placeholder="hr@congty.vn" required />
                    <Input name="companyName" label="Tên công ty" placeholder="Công ty TNHH Công nghệ NovaTech" required />
                    <Input name="contactName" label="Tên người đại diện" placeholder="Trần Thị Bình" />
                    <Input name="phone" label="Số điện thoại" placeholder="0901234567" />
                    <Input name="taxCode" label="Mã số thuế" placeholder="0312345678" disabled />
                    <Input name="password" label="Mật khẩu" type="password" minLength={6} required />
                    <div className="md:col-span-2">
                      <Textarea name="companyIntro" label="Giới thiệu ngắn" placeholder="Cập nhật thông tin này trong hồ sơ công ty sau khi đăng nhập." disabled />
                    </div>
                    <div className="md:col-span-2">
                      <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" loading={loading}>
                  Đăng ký
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-slate-600">
                Muốn chọn loại tài khoản khác?{" "}
                <Link to="/register" className="font-semibold text-brand-700 hover:text-brand-800">
                  Quay lại
                </Link>
              </p>
            </section>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const fallbackType = type as AuthFlowPageProps["type"];

  return (
    <PageContainer>
      <PageHeader title={page.title} description={page.description} />
      <Card className="max-w-2xl">
        <form className="space-y-4" onSubmit={submit}>
            {fallbackType === "candidate" ? (
              <>
                <Input name="email" label="Email" type="email" placeholder="ungvien@example.com" required />
                <Input name="fullName" label="Họ và tên" placeholder="Nguyễn Văn An" required />
                <Input name="phone" label="Số điện thoại" placeholder="0901234567" />
                <Input name="password" label="Mật khẩu" type="password" minLength={6} required />
                <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
              </>
            ) : null}

            {fallbackType === "recruiter" ? (
              <>
                <Input name="email" label="Email doanh nghiệp" type="email" placeholder="hr@congty.vn" required />
                <Input name="companyName" label="Tên công ty" placeholder="Công ty TNHH Công nghệ NovaTech" required />
                <Input name="contactName" label="Tên người đại diện" placeholder="Trần Thị Bình" />
                <Input name="phone" label="Số điện thoại" placeholder="0901234567" />
                <Input name="taxCode" label="Mã số thuế" placeholder="0312345678" disabled />
                <Textarea name="companyIntro" label="Giới thiệu ngắn" placeholder="Cập nhật thông tin này trong hồ sơ công ty sau khi đăng nhập." disabled />
                <Input name="password" label="Mật khẩu" type="password" minLength={6} required />
                <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
              </>
            ) : null}

            {fallbackType === "forgot" ? <Input name="email" label="Email" type="email" placeholder="you@example.com" required /> : null}

            {fallbackType === "reset" ? (
              <>
                <Input name="password" label="Mật khẩu mới" type="password" minLength={6} required />
                <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
              </>
            ) : null}

            <Button type="submit" className={fallbackType === "candidate" || fallbackType === "recruiter" ? "w-full" : ""} loading={loading}>
              {fallbackType === "forgot" ? "Gửi hướng dẫn" : fallbackType === "candidate" || fallbackType === "recruiter" ? "Đăng ký" : "Lưu thông tin"}
            </Button>
        </form>
      </Card>
    </PageContainer>
  );
}

function CvSheet({ className, icon, title, tone }: { className: string; icon: ReactNode; title: string; tone: string }) {
  return (
    <div className={`absolute h-32 w-24 rounded-md border border-slate-200 bg-white p-3 shadow-lg transition duration-300 hover:-translate-y-2 ${className}`}>
      <div className={tone}>{icon}</div>
      <p className="mt-3 text-xs font-semibold text-slate-900">{title}</p>
      <div className="mt-3 space-y-2">
        <span className="block h-2 rounded bg-brand-100" />
        <span className="block h-2 rounded bg-slate-100" />
        <span className="block h-2 rounded bg-slate-100" />
      </div>
    </div>
  );
}
