import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";

export function CandidateInterviewsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  return <PageContainer>
    <PageHeader title={mode === "detail" ? "Chi tiết phỏng vấn" : "Lịch phỏng vấn"} description="Thông tin về khả năng theo dõi lịch phỏng vấn của hệ thống." />
    <UnsupportedFeature title="Chưa thể xem lịch phỏng vấn tại đây"
      description="Hệ thống hiện chưa hỗ trợ truy xuất hoặc xác nhận lịch phỏng vấn. Trang này không xác định bạn có hay chưa có lịch hẹn. Bạn có thể kiểm tra trạng thái các đơn ứng tuyển."
      to="/candidate/applications" action="Xem đơn ứng tuyển" />
  </PageContainer>;
}
