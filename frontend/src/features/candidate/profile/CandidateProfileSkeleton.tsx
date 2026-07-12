import { Skeleton } from "../../../components/ui/Skeleton";

export function CandidateProfileSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    </div>
  );
}
