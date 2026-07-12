import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Card } from "../../components/ui/Card";

interface PublicInfoPageProps {
  title: string;
  description: string;
}

export function PublicInfoPage({ title, description }: PublicInfoPageProps) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <Card>
        <p className="text-sm leading-6 text-slate-700">
          Trang thông tin công khai dùng dữ liệu mẫu để hoàn thiện luồng giao diện. Nội dung pháp lý và thông tin vận hành sẽ được cập nhật khi hệ thống tích hợp dữ liệu thật.
        </p>
      </Card>
    </PageContainer>
  );
}
