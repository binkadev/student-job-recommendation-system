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
import { Checkbox } from "../../components/ui/Checkbox";
import { Drawer } from "../../components/ui/Drawer";
import { Input } from "../../components/ui/Input";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { Select } from "../../components/ui/Select";
import { JobsListSkeleton } from "../../features/public/jobs/JobsListSkeleton";
import { PublicJobListCard } from "../../features/public/jobs/PublicJobListCard";
import { getJobsFilterOptions, getPublicJobs } from "../../features/public/jobs/jobsListService";
import type { JobsListFilters, JobsSort } from "../../features/public/jobs/jobsListTypes";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useSavedJobs } from "../../hooks/useSavedJobs";

const emptyOption = { label: "Tất cả", value: "" };

const salaryOptions = [
  emptyOption,
  { label: "Dưới 10 triệu", value: "under-10" },
  { label: "Từ 10 triệu", value: "10-20" },
  { label: "Từ 20 triệu", value: "20-35" },
  { label: "Từ 35 triệu", value: "over-35" },
];

const experienceOptions = [
  emptyOption,
  { label: "Thực tập", value: "intern" },
  { label: "Từ 1 năm", value: "1" },
  { label: "Từ 3 năm", value: "3" },
  { label: "Từ 5 năm", value: "5" },
];

const postedDateOptions = [
  emptyOption,
  { label: "7 ngày gần đây", value: "7-days" },
  { label: "30 ngày gần đây", value: "30-days" },
];

const sortOptions = [
  { label: "Mới nhất", value: "latest" },
  { label: "Phù hợp nhất", value: "match" },
  { label: "Lương cao nhất", value: "salary" },
  { label: "Sắp hết hạn", value: "deadline" },
];

const labelMaps: Record<string, Record<string, string>> = {
  salary: Object.fromEntries(salaryOptions.map((option) => [option.value, option.label])),
  experience: Object.fromEntries(experienceOptions.map((option) => [option.value, option.label])),
  postedDate: Object.fromEntries(postedDateOptions.map((option) => [option.value, option.label])),
};

function readFilters(searchParams: URLSearchParams): JobsListFilters {
  const sortParam = searchParams.get("sort");
  return {
    keyword: searchParams.get("q") ?? "",
    locations: splitParam(searchParams.get("locations") ?? searchParams.get("location")),
    industries: splitParam(searchParams.get("industries") ?? searchParams.get("industry")),
    salary: searchParams.get("salary") ?? "",
    experience: searchParams.get("experience") ?? "",
    level: searchParams.get("level") ?? "",
    jobType: searchParams.get("jobType") ?? "",
    workMode: searchParams.get("workMode") ?? "",
    postedDate: searchParams.get("postedDate") ?? "",
    featured: searchParams.get("featured") === "true",
    sort: isSort(sortParam) ? sortParam : "latest",
    page: Number(searchParams.get("page") ?? 1) || 1,
  };
}

function splitParam(value: string | null) {
  return value ? value.split(",").filter(Boolean) : [];
}

function isSort(value: string | null): value is JobsSort {
  return Boolean(value && ["latest", "match", "salary", "deadline"].includes(value));
}

