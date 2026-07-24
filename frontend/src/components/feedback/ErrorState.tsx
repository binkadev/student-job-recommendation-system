export function ErrorState({ message = "Đã có lỗi xảy ra." }: { message?: string }) {
  return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}
