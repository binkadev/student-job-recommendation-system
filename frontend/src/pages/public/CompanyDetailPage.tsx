import { BriefcaseBusiness, Building2, CalendarDays, Copy, ExternalLink, Globe, MapPin, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { CompanyDetailSkeleton } from "../../features/public/companies/CompanyDetailSkeleton";
import { getPublicCompanyDetail } from "../../features/public/companies/companyDetailService";
import type { CompanyGalleryItem } from "../../features/public/companies/companyDetailTypes";
import { PublicJobListCard } from "../../features/public/jobs/PublicJobListCard";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";
import { useToast } from "../../hooks/useToast";

const pageSize = 4;
const emptyOption = { label: "Tất cả", value: "" };

type CompanyTab = "about" | "jobs" | "benefits" | "gallery";

const tabs = [
  { label: "Giới thiệu", value: "about" },
  { label: "Việc làm đang tuyển", value: "jobs" },
  { label: "Phúc lợi", value: "benefits" },
  { label: "Hình ảnh", value: "gallery" },
];

export function CompanyDetailPage() {
  const { companyId = "" } = useParams();
  const location = useLocation();
  const { showToast } = useToast();
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<CompanyTab>(readTabFromHash(location.hash));
  const [jobQuery, setJobQuery] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [page, setPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<CompanyGalleryItem | null>(null);
  const companyQuery = useAsyncData(() => getPublicCompanyDetail(companyId), [companyId, reloadKey]);

  useEffect(() => {
    setActiveTab(readTabFromHash(location.hash));
  }, [location.hash]);

  const result = companyQuery.data;
  const company = result?.company;
  const jobs = useMemo(() => result?.jobs ?? [], [result?.jobs]);
  const jobOptions = useMemo(() => ({
    locations: [emptyOption, ...Array.from(new Set(jobs.map((job) => job.location))).map((value) => ({ label: value, value }))],
    jobTypes: [emptyOption, ...Array.from(new Set(jobs.map((job) => job.jobType))).map((value) => ({ label: value, value }))],
  }), [jobs]);

  const filteredJobs = useMemo(() => {
    const keyword = jobQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      const searchable = `${job.title} ${job.skills.join(" ")}`.toLowerCase();
      const matchKeyword = !keyword || searchable.includes(keyword);
      const matchLocation = !jobLocation || job.location === jobLocation;
      const matchType = !jobType || job.jobType === jobType;
      return matchKeyword && matchLocation && matchType;
    });
  }, [jobs, jobLocation, jobQuery, jobType]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const pagedJobs = filteredJobs.slice((page - 1) * pageSize, page * pageSize);

  function changeTab(value: string) {
    const nextTab = value as CompanyTab;
    setActiveTab(nextTab);
    window.history.replaceState(null, "", `#${nextTab}`);
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard?.writeText(value);
      showToast({ type: "success", title: `Đã copy ${label}` });
    } catch {
      showToast({ type: "success", title: `Đã tạo nội dung copy`, message: value });
    }
  }

  if (companyQuery.loading) {
    return (
      <PageContainer>
        <CompanyDetailSkeleton />
      </PageContainer>
    );
  }

  if (companyQuery.error) {
    return (
      <PageContainer>
        <ErrorState message={companyQuery.error} />
        <div className="mt-4"><Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button></div>
      </PageContainer>
    );
  }

  if (!company) {
    return (
      <PageContainer>
        <ErrorState message="Không tìm thấy công ty." />
        <div className="mt-4"><Link to="/companies"><Button variant="secondary">Quay lại danh sách công ty</Button></Link></div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className={`flex min-h-48 items-end p-6 text-white ${company.cover}`}>
          <div>
            <p className="text-sm text-slate-200">{company.industry}</p>
            <h1 className="mt-2 text-3xl font-semibold">{company.name}</h1>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xl font-semibold text-brand-700">{company.logo}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">{company.name}</h2>
                {company.verified ? <ShieldCheck className="text-emerald-600" size={18} /> : null}
              </div>
              <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <InfoItem icon={<Building2 size={16} />} label={company.industry} />
                <InfoItem icon={<Users size={16} />} label={company.size} />
                <InfoItem icon={<Globe size={16} />} label={company.website} />
                <InfoItem icon={<MapPin size={16} />} label={company.address} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge label={company.verified ? "Đã xác thực" : "Chưa xác thực"} tone={company.verified ? "success" : "warning"} />
                <StatusBadge label={`${company.openJobs} việc đang tuyển`} tone="success" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Copy size={16} />} onClick={() => void copyText("website", company.website)}>Copy website</Button>
            <Button variant="secondary" icon={<Copy size={16} />} onClick={() => void copyText("địa chỉ", company.address)}>Copy địa chỉ</Button>
          </div>
        </div>
      </section>

      <div className="mt-5">
        <Tabs items={tabs} value={activeTab} onChange={changeTab} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <main className="space-y-5">
          {activeTab === "about" ? (
            <>
              <Card>
                <SectionHeader title="Giới thiệu công ty" />
                <p className="text-sm leading-6 text-slate-700">{company.description}</p>
              </Card>
              <Card>
                <SectionHeader title="Sứ mệnh" />
                <p className="text-sm leading-6 text-slate-700">{company.mission}</p>
              </Card>
              <Card>
                <SectionHeader title="Giá trị cốt lõi" />
                <div className="flex flex-wrap gap-2">{company.coreValues.map((value) => <StatusBadge key={value} label={value} tone="success" />)}</div>
              </Card>
              <Card>
                <SectionHeader title="Thông tin doanh nghiệp" />
                <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <InfoBlock label="Lĩnh vực" value={company.industry} />
                  <InfoBlock label="Quy mô" value={company.size} />
                  <InfoBlock label="Năm thành lập" value={String(company.foundedYear)} />
                  <InfoBlock label="Website" value={company.website} />
                  <InfoBlock label="Chi nhánh" value={company.branches.join(", ")} />
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === "jobs" ? (
            <div id="jobs">
              <Card>
                <SectionHeader title="Việc làm đang tuyển" description="Tìm kiếm và lọc các vị trí đang mở tại công ty này." />
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <Input label="Search trong công ty" value={jobQuery} onChange={(event) => { setJobQuery(event.target.value); setPage(1); }} placeholder="Tên vị trí, kỹ năng..." />
                  <Select label="Địa điểm" value={jobLocation} onChange={(event) => { setJobLocation(event.target.value); setPage(1); }} options={jobOptions.locations} />
                  <Select label="Loại hình" value={jobType} onChange={(event) => { setJobType(event.target.value); setPage(1); }} options={jobOptions.jobTypes} />
                </div>
                {pagedJobs.length ? (
                  <div className="grid gap-4">
                    {pagedJobs.map((job) => <PublicJobListCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSave={toggleSavedJob} />)}
                  </div>
                ) : (
                  <EmptyState message={jobs.length ? "Không có việc làm phù hợp với bộ lọc hiện tại." : "Công ty hiện chưa có việc làm đang tuyển."} />
                )}
                <div className="mt-5"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
              </Card>
            </div>
          ) : null}

          {activeTab === "benefits" ? (
            <Card>
              <SectionHeader title="Phúc lợi" description="Các chính sách hỗ trợ nhân sự trong quá trình làm việc và phát triển." />
              <div className="grid gap-4 md:grid-cols-2">
                {company.benefits.map((benefit) => (
                  <div key={benefit.title} className="rounded-lg border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-950">{benefit.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {activeTab === "gallery" ? (
            <Card>
              <SectionHeader title="Hình ảnh môi trường làm việc" description="Grid ảnh mock mô phỏng văn phòng, hoạt động đội nhóm và đào tạo." />
              <div className="grid gap-4 sm:grid-cols-2">
                {company.gallery.map((image) => (
                  <button key={image.id} type="button" onClick={() => setSelectedImage(image)} className="overflow-hidden rounded-lg border border-slate-200 text-left hover:border-brand-200">
                    <div className={`flex aspect-video items-end p-4 text-white ${image.tone}`}>
                      <span className="font-semibold">{image.title}</span>
                    </div>
                    <p className="p-4 text-sm text-slate-600">{image.description}</p>
                  </button>
                ))}
              </div>
            </Card>
          ) : null}
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader title="Thông tin nhanh" />
            <div className="space-y-3 text-sm text-slate-700">
              <InfoItem icon={<Users size={16} />} label={company.size} />
              <InfoItem icon={<MapPin size={16} />} label={company.address} />
              <InfoItem icon={<Globe size={16} />} label={company.website} />
              <InfoItem icon={<CalendarDays size={16} />} label={`Thành lập ${company.foundedYear}`} />
              <InfoItem icon={<BriefcaseBusiness size={16} />} label={`${company.openJobs} việc đang tuyển`} />
            </div>
            <div className="mt-4 grid gap-2">
              <Button onClick={() => changeTab("jobs")}>Mở việc làm</Button>
              <a href={company.website} target="_blank" rel="noreferrer">
                <Button className="w-full" variant="secondary" icon={<ExternalLink size={16} />}>Mở website</Button>
              </a>
            </div>
          </Card>
        </aside>
      </div>

      <Modal open={Boolean(selectedImage)} title={selectedImage?.title ?? "Hình ảnh"} onClose={() => setSelectedImage(null)}>
        {selectedImage ? (
          <div>
            <div className={`flex aspect-video items-end rounded-lg p-5 text-white ${selectedImage.tone}`}>
              <span className="text-lg font-semibold">{selectedImage.title}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{selectedImage.description}</p>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}

function readTabFromHash(hash: string): CompanyTab {
  const value = hash.replace("#", "");
  if (value === "jobs" || value === "benefits" || value === "gallery") return value;
  return "about";
}

function InfoItem({ icon, label }: { icon: ReactNode; label: string }) {
  return <p className="flex items-center gap-2">{icon} <span>{label}</span></p>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-800">{value}</p>
    </div>
  );
}
