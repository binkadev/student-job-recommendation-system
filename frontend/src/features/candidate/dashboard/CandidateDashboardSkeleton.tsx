export function CandidateDashboardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Đang tải bảng điều khiển ứng viên" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <div className="nova-skeleton h-5 w-44 rounded-full" />
          <div className="nova-skeleton h-9 w-72 max-w-full" />
          <div className="nova-skeleton h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2.5">
          <div className="nova-skeleton h-11 w-36" />
          <div className="nova-skeleton h-11 w-28" />
        </div>
      </div>

      <div className="nova-skeleton h-52 w-full rounded-[24px]" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="nova-skeleton h-32 w-full rounded-[20px]" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="nova-skeleton h-72 w-full rounded-[20px]" />
          <div className="nova-skeleton h-96 w-full rounded-[20px]" />
          <div className="nova-skeleton h-64 w-full rounded-[20px]" />
        </div>
        <div className="space-y-6">
          <div className="nova-skeleton h-52 w-full rounded-[20px]" />
          <div className="nova-skeleton h-52 w-full rounded-[20px]" />
          <div className="nova-skeleton h-64 w-full rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}
