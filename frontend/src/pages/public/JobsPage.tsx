import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Drawer } from "../../components/ui/Drawer";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { JobsListSkeleton } from "../../features/public/jobs/JobsListSkeleton";
import { PublicJobListCard } from "../../features/public/jobs/PublicJobListCard";
import { getJobsFilterOptions, getPublicJobs } from "../../features/public/jobs/jobsListService";
import type { JobsListFilters } from "../../features/public/jobs/jobsListTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";

const emptyOption = { label: "Tất cả", value: "" };

function readFilters(searchParams: URLSearchParams): JobsListFilters {
  return {
    keyword: searchParams.get("q") ?? "",
    location: searchParams.get("location") ?? "",
    jobType: searchParams.get("jobType") ?? "",
    workingModel: searchParams.get("workingModel") ?? searchParams.get("workMode") ?? "",
    page: Number(searchParams.get("page") ?? 1) || 1,
  };
}

function writeFilters(filters: JobsListFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("q", filters.keyword);
  if (filters.location) params.set("location", filters.location);
  if (filters.jobType) params.set("jobType", filters.jobType);
  if (filters.workingModel) params.set("workingModel", filters.workingModel);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function JobsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSaved, toggleSavedJob } = useSavedJobs();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const filterOptions = useMemo(() => getJobsFilterOptions(), []);
  const jobsQuery = useAsyncData(() => getPublicJobs(filters), [searchParams.toString(), reloadKey]);

  useEffect(() => {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [filters.page]);

  function applyFilters(nextFilters: JobsListFilters) {
    setSearchParams(writeFilters(nextFilters));
  }

  function updateFilter<Key extends keyof JobsListFilters>(key: Key, value: JobsListFilters[Key], resetPage = true) {
    applyFilters({ ...filters, [key]: value, page: resetPage ? 1 : filters.page });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    applyFilters({
      ...filters,
      keyword: String(form.get("keyword") ?? "").trim(),
      location: String(form.get("location") ?? ""),
      page: 1,
    });
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams());
  }

  const activeChips = getActiveChips(filters);
  const result = jobsQuery.data;
  const locationOptions = filters.location && !filterOptions.locations.some((option) => option.value === filters.location)
    ? [emptyOption, { label: filters.location, value: filters.location }, ...filterOptions.locations]
    : [emptyOption, ...filterOptions.locations];

  const filterPanel = (
    <div className="space-y-4">
      <Input label="Địa điểm" value={filters.location} onChange={(event) => updateFilter("location", event.target.value)} placeholder="Nhập tỉnh/thành phố" />
      <Select label="Loại hình công việc" value={filters.jobType} onChange={(event) => updateFilter("jobType", event.target.value)} options={[emptyOption, ...filterOptions.jobTypes]} />
      <Select label="Onsite, hybrid hoặc remote" value={filters.workingModel} onChange={(event) => updateFilter("workingModel", event.target.value)} options={[emptyOption, ...filterOptions.workModes]} />
      <Card>
        <p className="text-sm leading-6 text-slate-600">Backend hiện hỗ trợ filter theo từ khóa, địa điểm, loại việc, hình thức làm việc và phân trang. Các filter lương, kinh nghiệm, cấp bậc, ngành nghề sẽ bổ sung sau khi có API.</p>
      </Card>
      <Button type="button" variant="secondary" className="w-full" onClick={clearAllFilters}>Xóa toàn bộ filter</Button>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader title="Danh sách việc làm" description="Tìm kiếm và lọc việc làm theo dữ liệu public từ backend." />

      <Card className="mb-5">
        <form key={searchParams.toString()} onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
          <Input label="Từ khóa" name="keyword" defaultValue={filters.keyword} placeholder="Vị trí, công ty, kỹ năng" />
          <Select label="Địa điểm" name="location" defaultValue={filters.location} options={locationOptions} />
          <Button type="submit" className="self-end">Tìm kiếm</Button>
        </form>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:block">
          <Card>
            <SectionHeader title="Bộ lọc" />
            {filterPanel}
          </Card>
        </aside>

        <div ref={resultsRef} className="space-y-4">
          <Card>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{result?.totalItems ?? 0} kết quả phù hợp</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeChips.map((chip) => (
                    <button key={`${chip.key}-${chip.value}`} type="button" onClick={() => chip.onRemove()} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                      {chip.label} <X size={12} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" icon={<SlidersHorizontal size={16} />} onClick={() => setDrawerOpen(true)} className="lg:hidden">Lọc</Button>
                <Button type="button" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>Tải lại</Button>
              </div>
            </div>
          </Card>

          {jobsQuery.loading ? <JobsListSkeleton /> : null}
          {jobsQuery.error ? (
            <div>
              <ErrorState message={jobsQuery.error} />
              <div className="mt-3"><Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button></div>
            </div>
          ) : null}
          {!jobsQuery.loading && !jobsQuery.error && result?.items.length === 0 ? (
            <Card>
              <EmptyState message="Không có kết quả phù hợp với bộ lọc hiện tại." />
              <div className="mt-4"><Button variant="secondary" onClick={clearAllFilters}>Xóa filter</Button></div>
            </Card>
          ) : null}

          {!jobsQuery.loading && !jobsQuery.error ? (
            <div className="grid gap-4">
              {result?.items.map((job) => <PublicJobListCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSave={toggleSavedJob} />)}
            </div>
          ) : null}

          <Pagination page={result?.page ?? filters.page} totalPages={result?.totalPages ?? 1} onPageChange={(page) => updateFilter("page", page, false)} />
        </div>
      </div>

      <Drawer open={drawerOpen} title="Bộ lọc việc làm" onClose={() => setDrawerOpen(false)}>
        {filterPanel}
      </Drawer>
    </PageContainer>
  );

  function getActiveChips(currentFilters: JobsListFilters) {
    const chips: Array<{ key: string; value: string; label: string; onRemove: () => void }> = [];
    if (currentFilters.keyword) chips.push({ key: "keyword", value: currentFilters.keyword, label: currentFilters.keyword, onRemove: () => updateFilter("keyword", "") });
    if (currentFilters.location) chips.push({ key: "location", value: currentFilters.location, label: currentFilters.location, onRemove: () => updateFilter("location", "") });
    if (currentFilters.jobType) {
      const label = filterOptions.jobTypes.find((option) => option.value === currentFilters.jobType)?.label ?? currentFilters.jobType;
      chips.push({ key: "jobType", value: currentFilters.jobType, label, onRemove: () => updateFilter("jobType", "") });
    }
    if (currentFilters.workingModel) {
      const label = filterOptions.workModes.find((option) => option.value === currentFilters.workingModel)?.label ?? currentFilters.workingModel;
      chips.push({ key: "workingModel", value: currentFilters.workingModel, label, onRemove: () => updateFilter("workingModel", "") });
    }
    return chips;
  }
}
