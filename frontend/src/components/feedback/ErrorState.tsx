import { AlertCircle } from "lucide-react";

export function ErrorState({ message = "Đã có lỗi xảy ra." }: { message?: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">
      <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
      <span>{message}</span>
    </div>
  );
}
