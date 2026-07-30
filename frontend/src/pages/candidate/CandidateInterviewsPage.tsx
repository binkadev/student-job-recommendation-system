import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export function CandidateInterviewsPage({ mode = "list" }: { mode?: "list" | "detail" }) {
  return (
    <PageContainer>
      <PageHeader
        title={mode === "detail" ? "Chi tiết phỏng vấn" : "Lịch phỏng vấn"}
        description="Theo dõi lịch phỏng vấn của các đơn ứng tuyển."
      />
      <Card>
        <EmptyState message="Chưa có lịch phỏng vấn." />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/candidate/applications"><Button>Quay lại đơn ứng tuyển</Button></Link>
          <Link to="/candidate/jobs"><Button variant="secondary">Tìm việc</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}
