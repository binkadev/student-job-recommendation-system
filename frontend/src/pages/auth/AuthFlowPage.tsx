import { isAxiosError } from "axios";
import type { FormEvent } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
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
        showToast({ type: "success", title: "Bạn đã đăng ký thành công", message: "Vui lòng đăng nhập bằng email và mật khẩu vừa đăng ký." });
        navigate("/login");
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

    showToast({ type: "success", title: "Đã ghi nhận thông tin", message: "Backend hiện chưa có API cho chức năng này." });
  }

  return (
    <PageContainer>
      <PageHeader title={page.title} description={page.description} />
      <Card className="max-w-2xl">
        {type === "register" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/register/candidate"><Button className="w-full">Tôi là ứng viên</Button></Link>
            <Link to="/register/recruiter"><Button variant="secondary" className="w-full">Tôi là doanh nghiệp</Button></Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            {type === "candidate" ? (
              <>
                <Input name="email" label="Email" type="email" placeholder="ungvien@example.com" required />
                <Input name="fullName" label="Họ và tên" placeholder="Nguyễn Văn An" required />
                <Input name="phone" label="Số điện thoại" placeholder="0901234567" />
                <Input name="password" label="Mật khẩu" type="password" minLength={6} required />
                <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
              </>
            ) : null}

            {type === "recruiter" ? (
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

            {type === "forgot" ? <Input name="email" label="Email" type="email" placeholder="you@example.com" required /> : null}

            {type === "reset" ? (
              <>
                <Input name="password" label="Mật khẩu mới" type="password" minLength={6} required />
                <Input name="confirmPassword" label="Xác nhận mật khẩu" type="password" minLength={6} required />
              </>
            ) : null}

            <Button type="submit" className={type === "candidate" || type === "recruiter" ? "w-full" : ""} loading={loading}>
              {type === "forgot" ? "Gửi hướng dẫn" : type === "candidate" || type === "recruiter" ? "Đăng ký" : "Lưu thông tin"}
            </Button>
          </form>
        )}
      </Card>
    </PageContainer>
  );
}
