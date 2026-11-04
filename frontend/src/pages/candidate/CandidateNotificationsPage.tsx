import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { NotificationsPanel } from "../../features/account/NotificationsPanel";
import { useAuth } from "../../hooks/useAuth";
import { AUTH_TOKEN_STORAGE_KEY } from "../../services/api/httpClient";

export function CandidateNotificationsPage() {
  const { currentUser } = useAuth();
  return <PageContainer>
    <PageHeader title="Thông báo" description="Thông báo trong hệ thống; tải lại để nhận cập nhật mới." />
    <NotificationsPanel role="candidate" key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}`} />
  </PageContainer>;
}
