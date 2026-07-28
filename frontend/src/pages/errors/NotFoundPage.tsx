import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";

export function NotFoundPage() {
  return (
    <PageContainer>
      <PageHeader title="404 - Không tìm thấy trang" description="Route này chưa tồn tại trong hệ thống frontend." />
      <Link className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white" to="/">
        Về trang chủ
      </Link>
    </PageContainer>
  );
}
