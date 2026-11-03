import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";

export function RecruiterInterviewsPage({ mode = "list" }: { mode?: "list" | "create" | "detail" }) {
  const title = mode === "create" ? "Tạo lịch phỏng vấn" : mode === "detail" ? "Chi tiết phỏng vấn" : "Quản lý phỏng vấn";
  return <PageContainer>
    <PageHeader title={title} description="Thông tin về khả năng quản lý lịch phỏng vấn của hệ thống." />
    <UnsupportedFeature title="Chưa thể quản lý lịch phỏng vấn tại đây"
      description="Hệ thống hiện chưa hỗ trợ tạo, xem hoặc đổi lịch phỏng vấn. Trang này không truy xuất lịch và không xác nhận công ty có hay chưa có lịch hẹn. Bạn có thể tiếp tục xử lý các đơn ứng tuyển."
      to="/recruiter/candidates" action="Xem đơn ứng tuyển" />
  </PageContainer>;
}
