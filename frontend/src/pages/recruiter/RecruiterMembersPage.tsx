import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { UnsupportedFeature } from "../../components/feedback/UnsupportedFeature";

export function RecruiterMembersPage({ mode = "list" }: { mode?: "list" | "invite" }) {
  return <PageContainer>
    <PageHeader title={mode === "invite" ? "Mời thành viên" : "Thành viên doanh nghiệp"} description="Thông tin về khả năng quản lý thành viên của hệ thống." />
    <UnsupportedFeature title="Chưa thể mời hoặc quản lý thành viên"
      description="Hệ thống hiện chưa hỗ trợ danh sách thành viên, lời mời hoặc phân quyền trong công ty. Trang này không truy xuất dữ liệu thành viên. Bạn có thể quản lý hồ sơ công ty bằng tài khoản hiện tại."
      to="/recruiter/company" action="Xem hồ sơ công ty" />
  </PageContainer>;
}
