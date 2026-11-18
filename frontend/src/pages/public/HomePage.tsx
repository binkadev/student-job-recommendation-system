import { ArrowRight, FileUp, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { PageContainer } from "../../components/common/PageContainer";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { NovaHero } from "../../features/public/home/NovaHero";
import { NovaPlatformMetrics } from "../../features/public/home/NovaPlatformMetrics";
import { NovaFeaturedJobCard } from "../../features/public/home/NovaFeaturedJobCard";
import { NovaFeaturedCompanyCard } from "../../features/public/home/NovaFeaturedCompanyCard";
import { NovaProcessSection } from "../../features/public/home/NovaProcessSection";
import { NovaCareerResources } from "../../features/public/home/NovaCareerResources";
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
  const { statistics, statisticsUnavailable, jobs, companies, articles } =
    homeQuery.data ?? fallbackHomeData;

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
    showToast({
      type: "error",
      title: "Chỉ tài khoản ứng viên mới có thể tải CV để nhận gợi ý",
    });
  }

  async function handleToggleSave(jobId: string) {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }
    if (currentRole !== "candidate") {
      showToast({
        type: "error",
        title: "Tài khoản này không thể thao tác",
        message: "Vui lòng dùng tài khoản ứng viên để lưu việc làm.",
      });
      return;
    }
    try {
      await toggleSavedJob(jobId);
    } catch {
      showToast({
        type: "error",
        title: "Không thể cập nhật lưu việc",
        message: "Vui lòng thử lại sau.",
      });
    }
  }

  return (
    <div className="nova-theme min-h-screen py-4 sm:py-6">
      <PageContainer>
        {/* Cinematic Hero with Staggered Entrance & Interactive Visualization */}
        <NovaHero
          isAuthenticated={isAuthenticated}
          currentRole={currentRole}
        />

        {/* Unified Search Bar */}
        <form
          onSubmit={handleSearch}
          className="mt-6 grid items-end gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm md:grid-cols-[1.2fr_1fr_auto]"
        >
          <Input
            label="Bạn muốn tìm công việc nào?"
            name="keyword"
            placeholder="Frontend, Java, Backend, Data Engineer..."
          />
          <Select label="Địa điểm" name="location" options={locationOptions} />
          <div className="flex gap-2.5">
            <Button
              type="submit"
              icon={<Search size={16} />}
              className="min-h-[44px] bg-[#1a6359] hover:bg-[#134b43] text-white font-semibold"
            >
              Tìm việc
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<FileUp size={16} />}
              onClick={handleUploadCv}
              className="min-h-[44px] border-[#e2e8f0] font-semibold text-[#1b2533]"
            >
              Tải CV
            </Button>
          </div>
        </form>

        {/* Live Platform Metrics (Bento-grid with animated counters & real API data) */}
        <NovaPlatformMetrics
          statistics={statistics}
          loading={homeQuery.loading}
          error={!!homeQuery.error}
          statisticsUnavailable={!!statisticsUnavailable}
          onRetry={() => setReloadKey((value) => value + 1)}
        />

        {/* Error State if whole page fetch fails */}
        {homeQuery.error ? (
          <Card className="mt-6">
            <ErrorState message="Không thể tải dữ liệu trang chủ. Vui lòng thử lại để xem số liệu và danh sách hiện tại." />
            <div className="mt-3">
              <Button onClick={() => setReloadKey((value) => value + 1)}>
                Thử lại
              </Button>
            </div>
          </Card>
        ) : null}

        {/* Featured Jobs Section */}
        <section className="mt-12">
          <SectionHeader
            title="Việc làm đang tuyển"
            action={
              <Link
                to="/jobs"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#237d70] hover:text-[#134b43] transition-colors"
              >
                Xem tất cả cơ hội <ArrowRight size={14} />
              </Link>
            }
          />
          {homeQuery.loading ? (
            <div className="mt-4 space-y-4">
              <Card>
                <LoadingState message="Đang tải việc làm..." />
              </Card>
              <div className="grid gap-4 lg:grid-cols-2" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[246px] rounded-[20px] border border-[#e5e9f0] bg-white p-6 shadow-sm">
                    <div className="flex gap-3.5">
                      <div className="nova-skeleton h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="nova-skeleton h-5 w-2/3" />
                        <div className="nova-skeleton h-4 w-1/3" />
                      </div>
                    </div>
                    <div className="nova-skeleton mt-5 h-4 w-full" />
                    <div className="nova-skeleton mt-2 h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          ) : homeQuery.error ? (
            <ErrorState message="Không tải được danh sách việc làm." />
          ) : jobs.length ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {jobs.slice(0, 6).map((job) => (
                <NovaFeaturedJobCard
                  key={job.id}
                  job={job}
                  saved={Boolean(
                    isAuthenticated &&
                    currentRole === "candidate" &&
                    isSaved(job.id)
                  )}
                  onToggleSave={(jobId) => void handleToggleSave(jobId)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="Chưa có việc làm đang tuyển." />
          )}
        </section>

        {/* Featured Companies Section */}
        <section className="mt-12">
          <SectionHeader
            title="Công ty nổi bật"
            action={
              <Link
                to="/companies"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#237d70] hover:text-[#134b43] transition-colors"
              >
                Tất cả công ty <ArrowRight size={14} />
              </Link>
            }
          />
          {homeQuery.loading ? (
            <div className="mt-4 space-y-4">
              <Card>
                <LoadingState message="Đang tải công ty…" />
              </Card>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[222px] rounded-[20px] border border-[#e5e9f0] bg-white p-5 shadow-sm">
                    <div className="flex gap-3.5">
                      <div className="nova-skeleton h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <div className="nova-skeleton h-4 w-2/3" />
                        <div className="nova-skeleton h-3 w-1/2" />
                      </div>
                    </div>
                    <div className="nova-skeleton mt-5 h-3 w-3/4" />
                    <div className="nova-skeleton mt-2 h-3 w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          ) : homeQuery.error ? (
            <ErrorState message="Không tải được danh sách công ty." />
          ) : companies.length ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {companies.slice(0, 6).map((company) => (
                <NovaFeaturedCompanyCard key={company.id} company={company} />
              ))}
            </div>
          ) : (
            <EmptyState message="Chưa có công ty nổi bật để hiển thị." />
          )}
        </section>

        {/* Interactive Architecture & 4-Step Process Section */}
        <NovaProcessSection />

        {/* Career Resources Section */}
        <NovaCareerResources articles={articles} />

        {/* Auth Guidance Modal */}
        <Modal
          open={loginModalOpen}
          title="Đăng nhập để tiếp tục"
          onClose={() => setLoginModalOpen(false)}
        >
          <p className="text-sm leading-6 text-slate-600">
            Bạn cần đăng nhập hoặc tạo tài khoản ứng viên để tải CV, lưu việc
            làm và nhận gợi ý phù hợp.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link to="/login">
              <Button
                onClick={() => setLoginModalOpen(false)}
                className="bg-[#1a6359] hover:bg-[#134b43] text-white"
              >
                Đăng nhập
              </Button>
            </Link>
            <Link to="/register/candidate">
              <Button
                variant="secondary"
                onClick={() => setLoginModalOpen(false)}
              >
                Đăng ký ứng viên
              </Button>
            </Link>
          </div>
        </Modal>
      </PageContainer>
    </div>
  );
}