function writeFilters(filters: JobsListFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("q", filters.keyword);
  if (filters.locations.length) params.set("locations", filters.locations.join(","));
  if (filters.industries.length) params.set("industries", filters.industries.join(","));
  if (filters.salary) params.set("salary", filters.salary);
  if (filters.experience) params.set("experience", filters.experience);
  if (filters.level) params.set("level", filters.level);
  if (filters.jobType) params.set("jobType", filters.jobType);
  if (filters.workMode) params.set("workMode", filters.workMode);
  if (filters.postedDate) params.set("postedDate", filters.postedDate);
  if (filters.featured) params.set("featured", "true");
  if (filters.sort !== "latest") params.set("sort", filters.sort);
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
      locations: splitParam(String(form.get("location") ?? "")),
      page: 1,
    });
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams());
  }

  const activeChips = getActiveChips(filters);
  const result = jobsQuery.data;

  const filterPanel = (
    <div className="space-y-4">
      <MultiSelect label="Ngành nghề" value={filters.industries} onChange={(value) => updateFilter("industries", value)} options={filterOptions.industries.map((value) => ({ label: value, value }))} />
      <MultiSelect label="Địa điểm" value={filters.locations} onChange={(value) => updateFilter("locations", value)} options={filterOptions.locations.map((value) => ({ label: value, value }))} />
      <Select label="Khoảng lương" value={filters.salary} onChange={(event) => updateFilter("salary", event.target.value)} options={salaryOptions} />
      <Select label="Số năm kinh nghiệm" value={filters.experience} onChange={(event) => updateFilter("experience", event.target.value)} options={experienceOptions} />
      <Select label="Cấp bậc" value={filters.level} onChange={(event) => updateFilter("level", event.target.value)} options={[emptyOption, ...filterOptions.levels.map((value) => ({ label: value, value }))]} />
      <Select label="Loại hình công việc" value={filters.jobType} onChange={(event) => updateFilter("jobType", event.target.value)} options={[emptyOption, ...filterOptions.jobTypes.map((value) => ({ label: value, value }))]} />
      <Select label="Onsite, hybrid hoặc remote" value={filters.workMode} onChange={(event) => updateFilter("workMode", event.target.value)} options={[emptyOption, ...filterOptions.workModes.map((value) => ({ label: value, value }))]} />
      <Select label="Ngày đăng" value={filters.postedDate} onChange={(event) => updateFilter("postedDate", event.target.value)} options={postedDateOptions} />
      <Checkbox label="Chỉ xem việc làm nổi bật" checked={filters.featured} onChange={(event) => updateFilter("featured", event.target.checked)} />
      <Button type="button" variant="secondary" className="w-full" onClick={clearAllFilters}>Xóa toàn bộ filter</Button>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader title="Danh sách việc làm" description="Tìm kiếm, lọc, sắp xếp và lưu các việc làm phù hợp với kỹ năng, địa điểm và mục tiêu nghề nghiệp của bạn." />

      <Card className="mb-5">
        <form key={searchParams.toString()} onSubmit={handleSearch} className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
          <Input label="Từ khóa" name="keyword" defaultValue={filters.keyword} placeholder="Vị trí, công ty, kỹ năng" />
          <Select label="Địa điểm" name="location" defaultValue={filters.locations[0] ?? ""} options={[emptyOption, ...filterOptions.locations.map((value) => ({ label: value, value }))]} />
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
                <Select label="Sắp xếp" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value as JobsSort)} options={sortOptions} />
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
    currentFilters.locations.forEach((value) => chips.push({ key: "locations", value, label: value, onRemove: () => updateFilter("locations", currentFilters.locations.filter((item) => item !== value)) }));
    currentFilters.industries.forEach((value) => chips.push({ key: "industries", value, label: value, onRemove: () => updateFilter("industries", currentFilters.industries.filter((item) => item !== value)) }));
    if (currentFilters.salary) chips.push({ key: "salary", value: currentFilters.salary, label: labelMaps.salary[currentFilters.salary], onRemove: () => updateFilter("salary", "") });
    if (currentFilters.experience) chips.push({ key: "experience", value: currentFilters.experience, label: labelMaps.experience[currentFilters.experience], onRemove: () => updateFilter("experience", "") });
    if (currentFilters.level) chips.push({ key: "level", value: currentFilters.level, label: currentFilters.level, onRemove: () => updateFilter("level", "") });
    if (currentFilters.jobType) chips.push({ key: "jobType", value: currentFilters.jobType, label: currentFilters.jobType, onRemove: () => updateFilter("jobType", "") });
    if (currentFilters.workMode) chips.push({ key: "workMode", value: currentFilters.workMode, label: currentFilters.workMode, onRemove: () => updateFilter("workMode", "") });
    if (currentFilters.postedDate) chips.push({ key: "postedDate", value: currentFilters.postedDate, label: labelMaps.postedDate[currentFilters.postedDate], onRemove: () => updateFilter("postedDate", "") });
    if (currentFilters.featured) chips.push({ key: "featured", value: "true", label: "Việc làm nổi bật", onRemove: () => updateFilter("featured", false) });
    return chips;
  }
}
