import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { Timeline } from "../../components/ui/Timeline";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useToast } from "../../hooks/useToast";
import { mockAdminService } from "../../services/mock";
import type { CategoryItem } from "../../types/domain";

type CategoryType = CategoryItem["type"];

interface ManagedCategory extends CategoryItem {
  code: string;
  description: string;
  parentId: string;
  usageCount: number;
  updatedAt: string;
}

interface AuditItem {
  id: string;
  label: string;
  at: string;
  note: string;
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

const usageSeed: Record<string, number> = {
  "cat-1": 18,
  "cat-2": 12,
  "cat-3": 15,
  "cat-4": 9,
  "cat-5": 7,
  "cat-6": 21,
  "cat-7": 14,
  "cat-8": 26,
  "cat-9": 22,
  "cat-10": 31,
  "cat-11": 8,
  "cat-12": 16,
  "cat-13": 13,
};

const emptyForm = {
  name: "",
  code: "",
  description: "",
  parentId: "",
  active: "true",
};

export function AdminCategoriesPage() {
  const { pathname } = useLocation();
  const currentType = typeMap[pathname.split("/").pop() ?? ""] ?? "industry";

  return <CategoryManager categoryType={currentType} />;
}

function CategoryManager({ categoryType }: { categoryType: CategoryType }) {
  const { showToast } = useToast();
  const categoriesQuery = useAsyncData(() => mockAdminService.getCategories({ pageSize: 100 }), []);
  const [items, setItems] = useState<ManagedCategory[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedCategory | null>(null);
  const [editingItem, setEditingItem] = useState<ManagedCategory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);

  useEffect(() => {
    if (categoriesQuery.data?.items) setItems(categoriesQuery.data.items.map(enrichCategory));
  }, [categoriesQuery.data?.items]);

  const categoriesByType = useMemo(() => items.filter((item) => item.type === categoryType), [categoryType, items]);
  const parentOptions = useMemo(() => categoriesByType.filter((item) => item.id !== editingItem?.id).map((item) => ({ label: item.name, value: item.id })), [categoriesByType, editingItem?.id]);
  const filteredItems = useMemo(() => categoriesByType
    .filter((item) => {
      const searchable = `${item.name} ${item.code} ${item.description}`.toLowerCase();
      const matchQuery = !query || searchable.includes(query.toLowerCase());
      const matchStatus = !status || String(item.active) === status;
      return matchQuery && matchStatus;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "vi")), [categoriesByType, query, status]);

  function openCreateModal() {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(item: ManagedCategory) {
    setEditingItem(item);
    setForm({
      name: item.name,
      code: item.code,
      description: item.description,
      parentId: item.parentId,
      active: String(item.active),
    });
    setFormError("");
    setModalOpen(true);
  }

  function validateForm() {
    if (!form.name.trim()) return "Vui lòng nhập tên danh mục.";
    if (!form.code.trim()) return "Vui lòng nhập mã danh mục.";
    const normalizedCode = form.code.trim().toLowerCase();
    const duplicated = items.some((item) => item.type === categoryType && item.code.toLowerCase() === normalizedCode && item.id !== editingItem?.id);
    if (duplicated) return "Mã danh mục đã tồn tại.";
    return "";
  }

  async function saveItem() {
    const error = validateForm();
    if (error) {
      setFormError(error);
      showToast({ type: "error", title: error });
      return;
    }

    if (editingItem) {
      const payload: Partial<ManagedCategory> = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        parentId: form.parentId,
        active: form.active === "true",
        updatedAt: new Date().toISOString(),
      };
      setItems((current) => current.map((item) => item.id === editingItem.id ? { ...item, ...payload } : item));
      await mockAdminService.updateCategory(editingItem.id, { name: payload.name, active: payload.active });
      addAudit("Sửa danh mục", `${editingItem.name} được cập nhật.`);
      showToast({ type: "success", title: "Đã cập nhật danh mục" });
    } else {
      const item: ManagedCategory = {
        id: `cat-${Date.now()}`,
        type: categoryType,
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim(),
        parentId: form.parentId,
        usageCount: 0,
        order: categoriesByType.length + 1,
        active: form.active === "true",
        updatedAt: new Date().toISOString(),
      };
      setItems((current) => [item, ...current]);
      await mockAdminService.createCategory(item);
      addAudit("Thêm danh mục", `${item.name} được tạo mới.`);
      showToast({ type: "success", title: "Đã thêm danh mục" });
    }
    setModalOpen(false);
  }

  async function toggleActive(item: ManagedCategory) {
    const nextActive = !item.active;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: nextActive, updatedAt: new Date().toISOString() } : entry));
    await mockAdminService.updateCategory(item.id, { active: nextActive });
    addAudit(nextActive ? "Kích hoạt danh mục" : "Vô hiệu hóa danh mục", item.name);
    showToast({ type: "success", title: nextActive ? "Đã kích hoạt danh mục" : "Đã vô hiệu hóa danh mục" });
  }

  async function deleteItem() {
    if (!deleteTarget) return;
    if (deleteTarget.usageCount > 0) {
      setDeleteTarget(null);
      showToast({ type: "error", title: "Không thể xóa danh mục đang được sử dụng", message: "Hãy chuyển danh mục sang vô hiệu hóa." });
      return;
    }
    setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
    await mockAdminService.deleteCategory(deleteTarget.id);
    addAudit("Xóa danh mục", deleteTarget.name);
    showToast({ type: "success", title: "Đã xóa danh mục" });
    setDeleteTarget(null);
  }

  function addAudit(label: string, note: string) {
    setAuditLogs((current) => [{ id: `audit-${Date.now()}`, label, note, at: new Date().toISOString() }, ...current]);
  }

  return (
    <PageContainer>
      <PageHeader title={`Quản lý ${categoryTypeLabels[categoryType].toLowerCase()}`} description="Quản lý danh mục dùng chung: thêm, sửa, xóa có xác nhận, kích hoạt và vô hiệu hóa." />
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Input label="Tìm kiếm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, mã, mô tả..." />
          <Select label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} options={[{ label: "Tất cả", value: "" }, { label: "Kích hoạt", value: "true" }, { label: "Vô hiệu hóa", value: "false" }]} />
          <Button className="self-end" onClick={openCreateModal}>Thêm</Button>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Table
          rows={filteredItems}
          getRowKey={(item) => item.id}
          columns={[
            { key: "name", header: "Tên", render: (item) => <CategoryName item={item} parentName={getParentName(items, item.parentId)} /> },
            { key: "meta", header: "Mã & mô tả", render: (item) => <CategoryMeta item={item} /> },
            { key: "status", header: "Trạng thái", render: (item) => <StatusBadge label={item.active ? "Kích hoạt" : "Vô hiệu hóa"} tone={item.active ? "success" : "neutral"} /> },
            { key: "updated", header: "Ngày cập nhật", render: (item) => formatDate(item.updatedAt) },
            { key: "actions", header: "Thao tác", render: (item) => <CategoryActions item={item} onEdit={openEditModal} onToggle={toggleActive} onDelete={setDeleteTarget} /> },
          ]}
        />
        <Card>
          <h3 className="text-base font-semibold text-slate-950">Audit log</h3>
          <div className="mt-4">
            <Timeline items={(auditLogs.length ? auditLogs : [{ id: "initial", label: "Khởi tạo danh mục", at: "2026-07-01T09:00:00", note: `Danh mục ${categoryTypeLabels[categoryType].toLowerCase()} sẵn sàng sử dụng.` }]).map((item) => ({ label: item.label, at: item.at, note: item.note }))} />
          </div>
        </Card>
      </div>

      <CategoryFormModal open={modalOpen} title={editingItem ? "Sửa danh mục" : "Thêm danh mục"} form={form} error={formError} parentOptions={parentOptions} setForm={setForm} onClose={() => setModalOpen(false)} onSave={() => void saveItem()} />
      <DeleteConfirmModal target={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => void deleteItem()} />
    </PageContainer>
  );
}

