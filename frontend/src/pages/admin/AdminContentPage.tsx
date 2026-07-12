import { useMemo, useState } from "react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Table } from "../../components/ui/Table";
import { Textarea } from "../../components/ui/Textarea";
import { useToast } from "../../hooks/useToast";

type ContentKind = "article" | "banner" | "page";
type ContentItem = {
  id: string;
  kind: ContentKind;
  title: string;
  status: "published" | "draft" | "scheduled";
  owner: string;
  updatedAt: string;
};

const initialItems: ContentItem[] = [
  { id: "content-1", kind: "article", title: "Cách viết CV thực tập IT nổi bật", status: "published", owner: "Admin nội dung", updatedAt: "2026-07-02" },
  { id: "content-2", kind: "article", title: "Bộ câu hỏi phỏng vấn Frontend Intern", status: "draft", owner: "Admin nội dung", updatedAt: "2026-07-04" },
  { id: "content-3", kind: "banner", title: "Banner chiến dịch tuyển dụng mùa hè", status: "scheduled", owner: "Marketing", updatedAt: "2026-07-05" },
  { id: "content-4", kind: "page", title: "Điều khoản sử dụng", status: "published", owner: "Pháp chế", updatedAt: "2026-06-28" },
];

const kindLabels: Record<ContentKind, string> = {
  article: "Bài viết",
  banner: "Banner",
  page: "Trang nội dung",
};

export function AdminContentPage({ mode = "all" }: { mode?: "all" | ContentKind }) {
  const { showToast } = useToast();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const kind = mode === "all" ? "" : mode;

  const filteredItems = useMemo(() => items.filter((item) => (!kind || item.kind === kind) && (!query || item.title.toLowerCase().includes(query.toLowerCase()))), [items, kind, query]);

  function saveItem() {
    const nextKind: ContentKind = kind || "article";
    setItems((current) => [{ id: `content-${Date.now()}`, kind: nextKind, title: title || "Nội dung mới", status: "draft", owner: "Quản trị viên", updatedAt: "2026-07-11" }, ...current]);
    setModalOpen(false);
    setTitle("");
    showToast({ type: "success", title: "Đã lưu nội dung mock" });
  }

  function updateStatus(id: string, status: ContentItem["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status, updatedAt: "2026-07-11" } : item));
    showToast({ type: "success", title: "Đã cập nhật trạng thái nội dung" });
  }

  return (
    <PageContainer>
      <PageHeader title="Quản lý nội dung" description="Quản trị bài viết cẩm nang, banner và trang nội dung công khai của hệ thống." />
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setModalOpen(true)}>Tạo nội dung</Button>
      </div>
      <Card className="mb-5">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Tìm kiếm" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select label="Loại nội dung" value={kind} onChange={() => undefined} options={[{ label: "Tất cả", value: "" }, { label: "Bài viết", value: "article" }, { label: "Banner", value: "banner" }, { label: "Trang nội dung", value: "page" }]} />
          <Button className="self-end" variant="secondary" onClick={() => showToast({ type: "success", title: "Đã xem trước giao diện công khai" })}>Xem trước</Button>
        </div>
      </Card>
      <Table rows={filteredItems} getRowKey={(item) => item.id} columns={[
        { key: "title", header: "Tiêu đề", render: (item) => item.title },
        { key: "kind", header: "Loại", render: (item) => kindLabels[item.kind] },
        { key: "owner", header: "Phụ trách", render: (item) => item.owner },
        { key: "status", header: "Trạng thái", render: (item) => <StatusBadge label={item.status === "published" ? "Đã xuất bản" : item.status === "scheduled" ? "Đã lên lịch" : "Bản nháp"} tone={item.status === "published" ? "success" : "warning"} /> },
        { key: "actions", header: "Thao tác", render: (item) => <div className="flex gap-2"><Button size="sm" onClick={() => updateStatus(item.id, "published")}>Xuất bản</Button><Button size="sm" variant="secondary" onClick={() => updateStatus(item.id, "draft")}>Lưu nháp</Button></div> },
      ]} />
      <Modal open={modalOpen} title="Tạo nội dung" onClose={() => setModalOpen(false)}>
        <SectionHeader title="Thông tin nội dung" />
        <Input label="Tiêu đề" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Textarea className="mt-3" label="Nội dung tóm tắt" placeholder="Nhập mô tả ngắn hiển thị trên giao diện công khai" />
        <div className="mt-4"><Button onClick={saveItem}>Lưu</Button></div>
      </Modal>
    </PageContainer>
  );
}
