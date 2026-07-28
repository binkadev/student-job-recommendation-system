import { useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/feedback/EmptyState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";

type ContentKind = "article" | "banner" | "page";
type ContentStatus = "draft" | "published" | "scheduled";

interface ContentItem {
  id: number;
  kind: ContentKind;
  title: string;
  status: ContentStatus;
  ownerUserId: number;
  slug: string;
  updatedAt: string;
}

const kindLabels: Record<ContentKind, string> = {
  article: "Bài viết",
  banner: "Banner",
  page: "Trang nội dung",
};

const statusLabels: Record<ContentStatus, string> = {
  draft: "Bản nháp",
  published: "Đã xuất bản",
  scheduled: "Đã lên lịch",
};

export function AdminContentPage({ mode = "all" }: { mode?: "all" | ContentKind }) {
  const [filters, setFilters] = useState({
    title: "",
    kind: mode === "all" ? "" : mode,
    status: "",
  });

  function updateFilter(key: keyof typeof filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý nội dung" description="Trang giữ khung quản trị bài viết, banner và trang nội dung. Backend hiện chưa có DB/API content." />

      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Tiêu đề" value={filters.title} onChange={(event) => updateFilter("title", event.target.value)} placeholder="title" disabled />
          <Select label="Loại nội dung" value={filters.kind} onChange={(event) => updateFilter("kind", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(kindLabels).map(([value, label]) => ({ value, label }))]} disabled={mode !== "all"} />
          <Select label="Trạng thái" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} options={[{ label: "Tất cả", value: "" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} disabled />
        </div>
      </Card>

      <Card className="mb-5">
        <p className="text-sm font-medium text-slate-900">Tổng nội dung: 0</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">Backend chưa có bảng/API cho articles, banners hoặc content pages. Trang không dùng dữ liệu mock.</p>
      </Card>

      <Table
        rows={[] as ContentItem[]}
        getRowKey={(item) => String(item.id)}
        columns={[
          { key: "title", header: "Tiêu đề", render: (item) => <ContentTitle item={item} /> },
          { key: "kind", header: "Loại", render: (item) => kindLabels[item.kind] },
          { key: "status", header: "Trạng thái", render: (item) => <StatusBadge label={statusLabels[item.status]} tone={getStatusTone(item.status)} /> },
          { key: "owner", header: "Phụ trách", render: (item) => `User #${item.ownerUserId}` },
          { key: "updated", header: "Cập nhật", render: (item) => formatDateTime(item.updatedAt) },
        ]}
      />
      <div className="mt-4">
        <EmptyState message="Chưa có API content nên bảng đang hiển thị 0 dòng, không dùng dữ liệu hard-code." />
      </div>

      <Card className="mt-5">
        <SectionHeader title="Field cần có khi bổ sung DB/API" />
        <div className="flex flex-wrap gap-2">
          {["id", "kind", "title", "slug", "status", "owner_user_id", "content", "published_at", "created_at", "updated_at"].map((field) => <StatusBadge key={field} label={field} />)}
        </div>
      </Card>
    </PageContainer>
  );
}

function ContentTitle({ item }: { item: ContentItem }) {
  return (
    <div className="min-w-[220px]">
      <p className="font-medium text-slate-900">{item.title}</p>
      <p className="mt-1 text-xs text-slate-500">{item.slug}</p>
    </div>
  );
}

function getStatusTone(status: ContentStatus) {
  if (status === "published") return "success" as const;
  if (status === "scheduled") return "warning" as const;
  return "neutral" as const;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
