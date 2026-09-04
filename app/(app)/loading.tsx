import { CardsSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded-md bg-surface-2" />
      <CardsSkeleton />
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
