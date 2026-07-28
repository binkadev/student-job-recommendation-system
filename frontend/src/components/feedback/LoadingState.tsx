export function LoadingState({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">{message}</div>;
}
