import { useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { ErrorState } from "../../components/feedback/ErrorState";
import { useToast } from "../../hooks/useToast";
import { useAuth } from "../../hooks/useAuth";
import { httpClient } from "../../services/api/httpClient";
import { getApiErrorMessage } from "../../utils/apiErrors";
import { useSessionAlive } from "./useSessionAlive";

export function PasswordSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useSessionAlive();
  const { showToast } = useToast();
  const { logout } = useAuth();
  async function save() {
    if (busy.current || uncertain || !alive()) return;
    if (!current || next.length < 6 || new TextEncoder().encode(next).length > 72 || new TextEncoder().encode(current).length > 72 || next !== confirm || next === current) {
      setError("Nhập mật khẩu hiện tại và mật khẩu mới khác nhau, tối thiểu 6 ký tự, tối đa 72 byte UTF-8; xác nhận phải khớp."); return;
    }
    busy.current = true; setSaving(true); setError(null);
    try {
      await httpClient.patch("/users/me/password", { currentPassword: current, newPassword: next });
      if (!alive()) return;
      setCurrent(""); setNext(""); setConfirm("");
      showToast({ type: "success", title: "Đã đổi mật khẩu" });
    } catch (e) {
      if (!alive()) return;
      const response = (e as { response?: { status: number } })?.response;
      if (!response || response.status >= 500) {
        setUncertain(true);
        setError("Chưa xác nhận được kết quả đổi mật khẩu. Hãy đăng xuất rồi đăng nhập bằng mật khẩu mới để xác minh; nếu không được, dùng mật khẩu cũ. Không gửi lại yêu cầu khi chưa xác minh.");
      } else setError(getApiErrorMessage(e, "Không thể đổi mật khẩu."));
    } finally { busy.current = false; if (alive()) setSaving(false); }
  }
  return <div className="space-y-4">
    <p className="text-sm text-slate-600">Mật khẩu mới tối thiểu 6 ký tự, tối đa 72 byte UTF-8. Các phiên đăng nhập đã cấp vẫn có hiệu lực đến khi hết hạn.</p>
    {error ? <ErrorState message={error} /> : null}
    <fieldset disabled={saving || uncertain} className="grid gap-4 md:grid-cols-2">
      <legend className="sr-only">Đổi mật khẩu</legend>
      <Input label="Mật khẩu hiện tại" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
      <Input label="Mật khẩu mới" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
      <Input label="Xác nhận mật khẩu" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
      <div className="self-end"><Button loading={saving} onClick={() => void save()}>Đổi mật khẩu</Button></div>
    </fieldset>
    <p className="text-sm text-slate-600">Xác thực hai bước chưa được hệ thống hỗ trợ.</p>
    <Button variant="secondary" onClick={logout}>Đăng xuất phiên hiện tại</Button>
  </div>;
}
