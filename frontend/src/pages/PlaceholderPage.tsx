import { CheckCircle2, ChevronRight, Clock3, Edit3, Save, Send, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { FilterBar } from "../components/common/FilterBar";
import { PageContainer } from "../components/common/PageContainer";
import { PageHeader } from "../components/common/PageHeader";
import { Pagination } from "../components/common/Pagination";
import { SearchBar } from "../components/common/SearchBar";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { StatusBadge } from "../components/feedback/StatusBadge";
import { Breadcrumb } from "../components/navigation/Breadcrumb";
import { getPageContent } from "../mocks/pageContent";
import type { AppRoute } from "../types/navigation";

const nextLabelMap: Record<string, string> = {
  "Tim viec lam": "Tìm việc làm",
  "Xem chi tiet viec lam": "Xem chi tiết việc làm",
  "Dang nhap de ung tuyen": "Đăng nhập để ứng tuyển",
  "Xem cong ty": "Xem công ty",
  "Doc bai viet": "Đọc bài viết",
  "Dang ky ung vien": "Đăng ký ứng viên",
  "Den dang nhap": "Đến đăng nhập",
  "Hoan thien ho so": "Hoàn thiện hồ sơ",
  "Xem viec lam goi y": "Xem việc làm gợi ý",
  "Xem chi tiet": "Xem chi tiết",
  "Cap nhat ho so": "Cập nhật hồ sơ",
  "Thiet lap mong muon": "Thiết lập mong muốn",
  "Quan ly CV": "Quản lý CV",
  "Upload CV": "Tải CV",
  "Xem ket qua phan tich": "Xem kết quả phân tích",
  "Kiem tra du lieu": "Kiểm tra dữ liệu",
  "Xem danh gia CV": "Xem đánh giá CV",
  "Ung tuyen": "Ứng tuyển",
  "Xem don ung tuyen": "Xem đơn ứng tuyển",
  "Xem trang thai": "Xem trạng thái",
  "Xem loi moi": "Xem lời mời",
  "Cap nhat cong ty": "Cập nhật công ty",
  "Chinh sua cong ty": "Chỉnh sửa công ty",
  "Gui xac thuc": "Gửi xác thực",
  "Tao tin tuyen dung": "Tạo tin tuyển dụng",
  "Tao tin moi": "Tạo tin mới",
  "Xem truoc": "Xem trước",
  "Xem ung vien goi y": "Xem ứng viên gợi ý",
  "Xem pipeline": "Xem pipeline",
  "Tao lich phong van": "Tạo lịch phỏng vấn",
  "Duyet tin cho": "Duyệt tin chờ",
  "Duyet tin": "Duyệt tin",
  "Quan ly ky nang": "Quản lý kỹ năng",
};

function toneForStatus(status: string) {
  if (["Hoàn tất", "Đang hiển thị", "Phân tích thành công", "Đã xác nhận", "Nhận offer", "Đã tuyển"].some((item) => status.includes(item))) {
    return "success" as const;
  }
  if (["Chờ", "Đang", "Cần", "Mời", "Bản nháp"].some((item) => status.includes(item))) {
    return "warning" as const;
  }
  if (["Lỗi", "Thất bại", "Từ chối", "Không phù hợp", "Bị"].some((item) => status.includes(item))) {
    return "danger" as const;
  }
  return "neutral" as const;
}

export function PlaceholderPage({ route }: { route: AppRoute }) {
  const content = useMemo(() => getPageContent(route), [route]);
  const [selectedId, setSelectedId] = useState(content.records[0]?.id ?? "");
  const [activeStatus, setActiveStatus] = useState(content.statuses[0] ?? "Đang hoạt động");
  const [actionLog, setActionLog] = useState<string[]>([]);

  const selectedRecord = content.records.find((record) => record.id === selectedId) ?? content.records[0];

  function handlePrimaryAction() {
    setActiveStatus(content.statuses[Math.min(1, content.statuses.length - 1)] ?? activeStatus);
    setActionLog((current) => [`Đã thực hiện: ${content.primaryAction} cho ${selectedRecord?.title ?? "mục đang chọn"}`, ...current].slice(0, 4));
  }

  function handleSecondaryAction() {
    setActiveStatus(content.statuses[Math.min(2, content.statuses.length - 1)] ?? activeStatus);
    setActionLog((current) => [`Đã thực hiện: ${content.secondaryAction}`, ...current].slice(0, 4));
  }

  return (
    <PageContainer>
      <Breadcrumb />
      <PageHeader title={content.title} description={content.description} />

      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3">
          {content.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{metric.label}</p>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</div>
              <p className="mt-2 text-sm text-slate-600">{metric.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchBar placeholder="Tìm theo tên, mã, trạng thái..." />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePrimaryAction}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Send size={16} />
                  {content.primaryAction}
                </button>
                <button
                  onClick={handleSecondaryAction}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Save size={16} />
                  {content.secondaryAction}
                </button>
              </div>
            </div>

            <FilterBar />

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã</th>
                    <th className="px-4 py-3">Thông tin</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    <th className="px-4 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {content.records.map((record) => (
                    <tr key={record.id} className={selectedId === record.id ? "bg-brand-50/70" : "hover:bg-slate-50"}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{record.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{record.title}</div>
                        <div className="mt-1 text-slate-500">{record.subtitle}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={record.status} tone={toneForStatus(record.status)} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{record.meta}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setSelectedId(record.id);
                            setActionLog((current) => [`Đã chọn ${record.title}`, ...current].slice(0, 4));
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
                        >
                          <Edit3 size={14} />
                          Chọn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination />
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Mục đang chọn</h2>
              {selectedRecord ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{selectedRecord.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedRecord.subtitle}</p>
                  </div>
                  <StatusBadge label={activeStatus} tone={toneForStatus(activeStatus)} />
                  <p className="text-sm text-slate-600">{selectedRecord.meta}</p>
                </div>
              ) : (
                <EmptyState />
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Trạng thái nghiệp vụ</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {content.statuses.map((status) => (
                  <button key={status} onClick={() => setActiveStatus(status)}>
                    <StatusBadge label={status} tone={toneForStatus(status)} />
                  </button>
                ))}
              </div>
            </div>

            <ConfirmDialog />
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Luồng thao tác</h2>
            <ol className="mt-4 space-y-3">
              {content.workflow.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <span className="pt-1 text-sm text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Ghi chú triển khai</h2>
            <div className="mt-4 space-y-3">
              {content.notes.map((note, index) => (
                <div key={note} className="flex items-start gap-3 text-sm text-slate-700">
                  {index === 0 ? <CheckCircle2 size={18} className="mt-0.5 text-emerald-600" /> : index === 1 ? <Clock3 size={18} className="mt-0.5 text-amber-600" /> : <XCircle size={18} className="mt-0.5 text-slate-500" />}
                  <span>{note}</span>
                </div>
              ))}
            </div>
            {route.nextPath ? (
              <Link
                to={route.nextPath}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {(route.nextLabel ? nextLabelMap[route.nextLabel] : undefined) ?? "Đi tới bước tiếp theo"}
                <ChevronRight size={16} />
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <LoadingState message="Ví dụ trạng thái đang tải dữ liệu." />
          <EmptyState message="Ví dụ trạng thái chưa có kết quả." />
          <ErrorState message="Ví dụ trạng thái lỗi hoặc không đủ quyền." />
        </section>

        {actionLog.length ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Nhật ký thao tác trên giao diện</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {actionLog.map((log, index) => (
                <li key={`${log}-${index}`}>{log}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
}
