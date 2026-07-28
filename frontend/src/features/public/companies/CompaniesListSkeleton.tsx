import { Skeleton } from "../../../components/ui/Skeleton";

export function CompaniesListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-80 w-full" />)}
    </div>
  );
}
