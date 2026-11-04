import { useEffect, useState } from "react";
import { NOTIFICATIONS_CHANGED, unreadCount } from "./notificationsApi";
import { useSessionAlive } from "./useSessionAlive";

export function useUnreadCount() {
  const [count, setCount] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const alive = useSessionAlive();
  useEffect(() => {
    let sequence = 0;
    let active = true;
    function refresh() {
      const request = ++sequence;
      unreadCount().then(value => {
        if (active && alive() && request === sequence) { setCount(value); setFailed(false); }
      }).catch(() => { if (active && alive() && request === sequence) setFailed(true); });
    }
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [alive]);
  return { count, failed };
}
