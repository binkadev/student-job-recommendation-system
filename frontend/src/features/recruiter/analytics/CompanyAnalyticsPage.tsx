import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageContainer } from "../../../components/common/PageContainer";
import { PageHeader } from "../../../components/common/PageHeader";
import { Pagination } from "../../../components/common/Pagination";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { AUTH_TOKEN_STORAGE_KEY, httpClient } from "../../../services/api/httpClient";
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { useSessionAlive } from "../../account/useSessionAlive";

const labels = { PENDING: "Chờ xử lý", REVIEWED: "Đã xem", ACCEPTED: "Đã nhận", REJECTED: "Từ chối", WITHDRAWN: "Ứng viên rút đơn" };
interface Detail { id: number; studentName: string; studentEmail: string; jobId: number; jobTitle: string; status: keyof typeof labels; appliedAt: string }
interface Page { items: Detail[]; page: number; size: number; totalItems: number; totalPages: number }
interface Summary { totalApplications: number; uniqueStudents: number; statusCounts: Record<string, number>; acceptedRate: number | null }
interface Trend { bucket: string; applications: number }
interface Performance { jobId: number; jobTitle: string; applications: number; accepted: number; acceptedRate: number | null }
interface Scope { from: string | null; to: string | null; jobId: number | null; status: string | null; keyword: string | null; timeZone: string }
interface Analytics { summary: Summary; scope?: Scope; trend: Trend[]; topJobs: Performance[]; topJobLimit?: number; applications?: Page;
  jobCounts?: Record<string, number>; totalJobs?: number; trendFrom?: string; trendTo?: string; timeZone?: string;
  recentApplications?: Page; expiringJobCount?: number; expiringJobs?: { jobId: number; jobTitle: string; deadline: string }[] }
const endpoint = "/companies/me/recruitment-report";
const jobLabels: Record<string, string> = { DRAFT: "Bản nháp", PENDING_APPROVAL: "Chờ duyệt", ACTIVE: "Đang tuyển", CLOSED: "Đã đóng", REJECTED: "Bị từ chối", EXPIRED: "Hết hạn" };

