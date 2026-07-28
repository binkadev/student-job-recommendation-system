import { Link } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";

export function ForbiddenPage() {
  return (
    <PageContainer>
      <PageHeader title="403 - Không có quyền truy cập" description="Tài khoản hiện tại không đủ quyền truy cập trang này." />
      <Link className="inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white" to="/">
        Về trang chủ
      </Link>
    </PageContainer>
  );
}
