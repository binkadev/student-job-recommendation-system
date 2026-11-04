import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/feedback/ErrorState";

export function SettingsRecovery({ error, saving, review, onRead, onReplace }: {
  error: string | null; saving: boolean; review: Record<string, string | boolean> | null;
  onRead: () => void; onReplace: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return <div className="space-y-3">
    {error ? <><ErrorState message={error} /><Button variant="secondary" loading={saving} onClick={onRead}>Đọc lại dữ liệu đã lưu</Button></> : null}
    {review ? <section aria-label="Đối chiếu cài đặt" className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Dữ liệu hiện trên máy chủ</h2>
      <dl className="space-y-2 break-words">{Object.entries(review).map(([key, value]) => <div key={key}><dt className="text-sm text-slate-500">{key}</dt><dd>{typeof value === "boolean" ? value ? "Bật" : "Tắt" : value || "(trống)"}</dd></div>)}</dl>
      <p className="text-sm">Bản nháp vẫn giữ nguyên. Thay bằng dữ liệu trên sẽ bỏ các thay đổi chưa lưu.</p>
      {!confirm ? <Button variant="secondary" disabled={saving} onClick={() => setConfirm(true)}>Thay bản nháp bằng dữ liệu đã lưu</Button> : <div className="flex flex-wrap gap-2" role="group" aria-label="Xác nhận thay bản nháp">
        <Button disabled={saving} onClick={() => { onReplace(); setConfirm(false); }}>Xác nhận thay bản nháp</Button>
        <Button variant="secondary" onClick={() => setConfirm(false)}>Giữ bản nháp</Button>
      </div>}
    </section> : null}
  </div>;
}