export function CompanyAnalyticsPage({ dashboard = false }: { dashboard?: boolean }) {
  const { currentUser } = useAuth();
  return <AnalyticsWorkspace key={`${currentUser?.id}:${sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)}:${dashboard}`} dashboard={dashboard} />;
}
function AnalyticsWorkspace({ dashboard }: { dashboard: boolean }) {
  const [days, setDays] = useState("30");
  const [filters, setFilters] = useState({ fromMonth: "", toMonth: "", jobId: "", status: "", keyword: "", page: 1, size: 10 });
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [confirmed, setConfirmed] = useState<{ data: Analytics; key: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportBusy = useRef(false);
  const alive = useSessionAlive();
  const { showToast } = useToast();
  const from = filters.fromMonth ? `${filters.fromMonth}-01` : undefined;
  const to = filters.toMonth ? lastDay(filters.toMonth) : undefined;
  const invalid = from && to && from > to ? "Từ tháng phải nhỏ hơn hoặc bằng đến tháng." : null;
  const params = dashboard ? { days } : { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(filters.jobId ? { jobId: filters.jobId } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.keyword ? { keyword: filters.keyword } : {}), page: filters.page, size: filters.size };
  const key = JSON.stringify(params);
  useEffect(() => {
    let active = true;
    if (invalid) { setLoading(false); return; }
    setLoading(true); setError(null);
    httpClient.get<{ data: Analytics }>(dashboard ? "/companies/me/dashboard-summary" : endpoint, { params }).then(response => {
      if (active && alive()) setConfirmed({ key, data: response.data.data });
    }).catch(e => { if (active && alive()) setError(getApiErrorMessage(e, "Không thể tải thống kê. Hãy thử lại.")); })
      .finally(() => { if (active && alive()) setLoading(false); });
    return () => { active = false; };
    // key contains every submitted filter; late responses never replace a newer scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reload, invalid, alive, dashboard]);
  const data = confirmed?.data;
  const current = Boolean(confirmed?.key === key && !loading && !error && !invalid);
  const details = dashboard ? data?.recentApplications : data?.applications;
  function filter(name: keyof typeof filters, value: string | number) { setFilters(previous => ({ ...previous, [name]: value, page: 1 })); }
  async function exportCsv() {
    if (!current || exportBusy.current || !alive()) return;
    exportBusy.current = true; setExporting(true);
    try {
      const { page: _page, size: _size, ...exportParams } = params as Record<string, unknown>;
      void _page; void _size;
      const result = (await httpClient.get<{ data: { csv: string; rowCount: number; scope: Scope } }>(`${endpoint}/export`, { params: exportParams })).data.data;
      if (!alive()) return;
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `bao-cao-ung-tuyen-${from ?? "all"}-${to ?? "all"}.csv`; link.click(); URL.revokeObjectURL(url);
      showToast({ type: "success", title: `Đã xuất ${result.rowCount} đơn theo bộ lọc`, message: result.rowCount !== data?.summary.totalApplications ? "Dữ liệu đã thay đổi kể từ lần tải báo cáo; số dòng xuất là số tại thời điểm xuất." : undefined });
    } catch (e) { if (alive()) showToast({ type: "error", title: "Không thể xuất CSV", message: getApiErrorMessage(e) }); }
    finally { exportBusy.current = false; if (alive()) setExporting(false); }
  }
  return <PageContainer>
    <PageHeader title={dashboard ? "Tổng quan nhà tuyển dụng" : "Báo cáo tuyển dụng"} description="Thống kê toàn bộ dữ liệu của công ty; mỗi lần nộp đơn được tính riêng." />
    <Card className="mb-5 space-y-4">
      {dashboard ? <div className="flex flex-wrap items-end gap-3">
        <Select label="Khoảng thời gian" value={days} onChange={e => setDays(e.target.value)} options={[{ label: "7 ngày", value: "7" }, { label: "30 ngày", value: "30" }, { label: "90 ngày", value: "90" }]} />
        <Link to="/recruiter/jobs/create"><Button>Tạo tin tuyển dụng</Button></Link><Link to="/recruiter/candidates"><Button variant="secondary">Xem hồ sơ ứng tuyển</Button></Link>
      </div> : <>
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Tìm kiếm" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") filter("keyword", search); }} placeholder="Tên, email, CV hoặc tên Job" />
          <Input label="Mã Job" type="number" min={1} value={filters.jobId} onChange={e => filter("jobId", e.target.value)} />
          <Select label="Trạng thái" value={filters.status} onChange={e => filter("status", e.target.value)} options={[{ value: "", label: "Tất cả" }, ...Object.entries(labels).map(([value, label]) => ({ value, label }))]} />
          <Input label="Từ tháng (UTC)" type="month" value={filters.fromMonth} onChange={e => filter("fromMonth", e.target.value)} />
          <Input label="Đến tháng (UTC)" type="month" value={filters.toMonth} onChange={e => filter("toMonth", e.target.value)} />
          <Select label="Số dòng mỗi trang" value={String(filters.size)} onChange={e => filter("size", Number(e.target.value))} options={[10, 25, 100].map(n => ({ value: String(n), label: String(n) }))} />
        </div><Button variant="secondary" onClick={() => filter("keyword", search)}>Tìm kiếm báo cáo</Button>
      </>}
      <div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={loading || exporting} onClick={() => setReload(n => n + 1)}>{error && !data ? "Thử lại" : "Tải lại báo cáo"}</Button>
        {!dashboard ? <Button loading={exporting} disabled={!current} onClick={() => void exportCsv()}>Xuất toàn bộ CSV theo bộ lọc</Button> : null}</div>
      <p className="text-sm text-slate-600">Ngày và tháng theo UTC. Tỷ lệ nhận = ACCEPTED / toàn bộ đơn trong phạm vi, gồm WITHDRAWN, làm tròn 2 chữ số; không có đơn thì không áp dụng. CSV tối đa 10.000 dòng, không cắt âm thầm.</p>
    </Card>
    {invalid || error ? <ErrorState message={invalid ?? error!} /> : null}
    {loading ? <LoadingState /> : null}
    {data ? <>
      {!current ? <p role="status" className="my-4 rounded-xl bg-amber-50 p-3">Kết quả dưới đây là snapshot đã xác nhận trước đó; bộ lọc hoặc lần tải mới chưa được xác nhận.</p> : null}
      <p className="my-4 break-words text-sm" data-testid="analytics-scope">Phạm vi: {dashboard ? `Số đếm toàn bộ lịch sử; biểu đồ ${data.trendFrom} đến ${data.trendTo} UTC` : scopeLabel(data.scope!)}</p>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard ? <Metric label="Tin đang tuyển" value={data.jobCounts?.ACTIVE ?? 0} to="/recruiter/jobs" /> : null}
        <Metric label={dashboard ? "Tổng ứng tuyển" : "Đơn trong phạm vi lọc"} value={data.summary.totalApplications} to={dashboard ? "/recruiter/candidates" : undefined} />
        <Metric label="Sinh viên duy nhất" value={data.summary.uniqueStudents} />
        <Metric label="Tỷ lệ nhận" value={data.summary.acceptedRate === null ? "Không áp dụng (0 đơn)" : `${data.summary.acceptedRate.toFixed(2)}%`} />
      </section>
      {dashboard ? <Card className="mt-5"><h2 className="font-semibold">Tin theo trạng thái — toàn bộ {data.totalJobs} tin sở hữu</h2><ul>{Object.entries(data.jobCounts ?? {}).map(([s, n]) => <li key={s}>{jobLabels[s] ?? s}: <strong>{n}</strong></li>)}</ul></Card> : null}
      <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-2">
        <Card><h2 className="font-semibold">Đơn theo trạng thái</h2><ul className="mt-3 space-y-2">{Object.entries(labels).map(([s, label]) => <li key={s}>{label}: <strong data-testid={`status-${s}`}>{data.summary.statusCounts[s]}</strong></li>)}</ul></Card>
        <Card><h2 className="font-semibold">Ứng tuyển theo {dashboard ? "ngày" : "tháng"} UTC</h2>
          {data.trend.length ? <><div className="h-60 min-w-0" role="img" aria-label="Biểu đồ số đơn theo thời gian; bảng số liệu ở dưới"><ResponsiveContainer><BarChart data={data.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bucket" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="applications" name="Số đơn" fill="#2563eb" /></BarChart></ResponsiveContainer></div>
            <div role="region" aria-label="Dữ liệu xu hướng theo kỳ UTC" tabIndex={0} className="max-h-60 overflow-auto rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"><table className="w-full text-left text-sm"><caption className="sr-only">Số đơn từng kỳ UTC</caption><thead><tr><th scope="col">Kỳ UTC</th><th scope="col">Số đơn</th></tr></thead><tbody>{data.trend.map(row => <tr key={row.bucket}><th scope="row">{row.bucket}</th><td>{row.applications}</td></tr>)}</tbody></table></div></> : <EmptyState message="Không có đơn trong kỳ." />}
        </Card>
      </section>
      <Card className="mt-5"><h2 className="font-semibold">Top 10 Job theo số đơn {dashboard ? "toàn bộ lịch sử" : "trong bộ lọc"}</h2><ul className="mt-3 space-y-2">{data.topJobs.map(row => <li className="break-words" key={row.jobId}><Link className="text-brand-700 underline" to={`/recruiter/jobs/${row.jobId}`}>{row.jobTitle}</Link> — {row.applications} đơn, {row.accepted} nhận ({row.acceptedRate?.toFixed(2)}%) · Job #{row.jobId}</li>)}</ul>{!data.topJobs.length ? <EmptyState message="Không có Job với đơn phù hợp." /> : null}</Card>
      {dashboard ? <Card className="mt-5"><h2 className="font-semibold">{data.expiringJobCount} tin ACTIVE sắp hết hạn trong 14 ngày tới (UTC)</h2><p className="text-sm">Hiển thị tối đa 5 tin theo hạn tăng dần; không tính là số tin công khai khi Company chưa VERIFIED.</p><ul>{data.expiringJobs?.map(job => <li key={job.jobId}><Link to={`/recruiter/jobs/${job.jobId}`} className="text-brand-700 underline">{job.jobTitle}</Link> — {job.deadline}</li>)}</ul></Card> : null}
      <Card className="mt-5"><h2 className="mb-3 font-semibold">{dashboard ? "5 đơn gần nhất" : `Chi tiết đơn — ${details?.totalItems ?? 0} kết quả`}</h2>
        {details?.items.length ? <><p className="mb-2 text-xs text-slate-600 sm:hidden">Cuộn ngang bảng để xem đầy đủ các cột.</p><div className="overflow-x-auto focus-visible:ring-2 focus-visible:ring-brand-500" tabIndex={0} role="region" aria-label="Chi tiết đơn ứng tuyển, cuộn ngang"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr>{["Mã đơn", "Sinh viên", "Job", "Trạng thái", "Nộp lúc (UTC)"].map(label => <th scope="col" className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{details.items.map(row => <tr key={row.id}><td className="p-2"><Link className="text-brand-700 underline" to={`/recruiter/candidates/${row.id}`}>{row.id}</Link></td><td className="p-2">{row.studentName ?? row.studentEmail}</td><td className="p-2">{row.jobTitle}</td><td className="p-2">{labels[row.status]}</td><td className="whitespace-nowrap p-2">{row.appliedAt.replace("T", " ")}</td></tr>)}</tbody></table></div></> : <EmptyState message="Không có đơn phù hợp." />}
        {!dashboard && details ? <Pagination page={details.page} totalPages={details.totalPages} onPageChange={page => { if (current) setFilters(f => ({ ...f, page })); }} /> : null}
      </Card>
    </> : null}
  </PageContainer>;
}
function Metric({ label, value, to }: { label: string; value: string | number; to?: string }) {
  const card = <Card><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></Card>;
  return to ? <Link to={to}>{card}</Link> : card;
}
function lastDay(month: string) { const [year, m] = month.split("-").map(Number); return `${month}-${String(new Date(Date.UTC(year, m, 0)).getUTCDate()).padStart(2, "0")}`; }
function scopeLabel(scope: Scope) { return `${scope.from ?? "toàn bộ lịch sử"} → ${scope.to ?? "hiện có"} UTC; Job ${scope.jobId ?? "tất cả"}; trạng thái ${scope.status ?? "tất cả"}; từ khóa ${scope.keyword ?? "(trống)"}`; }
