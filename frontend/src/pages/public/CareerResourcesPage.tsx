import { Link, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
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
        <PageHeader title={article.title} description={`${article.category} • Thời gian đọc ${article.readTime}`} />
        <Card>
          <p className="text-sm leading-6 text-slate-700">
            Bài viết mock cung cấp các bước thực tế, checklist và gợi ý để ứng viên chuẩn bị tốt hơn trước khi ứng tuyển. Nội dung chi tiết sẽ được phát triển ở các bước sau.
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Cẩm nang nghề nghiệp" description="Tài nguyên hỗ trợ viết CV, phỏng vấn và định hướng nghề nghiệp IT." />
      <div className="grid gap-4 md:grid-cols-3">
        {articles.map((item) => (
          <Link key={item.slug} to={`/career-resources/${item.slug}`}>
            <Card className="h-full hover:border-brand-200">
              <p className="text-sm text-brand-700">{item.category}</p>
              <h2 className="mt-2 font-semibold text-slate-950">{item.title}</h2>
              <p className="mt-3 text-sm text-slate-600">{item.readTime}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
