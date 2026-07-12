import { Skeleton } from "../../../components/ui/Skeleton";

export function HomePageSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-80 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-56 w-full" />)}
      </div>
    </div>
  );
}
