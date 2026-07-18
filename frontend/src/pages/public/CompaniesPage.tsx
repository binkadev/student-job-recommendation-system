import { X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { CompaniesListSkeleton } from "../../features/public/companies/CompaniesListSkeleton";
import { PublicCompanyListCard } from "../../features/public/companies/PublicCompanyListCard";
import { getCompanyFilterOptions, getPublicCompanies } from "../../features/public/companies/companiesListService";
import type { CompaniesListFilters } from "../../features/public/companies/companiesListTypes";
import { useAsyncData } from "../../hooks/useAsyncData";

const emptyOption = { label: "Tất cả", value: "" };

function readFilters(searchParams: URLSearchParams): CompaniesListFilters {
  return {
    keyword: searchParams.get("q") ?? "",
    location: searchParams.get("location") ?? "",
    jobType: searchParams.get("jobType") ?? "",
    workingModel: searchParams.get("workingModel") ?? searchParams.get("workMode") ?? "",
    page: Number(searchParams.get("page") ?? 1) || 1,
  };
}

function writeFilters(filters: CompaniesListFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("q", filters.keyword);
  if (filters.location) params.set("location", filters.location);
  if (filters.jobType) params.set("jobType", filters.jobType);
  if (filters.workingModel) params.set("workingModel", filters.workingModel);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function CompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const filterOptions = useMemo(() => getCompanyFilterOptions(), []);
  const companiesQuery = useAsyncData(() => getPublicCompanies(filters), [searchParams.toString(), reloadKey]);
  const result = companiesQuery.data;

  function applyFilters(nextFilters: CompaniesListFilters) {
    setSearchParams(writeFilters(nextFilters));
  }

  function updateFilter<Key extends keyof CompaniesListFilters>(key: Key, value: CompaniesListFilters[Key], resetPage = true) {
    applyFilters({ ...filters, [key]: value, page: resetPage ? 1 : filters.page });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    applyFilters({
      ...filters,
      keyword: String(form.get("keyword") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
      jobType: String(form.get("jobType") ?? ""),
      workingModel: String(form.get("workingModel") ?? ""),
      page: 1,
    });
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams());
  }

  const activeChips = getActiveChips(filters);

  return (
    <PageContainer>
      <PageHeader title="Danh sách công ty" description="Danh sách công ty được tổng hợp từ các tin tuyển dụng active trong API jobs." />

      <Card className="mb-5">
        <form key={searchParams.toString()} onSubmit={handleSearch} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_220px_auto]">
          <Input label="Tên công ty" name="keyword" defaultValue={filters.keyword} placeholder="Nhập tên công ty" />
          <Input label="Địa điểm" name="location" defaultValue={filters.location} placeholder="Nhập tỉnh/thành phố" />
          <Select label="Loại việc" name="jobType" defaultValue={filters.jobType} options={[emptyOption, ...filterOptions.jobTypes]} />
          <Select label="Hình thức" name="workingModel" defaultValue={filters.workingModel} options={[emptyOption, ...filterOptions.workModes]} />
          <Button type="submit" className="self-end">Tìm kiếm</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" onClick={chip.onRemove} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
              {chip.label} <X size={12} />
            </button>
          ))}
          {activeChips.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>Xóa toàn bộ filter</Button>
          ) : null}
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">{result?.totalItems ?? 0} công ty phù hợp</p>
        <p className="mt-1 text-sm text-slate-600">Backend chưa có API public companies list, nên dữ liệu này được gom từ `companyId` và `companyName` trong jobs.</p>
      </Card>

      {companiesQuery.loading ? <CompaniesListSkeleton /> : null}
      {companiesQuery.error ? (
        <div>
          <ErrorState message={companiesQuery.error} />
          <div className="mt-3"><Button onClick={() => setReloadKey((value) => value + 1)}>Thử lại</Button></div>
        </div>
      ) : null}
      {!companiesQuery.loading && !companiesQuery.error && result?.items.length === 0 ? (
        <Card>
          <EmptyState message={activeChips.length ? "Không tìm thấy công ty phù hợp với bộ lọc hiện tại." : "Chưa có công ty nào từ dữ liệu jobs active."} />
          {activeChips.length ? <div className="mt-4"><Button variant="secondary" onClick={clearAllFilters}>Xóa filter</Button></div> : null}
        </Card>
      ) : null}

      {!companiesQuery.loading && !companiesQuery.error ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {result?.items.map((company) => <PublicCompanyListCard key={company.id} company={company} />)}
        </div>
      ) : null}

      <div className="mt-5">
        <Pagination page={result?.page ?? filters.page} totalPages={result?.totalPages ?? 1} onPageChange={(page) => updateFilter("page", page, false)} />
      </div>
    </PageContainer>
  );

  function getActiveChips(currentFilters: CompaniesListFilters) {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (currentFilters.keyword) chips.push({ key: "keyword", label: currentFilters.keyword, onRemove: () => updateFilter("keyword", "") });
    if (currentFilters.location) chips.push({ key: "location", label: currentFilters.location, onRemove: () => updateFilter("location", "") });
    if (currentFilters.jobType) {
      const label = filterOptions.jobTypes.find((option) => option.value === currentFilters.jobType)?.label ?? currentFilters.jobType;
      chips.push({ key: "jobType", label, onRemove: () => updateFilter("jobType", "") });
    }
    if (currentFilters.workingModel) {
      const label = filterOptions.workModes.find((option) => option.value === currentFilters.workingModel)?.label ?? currentFilters.workingModel;
      chips.push({ key: "workingModel", label, onRemove: () => updateFilter("workingModel", "") });
    }
    return chips;
  }
}
