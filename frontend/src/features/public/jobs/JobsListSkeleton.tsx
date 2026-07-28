import { Skeleton } from "../../../components/ui/Skeleton";

export function JobsListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56 w-full" />)}
    </div>
  );
}