function CategoryName({ item, parentName }: { item: ManagedCategory; parentName: string }) {
  return (
    <div className="min-w-[180px]">
      <p className="font-medium text-slate-900">{item.name}</p>
      <p className="mt-1 text-xs text-slate-500">Cha: {parentName || "Không có"}</p>
    </div>
  );
}

function CategoryMeta({ item }: { item: ManagedCategory }) {
  return (
    <div className="min-w-[180px]">
      <p className="text-sm font-medium text-slate-700">{item.code}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description || "Chưa có mô tả"}</p>
    </div>
  );
}

function CategoryActions({ item, onEdit, onToggle, onDelete }: { item: ManagedCategory; onEdit: (item: ManagedCategory) => void; onToggle: (item: ManagedCategory) => void; onDelete: (item: ManagedCategory) => void }) {
  return (
    <div className="grid w-[104px] gap-2">
      <Button size="sm" variant="secondary" onClick={() => onEdit(item)}>Sửa</Button>
      <Button size="sm" variant="secondary" onClick={() => onToggle(item)}>{item.active ? "Vô hiệu" : "Kích hoạt"}</Button>
      <Button size="sm" variant="danger" onClick={() => onDelete(item)}>Xóa</Button>
    </div>
  );
}

function CategoryFormModal({ open, title, form, error, parentOptions, setForm, onClose, onSave }: { open: boolean; title: string; form: typeof emptyForm; error: string; parentOptions: Array<{ label: string; value: string }>; setForm: (form: typeof emptyForm) => void; onClose: () => void; onSave: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Tên" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input label="Mã" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <Textarea className="md:col-span-2" label="Mô tả" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <Select label="Danh mục cha" value={form.parentId} onChange={(event) => setForm({ ...form, parentId: event.target.value })} options={[{ label: "Không có", value: "" }, ...parentOptions]} />
        <Select label="Trạng thái" value={form.active} onChange={(event) => setForm({ ...form, active: event.target.value })} options={[{ label: "Kích hoạt", value: "true" }, { label: "Vô hiệu hóa", value: "false" }]} />
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={onSave}>Lưu</Button>
      </div>
    </Modal>
  );
}

function DeleteConfirmModal({ target, onClose, onConfirm }: { target: ManagedCategory | null; onClose: () => void; onConfirm: () => void }) {
  const inUse = Boolean(target && target.usageCount > 0);
  return (
    <Modal open={Boolean(target)} title="Xác nhận xóa danh mục" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700"><strong>{target?.name}</strong></p>
        {inUse ? <p className="text-sm text-amber-700">Danh mục đang được sử dụng nên không thể xóa. Hãy chuyển sang vô hiệu hóa.</p> : <p className="text-sm text-slate-700">Bạn có chắc muốn xóa danh mục này không?</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button variant="danger" disabled={inUse} onClick={onConfirm}>Xóa</Button>
        </div>
      </div>
    </Modal>
  );
}

function enrichCategory(item: CategoryItem): ManagedCategory {
  return {
    ...item,
    code: slugify(item.name),
    description: `Danh mục ${item.name} dùng cho bộ lọc và dữ liệu tuyển dụng.`,
    parentId: "",
    usageCount: usageSeed[item.id] ?? 0,
    updatedAt: "2026-07-10T09:00:00",
  };
}

function getParentName(items: ManagedCategory[], parentId: string) {
  return items.find((item) => item.id === parentId)?.name ?? "";
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
