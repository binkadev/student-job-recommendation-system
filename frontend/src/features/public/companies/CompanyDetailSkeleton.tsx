import { Skeleton } from "../../../components/ui/Skeleton";

export function CompanyDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-72 w-full" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
