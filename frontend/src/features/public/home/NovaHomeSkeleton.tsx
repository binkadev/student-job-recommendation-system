export function NovaHomeSkeleton() {
  return (
    <div className="space-y-8" aria-label="Đang tải dữ liệu trang chủ...">
      {/* Hero Skeleton */}
      <div className="h-[440px] w-full rounded-[28px] bg-[#0c111c] p-10 flex flex-col justify-center border border-white/10">
        <div className="nova-skeleton h-6 w-48 rounded-full opacity-30" />
        <div className="nova-skeleton mt-6 h-12 w-3/4 max-w-lg rounded-xl opacity-20" />
        <div className="nova-skeleton mt-3 h-12 w-2/3 max-w-md rounded-xl opacity-20" />
        <div className="nova-skeleton mt-6 h-16 w-full max-w-xl rounded-xl opacity-15" />
        <div className="mt-8 flex gap-3">
          <div className="nova-skeleton h-12 w-36 rounded-xl opacity-30" />
          <div className="nova-skeleton h-12 w-44 rounded-xl opacity-20" />
        </div>
      </div>

      {/* Metrics Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="nova-skeleton h-5 w-28" />
            <div className="nova-skeleton mt-4 h-9 w-20" />
          </div>
        ))}
      </div>

      {/* Jobs Skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-52 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex gap-3">
              <div className="nova-skeleton h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="nova-skeleton h-5 w-1/2" />
                <div className="nova-skeleton h-4 w-1/3" />
              </div>
            </div>
            <div className="nova-skeleton mt-5 h-4 w-full" />
            <div className="nova-skeleton mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
