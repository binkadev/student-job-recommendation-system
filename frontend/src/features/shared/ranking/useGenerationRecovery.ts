import { useRef, useState } from "react";
import { useSessionAlive } from "../../account/useSessionAlive";

export function useGenerationRecovery(readRuns: () => Promise<{ status?: string | null }[]>, reload: () => void) {
  const [blocked, setBlocked] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const alive = useSessionAlive();
  function requireReadBack() {
    if (!alive()) return;
    setBlocked(true);
    setMessage("Chưa xác nhận được kết quả yêu cầu. Hãy đọc lại lịch sử trước khi tạo lần chạy khác.");
  }
  async function readBack() {
    if (busy.current || !alive()) return;
    busy.current = true; setReading(true);
    try {
      const runs = await readRuns();
      if (!alive()) return;
      reload();
      if (runs.some(run => run.status === "PROCESSING" || run.status === "PENDING")) {
        setMessage("Lần chạy vẫn đang xử lý. Hãy đọc lại lịch sử sau; chưa thể gửi yêu cầu mới.");
      } else { setBlocked(false); setMessage(""); }
    } catch {
      if (alive()) setMessage("Không thể đọc lại lịch sử. Yêu cầu mới vẫn bị khóa để tránh gửi trùng.");
    } finally { busy.current = false; if (alive()) setReading(false); }
  }
  return { blocked, reading, message, requireReadBack, readBack };
}
