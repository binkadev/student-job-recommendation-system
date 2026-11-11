import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageContainer } from "../../../components/common/PageContainer";
import { PageHeader } from "../../../components/common/PageHeader";
import { Pagination } from "../../../components/common/Pagination";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { Modal } from "../../../components/ui/Modal";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { useToast } from "../../../hooks/useToast";
import { RecruiterDataTable } from "../RecruiterDataTable";
import { applicationStatusLabels, listSavedCandidates, removeSavedCandidate, updateSavedNote, type SavedCandidate } from "./savedCandidatesApi";
import { useCandidateMutation } from "./useCandidateMutation";

export function SavedCandidatesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [page, setPage] = useState(1), [keyword, setKeyword] = useState("");
  const [size, setSize] = useState(10);
  const [status, setStatus] = useState(""), [jobId, setJobId] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<SavedCandidate | null>(null);
  const [removing, setRemoving] = useState<SavedCandidate | null>(null);
  const [note, setNote] = useState("");
  const [draftStale, setDraftStale] = useState(false);
  const mutation = useCandidateMutation();
  const { showToast } = useToast();
  const query = useAsyncData(() => listSavedCandidates({ page, size, keyword: keyword.trim() || undefined, applicationStatus: status || undefined, jobId: jobId || undefined }), [page, size, keyword, status, jobId, reload]);
  const data = query.data;
  // Backend filtering/counting/pagination; never filter an already limited client result.
  useEffect(() => {
    const refresh = () => setReload(value => value + 1);
    const changed = (event: StorageEvent) => { if (event.key === "job-system:saved-candidates-changed") refresh(); };
    window.addEventListener("focus", refresh); window.addEventListener("storage", changed);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", changed); };
  }, []);
  function changed(title: string) {
    setEditing(null); setRemoving(null); setReload(value => value + 1);
    localStorage.setItem("job-system:saved-candidates-changed", String(Date.now()));
    showToast({ type: "success", title });
  }
  function edit(candidate: SavedCandidate) {
    setEditing(candidate); setNote(candidate.note ?? ""); setDraftStale(false); mutation.clearError();
  }
  function saveNote() {
    if (!editing || note.length > 2000 || draftStale) return;
    void mutation.run(() => updateSavedNote(editing, note), () => changed("Đã lưu ghi chú nội bộ"), () => setDraftStale(true));
  }
  function readBack() {
    if (!editing) return;
    void mutation.run(() => listSavedCandidates({ page: 1, size: 1, studentId: editing.studentId }), result => {
      const current = result.items.find(row => row.id === editing.id);
      if (!current) { setDraftStale(true); setReload(value => value + 1); return; }
      // Keep the draft and its captured revision. User must explicitly load the confirmed note.
      setEditing(current); setNote(current.note ?? ""); setDraftStale(false);
    });
  }
  const close = () => { if (!mutation.pending) { setEditing(null); setRemoving(null); mutation.clearError(); } };
  const content = <>
    <Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Input label="Tìm ứng viên đã lưu" maxLength={255} value={keyword} placeholder="Tên, email, vị trí, ghi chú..." onChange={event => { setKeyword(event.target.value); setPage(1); }} />
        <Select label="Trạng thái đơn nguồn" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} options={[{ label: "Tất cả", value: "" }, ...Object.entries(applicationStatusLabels).map(([value, label]) => ({ value, label }))]} />
        <Input label="Mã Job nguồn" type="number" min={1} value={jobId} onChange={event => { setJobId(event.target.value); setPage(1); }} />
        <Select label="Số hồ sơ mỗi trang" value={String(size)} onChange={event => { setSize(Number(event.target.value)); setPage(1); }} options={[{ label: "1", value: "1" }, { label: "10", value: "10" }, { label: "25", value: "25" }]} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={mutation.pending || query.loading} onClick={() => setReload(value => value + 1)}>Tải lại danh sách</Button>
        {keyword || status || jobId ? <Button variant="ghost" onClick={() => { setKeyword(""); setStatus(""); setJobId(""); setPage(1); }}>Xóa bộ lọc</Button> : null}
      </div>
    </Card>
    <Card className="mt-5">
      {query.loading ? <LoadingState /> : query.error ? <ErrorState message={query.error} /> : <>
        <p role="status" className="mb-4 text-sm text-slate-600">{data?.totalItems ?? 0} hồ sơ đã lưu</p>
        {!data?.items.length ? <EmptyState message="Không có hồ sơ đã lưu phù hợp." /> : <RecruiterDataTable rows={data.items} getRowKey={row => String(row.id)} columns={[
          { key: "candidate", header: "Ứng viên", render: row => <div className="min-w-0 break-words"><p className="font-medium">{row.studentName || "Ứng viên"}</p><p className="text-xs text-slate-500">{row.studentEmail}</p><p className="text-xs text-slate-500">{row.headline || row.major}</p></div> },
          { key: "job", header: "Tin ứng tuyển nguồn", render: row => <div><p>{row.jobTitle}</p><p className="text-xs text-slate-500">Job #{row.jobId} · Đơn #{row.applicationId}</p></div> },
          { key: "status", header: "Trạng thái đơn nguồn", render: row => applicationStatusLabels[row.applicationStatus] ?? "Chưa xác minh" },
          { key: "note", header: "Ghi chú nội bộ", render: row => <p className="max-w-sm whitespace-pre-wrap break-words text-sm">{row.note || "Chưa có ghi chú"}</p> },
          { key: "actions", header: "Thao tác", render: row => <div className="flex flex-wrap gap-2">
            <Link to={`/recruiter/candidates/${row.applicationId}`}><Button size="sm" variant="secondary">Chi tiết</Button></Link>
            <Link to={`/recruiter/candidates/${row.applicationId}/evaluation`}><Button size="sm" variant="secondary">Đánh giá</Button></Link>
            <Button size="sm" variant="secondary" disabled={mutation.pending} onClick={() => edit(row)}>Sửa ghi chú</Button>
            <Button size="sm" variant="secondary" disabled={mutation.pending} onClick={() => { setRemoving(row); mutation.clearError(); }}>Bỏ lưu</Button>
          </div> },
        ]} />}
        <Pagination page={data?.page ?? page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        {page > 1 && !data?.items.length ? <Button variant="secondary" onClick={() => setPage(1)}>Về trang đầu</Button> : null}
      </>}
    </Card>
    <Modal open={Boolean(editing)} title="Ghi chú nội bộ" onClose={close}>
      <p className="mb-4 text-sm text-slate-600">Chỉ công ty bạn được đọc ghi chú này. Tải ghi chú hiện tại sẽ thay nội dung đang soạn.</p>
      <Textarea label="Ghi chú đánh giá" value={note} maxLength={2000} disabled={mutation.pending} onChange={event => setNote(event.target.value)} />
      <p className="mt-1 text-xs text-slate-500">{note.length}/2000</p>
      {mutation.error ? <ErrorState message={mutation.error} /> : null}
      {draftStale ? <p role="alert" className="mt-3 text-sm text-amber-800">Chưa lưu bản nháp. Hãy sao chép nội dung cần giữ rồi tải ghi chú hiện tại để đối chiếu trước khi lưu lại.</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={mutation.pending} onClick={close}>Hủy</Button>
        {draftStale ? <Button variant="secondary" disabled={mutation.pending} onClick={readBack}>Tải ghi chú hiện tại</Button> : null}
        <Button loading={mutation.pending} disabled={draftStale || note.length > 2000} onClick={saveNote}>Lưu ghi chú</Button>
      </div>
    </Modal>
    <Modal open={Boolean(removing)} title="Bỏ lưu ứng viên" onClose={close}>
      <p className="text-sm text-slate-700">Bỏ lưu {removing?.studentName || "ứng viên"} sẽ xóa ghi chú nội bộ của dấu lưu này. Hồ sơ, CV và đơn ứng tuyển vẫn được giữ.</p>
      {mutation.error ? <ErrorState message={mutation.error} /> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={mutation.pending} onClick={close}>Hủy</Button>
        <Button variant="danger" loading={mutation.pending} onClick={() => { if (removing) void mutation.run(() => removeSavedCandidate(removing.id), () => { setPage(1); changed("Đã bỏ lưu hồ sơ ứng viên"); }); }}>Xác nhận bỏ lưu</Button>
      </div>
    </Modal>
  </>;
  if (embedded) return <div>{content}</div>;
  return <PageContainer>
    <PageHeader title="Hồ sơ đã lưu" description="Ứng viên và ghi chú riêng của công ty. Trạng thái bên dưới thuộc đơn ứng tuyển nguồn đã lưu." />
    {content}
  </PageContainer>;
}
