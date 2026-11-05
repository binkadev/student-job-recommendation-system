import { ArrowRight, BriefcaseBusiness, Building2, FileText, FileUp, Search, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { PageContainer } from "../../components/common/PageContainer";
import { MatchingIllustration } from "../../components/common/AuroraHero";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { FeaturedHomeCompanyCard } from "../../features/public/home/FeaturedHomeCompanyCard";
import { FeaturedHomeJobCard } from "../../features/public/home/FeaturedHomeJobCard";
import { getHomeData } from "../../features/public/home/homeService";
import type { HomeData } from "../../features/public/home/homeTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useToast } from "../../hooks/useToast";

const locationOptions = [
  { label: "Tất cả địa điểm", value: "" },
  { label: "Hà Nội", value: "Hà Nội" },
  { label: "TP. Hồ Chí Minh", value: "Ho Chi Minh City" },
  { label: "Đà Nẵng", value: "Đà Nẵng" },
  { label: "Remote", value: "Remote" },
];

const fallbackHomeData: HomeData = {
  statistics: [
    { id: "jobs", label: "Việc làm đang tuyển", value: null },
    { id: "candidates", label: "Sinh viên đang hoạt động", value: null },
    { id: "companies", label: "Công ty đã xác thực", value: null },
    { id: "applications", label: "Đơn ứng tuyển", value: null },
  ],
  statisticsUnavailable: false,
  jobs: [],
  industries: [],
  companies: [],
  articles: [],
};

export function HomePage() {
  const navigate = useNavigate();
  const { currentRole, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const [reloadKey, setReloadKey] = useState(0);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const homeQuery = useAsyncData(() => getHomeData(), [reloadKey]);
  const { statistics, statisticsUnavailable, jobs, companies, articles } = homeQuery.data ?? fallbackHomeData;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const keyword = String(form.get("keyword") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (location) params.set("location", location);
    navigate(params.toString() ? `/jobs?${params.toString()}` : "/jobs");
  }

  function handleUploadCv() {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    if (currentRole === "candidate") {
      navigate("/candidate/cvs/upload");
      return;
    }
    showToast({ type: "error", title: "Chỉ tài khoản ứng viên mới có thể tải CV để nhận gợi ý" });
  }

  async function handleToggleSave(jobId: string) {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    if (currentRole !== "candidate") {
      showToast({ type: "error", title: "Tài khoản này không thể thao tác", message: "Vui lòng dùng tài khoản ứng viên để lưu việc làm." });
      return;
    }
    try {
      await toggleSavedJob(jobId);
    } catch {
      showToast({ type: "error", title: "Không thể cập nhật lưu việc", message: "Vui lòng thử lại sau." });
    }
  }

  return (
    <PageContainer>
      <section className="aurora-panel neo-home-hero">
        <div>
          <p className="aurora-eyebrow"><FileText size={16} aria-hidden="true" /> DÀNH CHO SINH VIÊN CÔNG NGHỆ THÔNG TIN</p>
          <h1 className="mt-5">Kỹ năng của bạn.<br /><span className="neo-gradient-text">Khởi đầu xứng đáng.</span></h1>
          <p className="aurora-description mt-5 max-w-xl text-base leading-7">
            Biến nội dung CV thành gợi ý việc làm. Khám phá kỹ năng phù hợp, hiểu lý do đối sánh và chủ động chọn bước tiếp theo cho sự nghiệp IT.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={isAuthenticated && currentRole === "candidate" ? "/candidate/jobs/recommended" : "/register/candidate"} className="neo-role-link neo-role-primary">Tôi là sinh viên <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link to={isAuthenticated && currentRole === "recruiter" ? "/recruiter/dashboard" : "/register/recruiter"} className="neo-role-link neo-role-secondary"><Building2 size={17} aria-hidden="true" /> Tôi là doanh nghiệp</Link>
          </div>
          <p className="aurora-description mt-5 text-xs">CV tiếng Việt & tiếng Anh · TF-IDF · Cosine Similarity</p>
        </div>
        <MatchingIllustration />
      </section>
      <form onSubmit={handleSearch} className="mt-5 grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft md:grid-cols-[1fr_1fr_auto]">
        <Input label="Bạn muốn tìm công việc nào?" name="keyword" placeholder="Frontend, Java, Data..." />
        <Select label="Địa điểm" name="location" options={locationOptions} />
        <div className="flex gap-2"><Button type="submit" icon={<Search size={16} />}>Tìm việc</Button><Button type="button" variant="secondary" icon={<FileUp size={16} />} onClick={handleUploadCv}>Tải CV</Button></div>
      </form>
      <section aria-label="Thống kê công khai" className="neo-public-metrics">
          {statistics.map((item, index) => (
            <Card key={item.id} className="neo-metric">
              <div className="flex items-center gap-2 text-brand-700">
                {index === 0 ? <BriefcaseBusiness size={18} /> : index === 1 ? <Users size={18} /> : index === 2 ? <Building2 size={18} /> : <FileText size={18} />}
                <p className="text-sm font-medium">{item.label}</p>
              </div>
              {homeQuery.loading ? <span role="status" className="mt-2 block text-sm text-slate-500">Đang tải số liệu…</span>
                : !homeQuery.error && item.value != null ? <strong className="mt-2 block text-3xl text-slate-950">{item.value}</strong>
                  : <span className="mt-2 block text-sm text-slate-600">{homeQuery.error ? "Không tải được số liệu" : item.unavailableReason ?? "Chưa có số liệu"}</span>}
            </Card>
          ))}
        {statisticsUnavailable ? (
          <div role="status" className="text-sm text-amber-800 lg:col-span-2">Không tải được thống kê công khai. Số liệu hiện chưa xác định. <Button variant="ghost" onClick={() => setReloadKey((value) => value + 1)}>Thử lại thống kê</Button></div>
        ) : null}
      </section>

      {homeQuery.error ? (
        <Card className="mt-5">
          <ErrorState message="Không thể tải dữ liệu trang chủ. Vui lòng thử lại để xem số liệu và danh sách hiện tại." />
          <div className="mt-3">
            <Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button>
          </div>
        </Card>
      ) : null}

      <section className="mt-8">
        <SectionHeader
          title="Việc làm đang tuyển"
          action={<Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700">Xem tất cả <ArrowRight size={16} /></Link>}
        />
        {homeQuery.loading ? (
          <Card><LoadingState message="Đang tải việc làm..." /></Card>
        ) : homeQuery.error ? <ErrorState message="Không tải được danh sách việc làm." /> : jobs.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {jobs.slice(0, 6).map((job) => <FeaturedHomeJobCard key={job.id} job={job} saved={isAuthenticated && currentRole === "candidate" && isSaved(job.id)} onToggleSave={(jobId) => void handleToggleSave(jobId)} />)}
          </div>
        ) : (
          <EmptyState message="Chưa có việc làm đang tuyển." />
        )}
      </section>

      <section className="mt-8">
        <SectionHeader title="Công ty nổi bật" />
        {homeQuery.loading ? <LoadingState message="Đang tải công ty…" /> : homeQuery.error ? <ErrorState message="Không tải được danh sách công ty." /> : companies.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {companies.slice(0, 6).map((company) => <FeaturedHomeCompanyCard key={company.id} company={company} />)}
          </div>
        ) : (
          <EmptyState message="Chưa có công ty nổi bật để hiển thị." />
        )}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <SectionHeader title="Hệ thống gợi ý từ CV hoạt động thế nào?" />
          <div className="grid gap-3 text-sm text-slate-700">
            <p>Tải CV PDF hoặc DOCX và hoàn tất phân tích trước khi tạo gợi ý.</p>
            <p>Với cặp CV và việc làm đủ điều kiện cùng ngôn ngữ, hệ thống đối sánh nội dung bằng TF-IDF, Cosine Similarity và kỹ năng.</p>
            <p>Nhóm đối sánh kỹ năng được hiển thị riêng, kèm kỹ năng khớp, kỹ năng còn thiếu và lý do gợi ý.</p>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Quy trình sử dụng" />
          <ol className="grid gap-3 sm:grid-cols-4">
            {["Tạo hồ sơ", "Tải CV", "Nhận gợi ý", "Ứng tuyển"].map((step, index) => (
              <li key={step} className="rounded-lg bg-slate-50 p-4 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">{index + 1}</span>
                <p className="mt-3 font-medium text-slate-900">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mt-8">
        <SectionHeader title="Cẩm nang nghề nghiệp" />
        <div className="grid gap-4 md:grid-cols-3">
          {articles.length ? (
            articles.map((article) => (
              <Link key={article.id} to={article.path} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-200">
                <h3 className="font-semibold text-slate-900">{article.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{article.summary}</p>
              </Link>
            ))
          ) : (
            [
              { title: "Viết CV IT rõ ràng", description: "Trình bày kỹ năng, dự án và vai trò của bạn bằng những ví dụ cụ thể.", path: "/career-resources/cv-it-sinh-vien" },
              { title: "Chuẩn bị phỏng vấn Frontend", description: "Ôn kiến thức nền tảng và chuẩn bị một dự án để giải thích cách bạn làm việc.", path: "/career-resources/phong-van-frontend" },
              { title: "Lộ trình Backend Java", description: "Từ Java core đến REST API, cơ sở dữ liệu và triển khai ứng dụng.", path: "/career-resources/lo-trinh-java" },
            ].map(article => <Link key={article.path} to={article.path} className="neo-card rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-300"><h3 className="font-semibold text-slate-900">{article.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{article.description}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Đọc hướng dẫn <ArrowRight size={15} aria-hidden="true" /></span></Link>)
          )}
        </div>
      </section>

      <Modal open={loginModalOpen} title="Đăng nhập để tiếp tục" onClose={() => setLoginModalOpen(false)}>
        <p className="text-sm leading-6 text-slate-600">Bạn cần đăng nhập hoặc tạo tài khoản ứng viên để tải CV, lưu việc làm và nhận gợi ý phù hợp.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/login"><Button onClick={() => setLoginModalOpen(false)}>Đăng nhập</Button></Link>
          <Link to="/register/candidate"><Button variant="secondary" onClick={() => setLoginModalOpen(false)}>Đăng ký ứng viên</Button></Link>
        </div>
      </Modal>
    </PageContainer>
  );
}
