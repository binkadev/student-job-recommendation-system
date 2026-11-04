import { Button } from "../../../components/ui/Button";
import type { useGenerationRecovery } from "./useGenerationRecovery";

export function GenerationRecovery({ recovery }: { recovery: ReturnType<typeof useGenerationRecovery> }) {
  if (!recovery.blocked) return null;
  return <div role="alert" className="my-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
    <p>{recovery.message}</p>
    <Button variant="secondary" loading={recovery.reading} onClick={() => void recovery.readBack()}>Đọc lại lịch sử trước khi thử lại</Button>
  </div>;
}
