import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";

const articles = [
  { slug: "cv-it-sinh-vien", title: "Cách viết CV IT nổi bật cho sinh viên mới ra trường", category: "CV", readTime: "6 phút" },
  { slug: "phong-van-frontend", title: "Chuẩn bị phỏng vấn Frontend Developer trong 7 ngày", category: "Phỏng vấn", readTime: "8 phút" },
  { slug: "lo-trinh-java", title: "Lộ trình học Backend Java Spring Boot", category: "Định hướng", readTime: "10 phút" },
];

export function CareerResourcesPage() {
  const { slug } = useParams();
  const article = articles.find((item) => item.slug === slug);

  if (slug && article) {
    return (
      <PageContainer>
        <PageHeader title={article.title} description={`${article.category} - Thời gian đọc ${article.readTime}`} />
        <Card>
          <div className="mb-4 flex flex-wrap gap-2">
            <StatusBadge label="Nội dung tĩnh" />
            <StatusBadge label="Chưa có API backend" tone="warning" />
          </div>
          <EmptyState message="Backend hiện chưa có API public cho cẩm nang nghề nghiệp. Khi có module nội dung/bài viết, trang này sẽ lấy chi tiết bài viết từ API thay vì nội dung tĩnh." />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Cẩm nang nghề nghiệp" description="Tài nguyên hỗ trợ viết CV, phỏng vấn và định hướng nghề nghiệp IT." />
      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Chưa có API backend cho cẩm nang nghề nghiệp</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Các thẻ bên dưới được giữ lại như khung giao diện tĩnh để trang không bị trống. Khi backend có module bài viết, dữ liệu sẽ được nối với API tương ứng.
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {articles.map((item) => (
          <Link key={item.slug} to={`/career-resources/${item.slug}`}>
            <Card className="h-full hover:border-brand-200">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-brand-700">{item.category}</p>
                <StatusBadge label="Tĩnh" tone="warning" />
              </div>
              <h2 className="mt-2 font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm text-slate-600">{item.readTime}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
