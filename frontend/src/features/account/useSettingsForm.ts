import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../../utils/apiErrors";
import { useToast } from "../../hooks/useToast";
import { useSessionAlive } from "./useSessionAlive";

export function useSettingsForm<T>(load: () => Promise<T>, write: (draft: T) => Promise<unknown>,
  same: (a: T, b: T) => boolean, success: string) {
  const [snapshot, setSnapshot] = useState<T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);
  const [review, setReview] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const busy = useRef(false);
  const alive = useSessionAlive();
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    load().then(value => { if (active && alive()) { setSnapshot(value); setDraft(value); } })
      .catch(e => { if (active && alive()) setError(getApiErrorMessage(e, "Không thể tải cài đặt. Hãy thử lại.")); })
      .finally(() => { if (active && alive()) setLoading(false); });
    return () => { active = false; };
    // Component is keyed by authenticated session; drafts never follow a background reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!draft || busy.current || blocked || !alive()) return;
    busy.current = true; setSaving(true); setError(null); setReview(null);
    let committed = false;
    try {
      await write(draft);
      committed = true;
      if (!alive()) return;
      const persisted = await load();
      if (!alive()) return;
      if (!same(draft, persisted)) {
        setReview(persisted); setBlocked(true);
        setError("Dữ liệu đọc lại khác bản vừa gửi. Bản nháp được giữ để đối chiếu.");
        return;
      }
      setSnapshot(persisted); setDraft(persisted);
      showToast({ type: "success", title: success });
    } catch (e) {
      if (!alive()) return;
      const response = (e as { response?: { status?: number } })?.response;
      const uncertain = committed || !response || (response.status ?? 0) >= 500;
      setBlocked(uncertain || response?.status === 409 || response?.status === 428);
      setError(uncertain
        ? "Chưa xác nhận được kết quả lưu. Bản nháp được giữ; hãy đọc lại dữ liệu trước khi thử lại."
        : getApiErrorMessage(e, "Không thể lưu cài đặt."));
    } finally {
      busy.current = false;
      if (alive()) setSaving(false);
    }
  }

  async function readBack() {
    if (busy.current || !alive()) return;
    busy.current = true; setSaving(true);
    try {
      const current = await load();
      if (!alive()) return;
      if (!snapshot) { setSnapshot(current); setDraft(current); setError(null); }
      else setReview(current);
      // Never attach a new Student ETag to the old draft, even after this GET.
    } catch (e) {
      if (alive()) setError(getApiErrorMessage(e, "Không thể đọc lại dữ liệu. Bản nháp vẫn được giữ."));
    } finally { busy.current = false; if (alive()) { setSaving(false); setLoading(false); } }
  }

  function replaceWithReview() {
    if (!review || busy.current) return;
    setSnapshot(review); setDraft(review); setReview(null); setBlocked(false); setError(null);
  }

  return { snapshot, draft, setDraft, loading, saving, error, blocked, review, save, readBack, replaceWithReview };
}
