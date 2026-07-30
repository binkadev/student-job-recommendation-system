import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function CandidateInvitationsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  return (
    <PageContainer>
      <PageHeader
        title={mode === "detail" ? "Chi tiết lời mời ứng tuyển" : "Lời mời ứng tuyển"}
        description="Theo dõi các lời mời ứng tuyển từ nhà tuyển dụng."
      />
      <Card>
        <EmptyState message="Chưa có lời mời ứng tuyển." />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/candidate/jobs"><Button>Tìm việc</Button></Link>
          <Link to="/candidate/profile"><Button variant="secondary">Xem hồ sơ</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}
