import { Building2, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
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
    industry: searchParams.get("industry") ?? "",
    sort: searchParams.get("sort") ?? "",
    page: Number(searchParams.get("page") ?? 1) || 1,
  };
}

function writeFilters(filters: CompaniesListFilters) {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("q", filters.keyword);
  if (filters.location) params.set("location", filters.location);
  if (filters.industry) params.set("industry", filters.industry);
  if (filters.sort) params.set("sort", filters.sort);
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
      industry: String(form.get("industry") ?? "").trim(),
      sort: String(form.get("sort") ?? ""),
      page: 1,
    });
  }

  function clearAllFilters() {
    setSearchParams(new URLSearchParams());
  }

  const activeChips = getActiveChips(filters);

  return (
    <PageContainer>
      <section className="mb-5 grid gap-5 rounded-lg border border-brand-100 bg-brand-50 p-6 shadow-sm lg:grid-cols-[1fr_260px]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm"><Sparkles size={16} /> Công ty tuyển dụng</p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Khám phá doanh nghiệp và cơ hội IT phù hợp</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Tìm kiếm công ty theo tên, địa điểm, ngành nghề và xem các vị trí đang tuyển.</p>
        </div>
        <div className="relative mx-auto h-40 w-56">
          <div className="absolute bottom-2 left-4 right-4 h-20 rounded-lg bg-white shadow-sm" />
          <div className="absolute left-8 top-4 h-28 w-24 rotate-[-7deg] rounded-md border border-brand-100 bg-white p-3 shadow-md">
            <Building2 size={25} className="text-brand-600" />
            <span className="mt-4 block h-2 rounded bg-brand-100" />
            <span className="mt-2 block h-2 rounded bg-slate-100" />
          </div>
          <div className="absolute right-8 top-8 h-24 w-20 rotate-[8deg] rounded-md border border-slate-200 bg-white p-3 shadow-md">
            <Search size={24} className="text-slate-500" />
            <span className="mt-4 block h-2 rounded bg-brand-100" />
            <span className="mt-2 block h-2 rounded bg-slate-100" />
          </div>
        </div>
      </section>

      <Card className="mb-5">
        <form key={searchParams.toString()} onSubmit={handleSearch} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_220px_auto]">
          <Input label="Tên công ty" name="keyword" defaultValue={filters.keyword} placeholder="Nhập tên công ty" />
          <Input label="Địa điểm" name="location" defaultValue={filters.location} placeholder="Nhập tỉnh/thành phố" />
          <Input label="Ngành nghề" name="industry" defaultValue={filters.industry} placeholder="Nhập ngành nghề" />
          <Select label="Sắp xếp" name="sort" defaultValue={filters.sort} options={[emptyOption, ...filterOptions.sorts]} />
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
        <p className="mt-1 text-sm text-slate-600">Danh sách hiển thị các công ty phù hợp với bộ lọc hiện tại.</p>
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
          <EmptyState message={activeChips.length ? "Không tìm thấy công ty phù hợp với bộ lọc hiện tại." : "Chưa có công ty đã xác thực."} />
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
    if (currentFilters.industry) {
      chips.push({ key: "industry", label: currentFilters.industry, onRemove: () => updateFilter("industry", "") });
    }
    if (currentFilters.sort) {
      const label = filterOptions.sorts.find((option) => option.value === currentFilters.sort)?.label ?? currentFilters.sort;
      chips.push({ key: "sort", label, onRemove: () => updateFilter("sort", "") });
    }
    return chips;
  }
}
