import {
  Bell,
  Briefcase,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  RefreshCw,
  Shield,
  Sparkles,
} from "lucide-react";
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
import {
  listNotifications,
  markRead,
  notificationMessage,
  notificationPath,
  notificationTitle,
  notificationTypes,
  NOTIFICATIONS_CHANGED,
  type Notification,
  type NotificationPage,
} from "./notificationsApi";
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
    listNotifications(filter.page, filter.unread, filter.type)
      .then((value) => {
        if (!active || !alive()) return;
        if (filter.page > Math.max(1, value.totalPages)) {
          setFilter((current) => ({ ...current, page: Math.max(1, value.totalPages) }));
          return;
        }
        setData({ key, value });
        setError(null);
        setUnverified(false);
      })
      .catch((e) => {
        if (active && alive()) {
          setError(getApiErrorMessage(e, "Không thể tải thông báo. Dữ liệu đã xác nhận được giữ."));
        }
      })
      .finally(() => {
        if (active && alive()) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, key, reload, alive]);

  function refresh() {
    setReload((value) => value + 1);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  }

  async function read(notification?: Notification, open = false) {
    if (busy.current || unverified || !alive()) return;
    if (notification?.isRead) {
      if (open) navigate(notificationPath(notification, role));
      return;
    }
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await markRead(notification?.id);
      if (!alive()) return;
      if (filter.unread) setFilter((current) => ({ ...current, page: 1 }));
      else setReload((value) => value + 1);
      if (!notification) showToast({ type: "success", title: "Đã đánh dấu tất cả đã đọc" });
      if (open && notification) navigate(notificationPath(notification, role));
    } catch (e) {
      if (!alive()) return;
      const message = getApiErrorMessage(
        e,
        "Chưa xác nhận được kết quả. Hãy tải lại thông báo trước khi thử lại.",
      );
      setError(message);
      setUnverified(true);
      showToast({ type: "error", title: "Không thể đánh dấu đã đọc", message });
    } finally {
      busy.current = false;
      if (alive()) setPending(false);
    }
  }

  const countLabel =
    unread.count === null
      ? "Chưa xác minh số thông báo chưa đọc."
      : `Bạn có ${unread.count} thông báo chưa đọc.${unread.failed ? " Chưa đồng bộ lại được." : ""}`;

  return (
    <section aria-label="Danh sách thông báo" className="space-y-4">
      {/* Unread status bar */}
      <div className="flex items-center gap-2 px-1 text-sm font-medium text-slate-600">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            unread.count && unread.count > 0 ? "bg-amber-500 animate-pulse" : "bg-[#134B43]"
          }`}
        />
        <p role="status" aria-live="polite" aria-atomic="true">
          {countLabel}
        </p>
      </div>

      {/* Control Card: Tabs, Filter Select, and Actions */}
      <Card className="border border-slate-200/80 bg-white p-5 shadow-sm rounded-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Tabs
            items={[
              { label: "Tất cả", value: "all" },
              {
                label: `Chưa đọc${unread.count === null ? "" : ` (${unread.count})`}`,
                value: "unread",
              },
            ]}
            value={filter.unread ? "unread" : "all"}
            onChange={(value) => setFilter((current) => ({ ...current, unread: value === "unread", page: 1 }))}
          />

          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-[180px]">
              <Select
                label="Loại thông báo"
                value={filter.type}
                options={[
                  { label: "Tất cả", value: "" },
                  ...Object.entries(notificationTypes).map(([value, label]) => ({ value, label })),
                ]}
                onChange={(event) =>
                  setFilter((current) => ({ ...current, type: event.target.value, page: 1 }))
                }
              />
            </div>
            <Button
              variant="secondary"
              className="rounded-xl border-slate-200"
              icon={<CheckCheck className="h-4 w-4 text-[#134B43]" />}
              loading={pending}
              disabled={loading || unverified || unread.count === null || unread.count === 0 || unread.failed}
              onClick={() => void read()}
            >
              Đánh dấu tất cả đã đọc
            </Button>
            <Button
              variant="secondary"
              className="rounded-xl border-slate-200"
              icon={<RefreshCw className="h-4 w-4" />}
              disabled={loading || pending}
              onClick={refresh}
            >
              Tải lại thông báo
            </Button>
          </div>
        </div>
      </Card>

      {/* Error & Loading States */}
      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState /> : null}

      {/* Notification Results */}
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {result.totalItems} thông báo phù hợp
            </p>
          </div>

          {result.items.length === 0 ? (
            <Card className="border border-slate-200/80 bg-white p-8 text-center shadow-sm rounded-2xl">
              <EmptyState message="Không có thông báo phù hợp." />
            </Card>
          ) : (
            <div className="grid gap-3">
              {result.items.map((item) => (
                <Card
                  key={item.id}
                  className={`transition-all rounded-2xl p-5 ${
                    item.isRead
                      ? "border border-slate-200/80 bg-white shadow-sm hover:border-slate-300 hover:shadow-md"
                      : "relative border border-[#134B43]/30 bg-[#F0FAF8]/60 shadow-sm hover:border-[#134B43]/50 hover:shadow-md overflow-hidden"
                  }`}
                >
                  {!item.isRead ? (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#134B43]" />
                  ) : null}

                  <article className="space-y-3 break-words" aria-label={item.title}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        {renderTypeIcon(item.type)}
                        <h2 className="text-base font-bold text-slate-950">
                          {notificationTitle(item.title)}
                        </h2>
                        <StatusBadge label={notificationTypes[item.type] ?? item.type} />
                        <StatusBadge
                          label={item.isRead ? "Đã đọc" : "Chưa đọc"}
                          tone={item.isRead ? "neutral" : "warning"}
                        />
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {new Intl.DateTimeFormat("vi-VN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(item.createdAt))}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-700">
                      {notificationMessage(item.message)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                      <Button
                        size="sm"
                        className="rounded-xl bg-[#134B43] text-white hover:bg-[#0F3E37]"
                        icon={<ExternalLink className="h-3.5 w-3.5" />}
                        disabled={pending || unverified}
                        onClick={() => void read(item, true)}
                      >
                        Mở
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                        icon={<Check className="h-3.5 w-3.5" />}
                        disabled={loading || pending || unverified || item.isRead}
                        onClick={() => void read(item)}
                      >
                        Đánh dấu đã đọc
                      </Button>
                    </div>
                  </article>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              onPageChange={(page) => {
                if (!pending && !loading) setFilter((current) => ({ ...current, page }));
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function renderTypeIcon(type: string) {
  switch (type) {
    case "APPLICATION":
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[#134B43]">
          <Briefcase className="h-4 w-4" />
        </span>
      );
    case "RECOMMENDATION":
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-100 text-[#0C111C]">
          <Sparkles className="h-4 w-4" />
        </span>
      );
    case "SYSTEM":
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Shield className="h-4 w-4" />
        </span>
      );
    default:
      return (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Bell className="h-4 w-4" />
        </span>
      );
  }
}
