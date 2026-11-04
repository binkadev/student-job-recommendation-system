import { Link } from "react-router-dom";

export interface DistributionItem { key: string; label: string; count: number; color: string }

export function StatusDistribution({ items, label }: { items: DistributionItem[]; label: string }) {
  const total = items.reduce((sum, row) => sum + row.count, 0);
  return <>
    <div className="neo-distribution" aria-hidden="true">
      {items.filter(item => item.count > 0).map(item => <span className="neo-distribution-segment" key={item.key} style={{ flex: item.count, background: `var(${item.color})` }} title={`${item.label}: ${item.count}`} />)}
    </div>
    {total === 0 ? <p className="neo-chart-note">Chưa có hồ sơ trong phạm vi này. Hãy thử khoảng thời gian hoặc bộ lọc khác.</p> : null}
    <ul className="neo-chart-legend" aria-label={label}>
      {items.map(item => <li key={item.key}><span className="neo-chart-dot" style={{ background: `var(${item.color})` }} aria-hidden="true" /><span>{item.label}</span><strong data-testid={`status-${item.key}`}>{item.count.toLocaleString("vi-VN")}</strong></li>)}
    </ul>
  </>;
}

interface PerformanceRow { jobId: number; jobTitle: string; applications: number; accepted: number; acceptedRate: number | null }
export function JobPerformance({ rows }: { rows: PerformanceRow[] }) {
  const max = Math.max(0, ...rows.map(row => row.applications));
  return <ol aria-label="Hiệu quả tin tuyển dụng" className="mt-3">
    {rows.map(row => <li key={row.jobId} className="neo-performance-row">
      <Link to={`/recruiter/jobs/${row.jobId}`}>{row.jobTitle}</Link>
      <span className="text-sm tabular-nums text-slate-600">{row.applications.toLocaleString("vi-VN")} đơn</span>
      <div className="neo-performance-bar" aria-hidden="true"><span style={{ width: `${max ? row.applications / max * 100 : 0}%` }} /></div>
      <p className="col-span-2 text-xs text-slate-600">{row.accepted} được chấp nhận · {row.acceptedRate === null ? "Chưa có tỷ lệ" : `${row.acceptedRate.toFixed(2)}%`} · Tin #{row.jobId}</p>
    </li>)}
  </ol>;
}
