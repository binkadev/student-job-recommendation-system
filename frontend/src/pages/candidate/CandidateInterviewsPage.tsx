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
        description="Backend hiện chưa có API hoặc bảng dữ liệu cho lịch phỏng vấn ứng viên."
      />
      <Card>
        <EmptyState message="Chưa có dữ liệu phỏng vấn từ API backend." />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link to="/candidate/applications"><Button>Quay lại đơn ứng tuyển</Button></Link>
          <Link to="/candidate/jobs"><Button variant="secondary">Tìm việc</Button></Link>
        </div>
      </Card>
    </PageContainer>
  );
}
