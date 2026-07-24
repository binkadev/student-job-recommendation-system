import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { httpClient } from "../../services/api/httpClient";

type CategoryType = "industry" | "jobTitle" | "skill" | "location" | "jobType" | "experienceLevel";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errorCode?: string;
}

interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

interface SkillResponse {
  id: number;
  name: string;
  normalizedName: string;
  category: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SkillFilters {
  keyword: string;
  category: string;
  page: number;
}

interface SkillForm {
  name: string;
  category: string;
  description: string;
}

const typeMap: Record<string, CategoryType> = {
  industries: "industry",
  "job-titles": "jobTitle",
  skills: "skill",
  locations: "location",
  "job-types": "jobType",
  "experience-levels": "experienceLevel",
};

const categoryTypeLabels: Record<CategoryType, string> = {
  industry: "Ngành nghề",
  jobTitle: "Chức danh",
  skill: "Kỹ năng",
  location: "Địa điểm",
  jobType: "Loại việc làm",
  experienceLevel: "Cấp bậc kinh nghiệm",
};

const emptyForm: SkillForm = {
  name: "",
  category: "",
  description: "",
};

const pageSize = 10;

export function AdminCategoriesPage() {
  const { pathname } = useLocation();
  const currentType = typeMap[pathname.split("/").pop() ?? ""] ?? "industry";

  if (currentType === "skill") {
    return <SkillCategoryManager />;
  }

  return <UnsupportedCategoryManager categoryType={currentType} />;
}

function SkillCategoryManager() {
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<SkillFilters>({ keyword: "", category: "", page: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SkillResponse | null>(null);
  const [form, setForm] = useState<SkillForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const skillsQuery = useAsyncData(() => getSkills(filters), [reloadKey, filters.keyword, filters.category, filters.page]);
  const result = skillsQuery.data;
  const skills = result?.items ?? [];
  const categoryOptions = useMemo(() => unique(skills.map((skill) => skill.category).filter((value): value is string => Boolean(value))).map((value) => ({ label: value, value })), [skills]);

  function updateFilter<Key extends keyof SkillFilters>(key: Key, value: SkillFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  }

  function openCreateModal() {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(item: SkillResponse) {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category ?? "",
      description: item.description ?? "",
    });
    setFormError("");
    setModalOpen(true);
  }

  async function saveItem() {
    const error = validateSkillForm(form);
    if (error) {
      setFormError(error);
      showToast({ type: "error", title: error });
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        description: form.description.trim() || null,
      };
      if (editingItem) {
        await httpClient.put<ApiResponse<SkillResponse>>(`/skills/${editingItem.id}`, payload);
        showToast({ type: "success", title: "Đã cập nhật kỹ năng" });
      } else {
        await httpClient.post<ApiResponse<SkillResponse>>("/skills", payload);
        showToast({ type: "success", title: "Đã thêm kỹ năng" });
      }
      setModalOpen(false);
      setReloadKey((value) => value + 1);
    } catch {
      showToast({ type: "error", title: "Không thể lưu kỹ năng" });
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý kỹ năng" description="Danh mục kỹ năng dùng bảng skills và API /api/skills." />
      {skillsQuery.error ? <div className="mb-5"><ErrorState message={skillsQuery.error} /></div> : null}

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_240px_auto]">
          <Input label="Tìm kiếm" value={filters.keyword} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="Tên kỹ năng, mô tả..." />
          <Select label="Category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...categoryOptions]} />
          <Button className="self-end" onClick={openCreateModal}>Thêm kỹ năng</Button>
        </div>
      </Card>

      {skillsQuery.loading && !skillsQuery.data ? <LoadingState /> : null}
      {!skillsQuery.loading && skills.length ? (
        <Table
          rows={skills}
          getRowKey={(item) => String(item.id)}
          columns={[
            { key: "name", header: "Tên kỹ năng", render: (item) => <SkillName item={item} /> },
            { key: "category", header: "Category", render: (item) => item.category ? <StatusBadge label={item.category} /> : "Chưa cập nhật" },
            { key: "description", header: "Mô tả", render: (item) => <p className="max-w-md line-clamp-2">{item.description || "Chưa có mô tả"}</p> },
            { key: "created", header: "Ngày tạo", render: (item) => formatDateTime(item.createdAt) },
            { key: "updated", header: "Cập nhật", render: (item) => formatDateTime(item.updatedAt) },
            { key: "actions", header: "Thao tác", render: (item) => <Button size="sm" variant="secondary" onClick={() => openEditModal(item)}>Sửa</Button> },
          ]}
        />
      ) : null}
      {!skillsQuery.loading && !skills.length ? <Card><EmptyState message="Không có kỹ năng phù hợp với bộ lọc hiện tại." /></Card> : null}

      <div className="mt-5">
        <Pagination page={result?.page ?? filters.page} totalPages={result?.totalPages ?? 1} onPageChange={(page) => updateFilter("page", page)} />
      </div>

      <SkillFormModal open={modalOpen} title={editingItem ? "Sửa kỹ năng" : "Thêm kỹ năng"} form={form} error={formError} setForm={setForm} onClose={() => setModalOpen(false)} onSave={() => void saveItem()} />
    </PageContainer>
  );
}

function UnsupportedCategoryManager({ categoryType }: { categoryType: CategoryType }) {
  const label = categoryTypeLabels[categoryType];

  return (
    <PageContainer>
      <PageHeader title={`Quản lý ${label.toLowerCase()}`} description="Danh mục này chưa có API/backend riêng trong scope hiện tại." />
      <Card>
        <EmptyState message={`Backend hiện chưa có API quản lý ${label.toLowerCase()}. Trang chỉ giữ khung điều hướng admin, không hiển thị dữ liệu mock.`} />
        <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
          <Info label="Bảng DB hiện có" value="skills" />
          <Info label="API danh mục hiện có" value="/api/skills" />
          <Info label="Trạng thái dữ liệu" value="0" />
          <Info label="Thao tác thêm/sửa/xóa" value="Chưa có API" />
        </div>
      </Card>
    </PageContainer>
  );
}

function SkillName({ item }: { item: SkillResponse }) {
  return (
    <div className="min-w-[180px]">
      <p className="font-medium text-slate-900">{item.name}</p>
      <p className="mt-1 text-xs text-slate-500">ID: {item.id}</p>
      <p className="mt-1 text-xs text-slate-500">Normalized: {item.normalizedName || "Chưa cập nhật"}</p>
    </div>
  );
}

function SkillFormModal({ open, title, form, error, setForm, onClose, onSave }: { open: boolean; title: string; form: SkillForm; error: string; setForm: (form: SkillForm) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên kỹ năng" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
        <Textarea className="md:col-span-2" label="Mô tả" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={onSave}>Lưu</Button>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <p><span className="font-medium text-slate-500">{label}:</span> <span className="font-medium text-slate-900">{value}</span></p>;
}

async function getSkills(filters: SkillFilters): Promise<PageResponse<SkillResponse>> {
  const response = await httpClient.get<ApiResponse<PageResponse<SkillResponse>>>("/skills", {
    params: {
      page: filters.page,
      size: pageSize,
      keyword: filters.keyword || undefined,
      category: filters.category || undefined,
    },
  });
  return response.data.data;
}

function validateSkillForm(form: SkillForm) {
  if (!form.name.trim()) return "Vui lòng nhập tên kỹ năng.";
  if (form.name.trim().length > 150) return "Tên kỹ năng tối đa 150 ký tự.";
  if (form.category.trim().length > 100) return "Category tối đa 100 ký tự.";
  if (form.description.trim().length > 5000) return "Mô tả tối đa 5000 ký tự.";
  return "";
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
