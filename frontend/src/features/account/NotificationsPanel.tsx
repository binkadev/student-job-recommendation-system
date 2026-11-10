import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pagination } from "../../components/common/Pagination";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import { StatusBadge } from "../../components/feedback/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import { Tabs } from "../../components/ui/Tabs";
import { useToast } from "../../hooks/useToast";
import { getApiErrorMessage } from "../../utils/apiErrors";
import { listNotifications, markRead, notificationMessage, notificationPath, notificationTitle, notificationTypes, NOTIFICATIONS_CHANGED, type Notification, type NotificationPage } from "./notificationsApi";
import { useSessionAlive } from "./useSessionAlive";
import { useUnreadCount } from "./useUnreadCount";

export function NotificationsPanel({ role }: { role: "candidate" | "recruiter" }) {
  const [filter, setFilter] = useState({ page: 1, unread: false, type: "" });
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{ key: string; value: NotificationPage } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const busy = useRef(false);
  const alive = useSessionAlive();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const unread = useUnreadCount();
  const key = JSON.stringify(filter);
  const result = data?.key === key ? data.value : null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    listNotifications(filter.page, filter.unread, filter.type).then(value => {
      if (!active || !alive()) return;
      if (filter.page > Math.max(1, value.totalPages)) {
        setFilter(current => ({ ...current, page: Math.max(1, value.totalPages) })); return;
      }
      setData({ key, value }); setError(null); setUnverified(false);
    }).catch(e => {
      if (active && alive()) setError(getApiErrorMessage(e, "Không thể tải thông báo. Dữ liệu đã xác nhận được giữ."));
    }).finally(() => { if (active && alive()) setLoading(false); });
    return () => { active = false; };
  }, [filter, key, reload, alive]);

  function refresh() {
    setReload(value => value + 1);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  }
  async function read(notification?: Notification, open = false) {
    if (busy.current || unverified || !alive()) return;
    if (notification?.isRead) { if (open) navigate(notificationPath(notification, role)); return; }
    busy.current = true; setPending(true); setError(null);
    try {
      await markRead(notification?.id);
      if (!alive()) return;
      if (filter.unread) setFilter(current => ({ ...current, page: 1 }));
      else setReload(value => value + 1);
      if (!notification) showToast({ type: "success", title: "Đã đánh dấu tất cả đã đọc" });
      if (open && notification) navigate(notificationPath(notification, role));
    } catch (e) {
      if (!alive()) return;
      const message = getApiErrorMessage(e, "Chưa xác nhận được kết quả. Hãy tải lại thông báo trước khi thử lại.");
      setError(message); setUnverified(true);
      showToast({ type: "error", title: "Không thể đánh dấu đã đọc", message });
    } finally { busy.current = false; if (alive()) setPending(false); }
  }

  const countLabel = unread.count === null ? "Chưa xác minh số thông báo chưa đọc." : `Bạn có ${unread.count} thông báo chưa đọc.${unread.failed ? " Chưa đồng bộ lại được." : ""}`;
  return <section aria-label="Danh sách thông báo" className="space-y-4">
    <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-slate-600">{countLabel}</p>
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={[{ label: "Tất cả", value: "all" }, { label: `Chưa đọc${unread.count === null ? "" : ` (${unread.count})`}`, value: "unread" }]}
          value={filter.unread ? "unread" : "all"} onChange={value => setFilter(current => ({ ...current, unread: value === "unread", page: 1 }))} />
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Loại thông báo" value={filter.type} options={[{ label: "Tất cả", value: "" }, ...Object.entries(notificationTypes).map(([value, label]) => ({ value, label }))]}
            onChange={event => setFilter(current => ({ ...current, type: event.target.value, page: 1 }))} />
          <Button variant="secondary" loading={pending} disabled={loading || unverified || unread.count === null || unread.count === 0 || unread.failed} onClick={() => void read()}>Đánh dấu tất cả đã đọc</Button>
          <Button variant="secondary" disabled={loading || pending} onClick={refresh}>Tải lại thông báo</Button>
        </div>
      </div>
    </Card>
    {error ? <ErrorState message={error} /> : null}
    {loading ? <LoadingState /> : null}
    {result ? <>
      <p className="text-sm text-slate-600">{result.totalItems} thông báo phù hợp</p>
      {result.items.length === 0 ? <EmptyState message="Không có thông báo phù hợp." /> : <div className="grid gap-3">
        {result.items.map(item => <Card key={item.id} className={item.isRead ? "" : "border-brand-200 bg-brand-50/40"}>
          <article className="space-y-3 break-words" aria-label={item.title}>
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{notificationTitle(item.title)}</h2>
              <StatusBadge label={notificationTypes[item.type] ?? item.type} /><StatusBadge label={item.isRead ? "Đã đọc" : "Chưa đọc"} tone={item.isRead ? "neutral" : "warning"} /></div>
            <p className="text-sm leading-6 text-slate-600">{notificationMessage(item.message)}</p>
            <p className="text-xs text-slate-500">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending || unverified} onClick={() => void read(item, true)}>Mở</Button>
              <Button variant="secondary" disabled={loading || pending || unverified || item.isRead} onClick={() => void read(item)}>Đánh dấu đã đọc</Button>
            </div>
          </article>
        </Card>)}
      </div>}
      <Pagination page={result.page} totalPages={result.totalPages} onPageChange={page => { if (!pending && !loading) setFilter(current => ({ ...current, page })); }} />
    </> : null}
  </section>;
}
