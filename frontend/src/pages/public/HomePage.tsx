import { ArrowRight, Banknote, BriefcaseBusiness, Calculator, Code2, FileUp, LineChart, Megaphone, Palette, Search, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { FeaturedHomeCompanyCard } from "../../features/public/home/FeaturedHomeCompanyCard";
import { FeaturedHomeJobCard } from "../../features/public/home/FeaturedHomeJobCard";
import { getHomeData } from "../../features/public/home/homeService";
import type { FeaturedIndustry, HomeData, IndustryIconMap } from "../../features/public/home/homeTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useToast } from "../../hooks/useToast";

const locationOptions = [
  { label: "Tất cả địa điểm", value: "" },
  { label: "Hà Nội", value: "Hà Nội" },
  { label: "TP. Hồ Chí Minh", value: "TP. Hồ Chí Minh" },
  { label: "Đà Nẵng", value: "Đà Nẵng" },
  { label: "Remote", value: "Remote" },
];

const industryIcons: IndustryIconMap = {
  code: <Code2 size={20} />,
  briefcase: <BriefcaseBusiness size={20} />,
  megaphone: <Megaphone size={20} />,
  banknote: <Banknote size={20} />,
  calculator: <Calculator size={20} />,
  users: <Users size={20} />,
  palette: <Palette size={20} />,
  chart: <LineChart size={20} />,
};

const fallbackHomeData: HomeData = {
  statistics: [
    { id: "jobs", label: "Việc làm đang tuyển", value: "0" },
    { id: "candidates", label: "Ứng viên", value: "0" },
    { id: "companies", label: "Công ty", value: "0" },
    { id: "applications", label: "Lượt ứng tuyển", value: "0" },
  ],
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
  const { statistics, jobs, industries, companies, articles } = homeQuery.data ?? fallbackHomeData;

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

  return (
    <PageContainer>
      <section className="grid gap-8 rounded-2xl bg-slate-950 px-6 py-10 text-white lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div>
          <p className="text-sm font-medium text-blue-200">Nền tảng gợi ý việc làm dựa trên CV và hồ sơ cá nhân</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">Tìm công việc phù hợp với CV của bạn</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
            Tìm kiếm việc làm, tải CV và nhận gợi ý theo kỹ năng, kinh nghiệm, địa điểm mong muốn và mục tiêu nghề nghiệp của bạn.
          </p>

          <form onSubmit={handleSearch} className="mt-6 grid gap-3 rounded-lg bg-white p-3 text-slate-900 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_220px_130px_150px] xl:items-end">
            <Input label="Từ khóa" name="keyword" placeholder="Frontend, Java, Data..." />
            <Select label="Địa điểm" name="location" options={locationOptions} />
            <Button type="submit" className="h-10 w-full self-end whitespace-nowrap" icon={<Search size={16} />}>Tìm việc</Button>
            <Button type="button" variant="secondary" className="h-10 w-full self-end whitespace-nowrap px-3" icon={<FileUp size={16} />} onClick={handleUploadCv}>
              Tải CV
            </Button>
          </form>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {statistics.map((item) => (
            <Card key={item.id} className="border-white/10 bg-white/10 text-white">
              <p className="text-sm text-slate-300">{item.label}</p>
              <strong className="mt-2 block text-3xl">{item.value}</strong>
            </Card>
          ))}
        </div>
      </section>

      {homeQuery.error ? (
        <Card className="mt-5">
          <ErrorState message="Không thể tải dữ liệu trang chủ từ backend. Giao diện vẫn hiển thị với số liệu 0." />
          <div className="mt-3">
            <Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button>
          </div>
        </Card>
      ) : null}

      <section className="mt-8">
        <SectionHeader
          title="Việc làm đang tuyển"
          description="Các vị trí đang tuyển lấy trực tiếp từ API backend."
          action={<Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700">Xem tất cả <ArrowRight size={16} /></Link>}
        />
        {homeQuery.loading ? (
          <Card><EmptyState message="Đang tải việc làm từ backend..." /></Card>
        ) : jobs.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {jobs.slice(0, 6).map((job) => <FeaturedHomeJobCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSave={toggleSavedJob} />)}
          </div>
        ) : (
          <EmptyState message="Chưa có việc làm đang tuyển." />
        )}
      </section>

      <section className="mt-8">
        <SectionHeader title="Ngành nghề nổi bật" description="Backend hiện chưa có API thống kê ngành nghề public." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {industries.length
            ? industries.map((industry) => <IndustryCard key={industry.id} industry={industry} />)
            : ["Công nghệ thông tin", "Kinh doanh", "Marketing", "Dữ liệu"].map((name) => <IndustryPlaceholderCard key={name} name={name} />)}
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Công ty nổi bật" description="Backend hiện chưa có API danh sách công ty public." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.length
            ? companies.slice(0, 6).map((company) => <FeaturedHomeCompanyCard key={company.id} company={company} />)
            : ["Công ty A", "Công ty B", "Công ty C"].map((name) => <CompanyPlaceholderCard key={name} name={name} />)}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <SectionHeader title="Hệ thống gợi ý từ CV hoạt động thế nào?" description="CV và hồ sơ cá nhân được dùng để so khớp kỹ năng, kinh nghiệm, vị trí mong muốn và địa điểm làm việc." />
          <div className="grid gap-3 text-sm text-slate-700">
            <p>Hệ thống đọc thông tin kỹ năng, học vấn và kinh nghiệm từ CV.</p>
            <p>Dữ liệu hồ sơ cá nhân giúp điều chỉnh mức độ phù hợp theo mục tiêu nghề nghiệp.</p>
            <p>Kết quả gợi ý giúp ứng viên ưu tiên các việc làm nên xem và ứng tuyển trước.</p>
          </div>
        </Card>
        <Card>
          <SectionHeader title="Quy trình sử dụng" description="Bốn bước cơ bản để ứng viên bắt đầu tìm việc với hệ thống." />
          <ol className="grid gap-3 sm:grid-cols-4">
            {["Tạo hồ sơ", "Upload CV", "Nhận gợi ý", "Ứng tuyển"].map((step, index) => (
              <li key={step} className="rounded-lg bg-slate-50 p-4 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white">{index + 1}</span>
                <p className="mt-3 font-medium text-slate-900">{step}</p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section className="mt-8">
        <SectionHeader title="Cẩm nang nghề nghiệp" description="Backend hiện chưa có API nội dung bài viết/cẩm nang." />
        <div className="grid gap-4 md:grid-cols-3">
          {articles.length ? (
            articles.map((article) => (
              <Link key={article.id} to={article.path} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-200">
                <h3 className="font-semibold text-slate-900">{article.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{article.summary}</p>
              </Link>
            ))
          ) : (
            ["Viết CV", "Phỏng vấn", "Định hướng nghề nghiệp"].map((title) => <ArticlePlaceholderCard key={title} title={title} />)
          )}
        </div>
      </section>

      <Modal open={loginModalOpen} title="Đăng nhập để tải CV" onClose={() => setLoginModalOpen(false)}>
        <p className="text-sm leading-6 text-slate-600">Bạn cần đăng nhập bằng tài khoản ứng viên để tải CV và nhận gợi ý việc làm phù hợp.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/login"><Button onClick={() => setLoginModalOpen(false)}>Đăng nhập</Button></Link>
          <Link to="/register/candidate"><Button variant="secondary" onClick={() => setLoginModalOpen(false)}>Đăng ký ứng viên</Button></Link>
        </div>
      </Modal>
    </PageContainer>
  );
}

function IndustryCard({ industry }: { industry: FeaturedIndustry }) {
  return (
    <Link to={`/jobs?q=${encodeURIComponent(industry.name)}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{industryIcons[industry.iconName]}</span>
      <span>
        <span className="block font-medium text-slate-900">{industry.name}</span>
        <span className="mt-1 block text-sm text-slate-600">{industry.jobCount} việc làm</span>
      </span>
    </Link>
  );
}

function IndustryPlaceholderCard({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><BriefcaseBusiness size={20} /></span>
      <span>
        <span className="block font-medium text-slate-900">{name}</span>
        <span className="mt-1 block text-sm text-slate-600">0 việc làm</span>
      </span>
    </div>
  );
}

function CompanyPlaceholderCard({ name }: { name: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 font-semibold text-brand-700">CT</div>
        <div>
          <h3 className="font-semibold text-slate-900">{name}</h3>
          <p className="text-sm text-slate-600">Chưa có API công ty public</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <span>0 việc làm đang tuyển</span>
        <span>Chưa có dữ liệu xác thực</span>
      </div>
    </article>
  );
}

function ArticlePlaceholderCard({ title }: { title: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Chưa có API nội dung bài viết. Dữ liệu sẽ hiển thị khi backend bổ sung endpoint.</p>
    </article>
  );
}
