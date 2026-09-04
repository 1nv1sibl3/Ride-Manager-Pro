import { TableSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-52 animate-pulse rounded-md bg-surface-2" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
