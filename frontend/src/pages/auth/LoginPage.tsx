import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { RoleSwitcher } from "../../components/navigation/RoleSwitcher";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../hooks/useToast";
import { getStorageItem } from "../../utils/localStorage";

interface RegisteredAccount {
  role: "candidate" | "recruiter";
  email: string;
  password: string;
  name: string;
}

const REGISTERED_ACCOUNTS_KEY = "registered-accounts";

const demoAccounts: RegisteredAccount[] = [
  { role: "candidate", email: "candidate@example.com", password: "123456", name: "Nguyễn Văn An" },
  { role: "recruiter", email: "recruiter@example.com", password: "123456", name: "Trần Thị Bình" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { loginAsCandidate, loginAsRecruiter, loginAsAdmin } = useAuth();
  const { showToast } = useToast();

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const registeredAccounts = getStorageItem<RegisteredAccount[]>(REGISTERED_ACCOUNTS_KEY, []);
    const account = [...registeredAccounts, ...demoAccounts].find((item) => item.email === email && item.password === password);

    if (!account) {
      showToast({ type: "error", title: "Thông tin đăng nhập không đúng", message: "Vui lòng nhập đúng email và mật khẩu đã đăng ký." });
      return;
    }

    login(account.role);
  }

  function login(type: "candidate" | "recruiter" | "admin") {
    if (type === "candidate") {
      loginAsCandidate();
      navigate("/candidate/dashboard");
    }
    if (type === "recruiter") {
      loginAsRecruiter();
      navigate("/recruiter/dashboard");
    }
    if (type === "admin") {
      loginAsAdmin();
      navigate("/admin/dashboard");
    }
    showToast({ type: "success", title: "Đăng nhập thành công", message: "Bạn đang sử dụng tài khoản trong frontend prototype." });
  }

  return (
    <PageContainer>
      <PageHeader title="Đăng nhập" description="Nhập đúng email và mật khẩu đã đăng ký để truy cập hệ thống." />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <form className="space-y-4" onSubmit={submitLogin}>
            <Input name="email" label="Email" type="email" placeholder="email@example.com" required />
            <Input name="password" label="Mật khẩu" type="password" placeholder="Nhập mật khẩu" required />
            <Button type="submit" className="w-full">
              Đăng nhập
            </Button>
          </form>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button variant="secondary" onClick={() => login("candidate")}>Ứng viên</Button>
            <Button variant="secondary" onClick={() => login("recruiter")}>Nhà tuyển dụng</Button>
            <Button variant="secondary" onClick={() => login("admin")}>Quản trị viên</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Tài khoản demo</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p><strong>Ứng viên:</strong> candidate@example.com / 123456</p>
            <p><strong>Nhà tuyển dụng:</strong> recruiter@example.com / 123456</p>
            <p><strong>Quản trị viên:</strong> dùng nút chuyển vai trò nhanh.</p>
          </div>
          <div className="mt-5">
            <RoleSwitcher />
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
