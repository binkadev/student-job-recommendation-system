import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function CandidateMessagesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Tin nhắn"
        description="Backend hiện chưa có API hoặc bảng dữ liệu cho hội thoại/tin nhắn."
      />
      <Card>
        <EmptyState message="Chưa có dữ liệu tin nhắn từ API backend." />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/candidate/applications"><Button>Đơn ứng tuyển</Button></Link>
          <Link to="/candidate/jobs"><Button variant="secondary">Tìm việc</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}
