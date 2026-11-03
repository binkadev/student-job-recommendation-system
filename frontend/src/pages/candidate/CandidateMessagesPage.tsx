import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";

export function CandidateMessagesPage({ role = "candidate" }: { role?: "candidate" | "recruiter" }) {
  return <PageContainer>
    <PageHeader title="Tin nhắn" description="Thông tin về khả năng trao đổi tin nhắn trong hệ thống." />
    <UnsupportedFeature title="Chưa thể gửi hoặc đọc tin nhắn tại đây"
      description="Hệ thống hiện chưa hỗ trợ hội thoại hoặc gửi tin nhắn. Trang này không truy xuất hộp thư và không xác nhận bạn có hay chưa có tin nhắn."
      to={role === "recruiter" ? "/recruiter/candidates" : "/candidate/applications"} action="Xem đơn ứng tuyển" />
  </PageContainer>;
}
