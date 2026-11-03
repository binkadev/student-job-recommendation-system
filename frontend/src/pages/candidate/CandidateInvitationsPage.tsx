import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";

export function CandidateInvitationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  return <PageContainer>
    <PageHeader title={mode === "detail" ? "Chi tiết lời mời ứng tuyển" : "Lời mời ứng tuyển"} description="Thông tin về khả năng nhận lời mời ứng tuyển." />
    <UnsupportedFeature title="Chưa thể xem hoặc phản hồi lời mời"
      description="Hệ thống hiện chưa hỗ trợ gửi, nhận hoặc phản hồi lời mời ứng tuyển. Trang này không truy xuất danh sách lời mời."
      to="/candidate/jobs" action="Tìm việc" />
  </PageContainer>;
}
