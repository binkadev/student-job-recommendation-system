import { Skeleton } from "../../../components/ui/Skeleton";

export function CandidateCvsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-72 w-full" />)}
    </div>
  );
}
