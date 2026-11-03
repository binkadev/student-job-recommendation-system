import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useToast } from "../../../hooks/useToast";
import { httpClient } from "../../../services/api/httpClient";
import { getApiErrorMessage } from "../../../utils/apiErrors";
import { publishApplicationChange, type StudentApplication } from "../../public/jobs/useAppliedJobs";

export function WithdrawApplicationButton<T extends StudentApplication>({ application, userId, disabled = false, onChanged }: {
  application: T; userId: string; disabled?: boolean; onChanged: (application: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const owner = useRef(userId);
  owner.current = userId;
  const { showToast } = useToast();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function accept(data: T) { onChanged(data); publishApplicationChange(data, userId); }
  async function reconcile() {
    const response = await httpClient.get<{ data: T }>(`/students/me/applications/${application.id}`);
    if (mounted.current && owner.current === userId) {
      accept(response.data.data);
      if (response.data.data.status !== "PENDING") setOpen(false);
    }
  }
  async function run(withdraw: boolean) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(null);
    try {
      if (withdraw) {
        const response = await httpClient.patch<{ data: T }>(`/applications/${application.id}/status`, { status: "WITHDRAWN" });
        if (!mounted.current || owner.current !== userId) return;
        accept(response.data.data); setOpen(false);
        showToast({ type: "success", title: "Đã rút đơn ứng tuyển" });
      } else await reconcile();
    } catch (failure) {
      if (!mounted.current || owner.current !== userId) return;
      const message = getApiErrorMessage(failure, "Chưa xác nhận được kết quả. Hãy tải lại trạng thái trước khi thử lại.");
      setError(message);
      showToast({ type: "error", title: withdraw ? "Không thể xác nhận rút đơn" : "Không thể tải trạng thái", message });
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (withdraw && (status === 400 || status === 409)) {
        try { await reconcile(); } catch { /* Keep confirmed data and explicit read-back action. */ }
      }
    } finally {
      busy.current = false;
      if (mounted.current && owner.current === userId) setPending(false);
    }
  }
  return <>
    {application.status === "PENDING" ? <Button variant="danger" disabled={disabled || pending} onClick={() => { setOpen(true); setError(null); }}>Rút đơn ứng tuyển</Button> : null}
    <Modal open={open} title="Rút đơn ứng tuyển" onClose={() => { if (!busy.current) setOpen(false); }}>
      <p className="text-sm leading-6 text-slate-700">Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.</p>
      {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Hủy</Button>
        {error ? <Button variant="secondary" disabled={pending} onClick={() => void run(false)}>Tải lại trạng thái</Button> : null}
        <Button variant="danger" loading={pending} disabled={pending || Boolean(error)} onClick={() => void run(true)}>Xác nhận rút đơn</Button>
      </div>
    </Modal>
  </>;
}
