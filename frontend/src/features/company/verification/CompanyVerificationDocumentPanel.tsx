import { useEffect, useRef, useState } from "react";
import { SectionHeader } from "../../../components/common/SectionHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { adminDocumentEndpoint, COMPANY_DOCUMENT_ENDPOINT, downloadVerificationDocument, getVerificationDocument, uploadVerificationDocument, verificationFileError, verificationRequestError, type VerificationDocumentSnapshot } from "./verificationDocumentApi";

type Props = { mode: "company"; onUploaded: (snapshot: VerificationDocumentSnapshot) => Promise<void> } | { mode: "admin"; companyId: number };
export function CompanyVerificationDocumentPanel(props: Props) {
  const endpoint = props.mode === "company" ? COMPANY_DOCUMENT_ENDPOINT : adminDocumentEndpoint(props.companyId);
  const [snapshot, setSnapshot] = useState<VerificationDocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [transfer, setTransfer] = useState<"upload" | "download" | null>(null);
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const lifecycle = useRef<AbortController>();
  const alive = () => Boolean(lifecycle.current && !lifecycle.current.signal.aborted);

  useEffect(() => {
    const controller = new AbortController(); lifecycle.current = controller;
    setLoading(true);
    getVerificationDocument(endpoint, controller.signal).then(value => {
      if (!controller.signal.aborted) { setSnapshot(value); setLoadError(""); }
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(verificationRequestError(error, "Không tải được trạng thái tài liệu. Vui lòng thử lại."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function retryStatus() {
    setLoading(true); setLoadError("");
    try { const value = await getVerificationDocument(endpoint, lifecycle.current?.signal); if (alive()) setSnapshot(value); }
    catch (error) { if (alive()) setLoadError(verificationRequestError(error, "Không tải được trạng thái tài liệu. Vui lòng thử lại.")); }
    finally { if (alive()) setLoading(false); }
  }
  async function upload() {
    if (props.mode !== "company" || pending.current || loading || !file || !snapshot || conflict) return;
    const invalid = verificationFileError(file); if (invalid) { setFileError(invalid); return; }
    pending.current = true; setTransfer("upload"); setActionError(""); setNotice(""); setWarning("");
    try {
      const saved = await uploadVerificationDocument(file, snapshot, lifecycle.current?.signal);
      if (!alive()) return;
      setSnapshot(saved); setFile(null); if (input.current) input.current.value = "";
      setNotice("Đã gửi tài liệu xác thực. Trạng thái xác thực doanh nghiệp vẫn do quản trị viên quyết định.");
      const refreshed = await Promise.allSettled([getVerificationDocument(endpoint, lifecycle.current?.signal), props.onUploaded(saved)] as const);
      if (!alive()) return;
      if (refreshed[0].status === "fulfilled") { setSnapshot(refreshed[0].value); setLoadError(""); }
      else setLoadError("Tài liệu đã được gửi nhưng chưa tải lại được trạng thái mới nhất.");
      if (refreshed[1].status === "rejected") setWarning("Tài liệu đã được gửi nhưng chưa tải lại được thông tin công ty. Hãy tải lại trang trước khi tiếp tục chỉnh sửa hồ sơ.");
    } catch (error) {
      if (!alive()) return;
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        setConflict(true);
        setActionError("Hồ sơ đã thay đổi ở phiên khác. Tệp đã chọn vẫn được giữ và chưa được gửi lại. Hãy tải lại trang để xem phiên bản mới trước khi chọn gửi lại; hệ thống không tự thử lại.");
      } else setActionError(verificationRequestError(error, "Chưa xác nhận gửi thành công. Tệp đã chọn vẫn được giữ; bạn có thể thử lại."));
    } finally { pending.current = false; if (alive()) setTransfer(null); }
  }
  async function download() {
    if (pending.current || !snapshot?.submitted || loading) return;
    pending.current = true; setTransfer("download"); setActionError("");
    try { await downloadVerificationDocument(endpoint, lifecycle.current?.signal); }
    catch (error) { if (alive()) setActionError(verificationRequestError(error, "Không tải được tài liệu. Vui lòng thử lại.")); }
    finally { pending.current = false; if (alive()) setTransfer(null); }
  }
  return <Card>
    <SectionHeader title="Tài liệu xác thực riêng tư" description="Chỉ doanh nghiệp sở hữu tài liệu và quản trị viên được tải xuống." />
    {loading ? <p role="status" className="text-sm text-slate-600">Đang tải trạng thái tài liệu…</p> : null}
    {!loading && snapshot ? <p role="status" className="mb-4 text-sm font-medium text-slate-800">{snapshot.submitted ? "Đã gửi tài liệu xác thực." : "Chưa gửi tài liệu xác thực."}</p> : null}
    {loadError ? <div className="mb-4"><p role="alert" className="text-sm text-red-700">{loadError}</p>{!conflict ? <Button className="mt-2" variant="secondary" disabled={loading || Boolean(transfer)} onClick={() => void retryStatus()}>Tải lại trạng thái tài liệu</Button> : null}</div> : null}
    {notice ? <p role="status" className="mb-4 text-sm text-emerald-800">{notice}</p> : null}
    {warning ? <p role="alert" className="mb-4 text-sm text-amber-800">{warning}</p> : null}
    {actionError ? <p role="alert" className="mb-4 text-sm text-red-700">{actionError}</p> : null}
    {props.mode === "company" ? <div className="space-y-3">
      <Input ref={input} label="Chọn tài liệu xác thực" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" aria-describedby="verification-file-hint" error={fileError} disabled={loading || !snapshot || Boolean(transfer)} onChange={event => {
        const selected = event.target.files?.[0] ?? null; setFile(selected); setFileError(selected ? verificationFileError(selected) : "");
      }} />
      <p id="verification-file-hint" className="text-sm text-slate-600">Chọn một tệp PDF, PNG hoặc JPEG, tối đa 5 MiB (5.242.880 byte). Tệp ảnh tối đa 25 triệu điểm ảnh. Nội dung tệp sẽ được kiểm tra khi gửi. Tài liệu mới sẽ thay thế bản đã gửi.</p>
      <Button loading={transfer === "upload"} disabled={loading || Boolean(transfer) || !snapshot || !file || Boolean(fileError) || conflict} onClick={() => void upload()}>{snapshot?.submitted ? "Thay thế tài liệu" : "Gửi tài liệu xác thực"}</Button>
    </div> : null}
    {snapshot?.submitted ? <Button className="mt-4" variant="secondary" loading={transfer === "download"} disabled={loading || Boolean(transfer)} onClick={() => void download()}>Tải tài liệu xác thực</Button> : null}
  </Card>;
}
