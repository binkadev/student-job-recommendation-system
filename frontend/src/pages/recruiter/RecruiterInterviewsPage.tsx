import { CalendarDays, Clock, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function RecruiterInterviewsPage({ mode = "list" }: { mode?: "list" | "create" | "detail" }) {
  if (mode === "create") {
    return (
      <PageContainer>
        <PageHeader title="Tạo lịch phỏng vấn" description="Backend hiện chưa có API tạo lịch phỏng vấn." />
        <UnsupportedInterviewCard
          title="Chưa thể tạo lịch phỏng vấn"
          message="Frontend đã bỏ dữ liệu mock. Khi backend có endpoint interview, form tạo lịch sẽ gửi dữ liệu thật thay vì lưu giả."
        />
      </PageContainer>
    );
  }

  if (mode === "detail") {
    return (
      <PageContainer>
        <PageHeader title="Chi tiết phỏng vấn" description="Backend hiện chưa có API chi tiết lịch phỏng vấn." />
        <UnsupportedInterviewCard
          title="Không có dữ liệu phỏng vấn"
          message="Trang chi tiết phỏng vấn không hiển thị dữ liệu mock vì backend chưa có bảng/API tương ứng."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý phỏng vấn" description="Theo dõi lịch phỏng vấn sau khi backend bổ sung API interview." />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeader title="Lịch phỏng vấn" description="Backend hiện chưa có endpoint danh sách/tạo/sửa/xác nhận lịch phỏng vấn." />
          <EmptyState message="Chưa có dữ liệu phỏng vấn từ API backend." />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/recruiter/candidates"><Button>Đi tới ứng viên ứng tuyển</Button></Link>
            <Link to="/recruiter/jobs"><Button variant="secondary">Đi tới tin tuyển dụng</Button></Link>
          </div>
        </Card>

        <aside className="space-y-5">
          <InfoCard icon={<CalendarDays size={18} />} title="Danh sách lịch" message="Cần API lấy lịch phỏng vấn theo công ty hoặc theo job." />
          <InfoCard icon={<Clock size={18} />} title="Tạo và đổi lịch" message="Cần API tạo, cập nhật thời gian, hình thức và người phỏng vấn." />
          <InfoCard icon={<Users size={18} />} title="Người phỏng vấn" message="Cần API thành viên công ty hoặc interviewer để chọn người phụ trách." />
          <InfoCard icon={<FileText size={18} />} title="Đánh giá sau phỏng vấn" message="Cần API lưu nhận xét, điểm đánh giá và kết quả phỏng vấn." />
        </aside>
      </div>
    </PageContainer>
  );
}

function UnsupportedInterviewCard({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <SectionHeader title={title} description={message} />
      <EmptyState message="Chức năng này chưa có endpoint backend nên không hiển thị dữ liệu mock." />
      <div className="mt-4">
        <Link to="/recruiter/candidates"><Button>Quay lại ứng viên ứng tuyển</Button></Link>
      </div>
    </Card>
  );
}

function InfoCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-brand-50 p-2 text-brand-700">{icon}</div>
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
        </div>
      </div>
    </Card>
  );
}
