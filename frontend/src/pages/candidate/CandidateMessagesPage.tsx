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
        description="Trao đổi với nhà tuyển dụng về các cơ hội việc làm."
      />
      <Card>
        <EmptyState message="Chưa có tin nhắn." />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/candidate/applications"><Button>Đơn ứng tuyển</Button></Link>
          <Link to="/candidate/jobs"><Button variant="secondary">Tìm việc</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}
