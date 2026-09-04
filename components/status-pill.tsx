import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  booked: "Booked",
  reserved: "Booked",
  handed_over: "Handed over",
  active: "Handed over",
  returned: "Returned",
  closed: "Closed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

export function StatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  const key = overdue ? "overdue" : status;
  return <span className={cn("badge", `status-${key}`)}>{LABEL[key] || status}</span>;
}

// Soft warning — overlap is allowed but flagged so staff can resolve it.
export function ConflictPill({ count, title }: { count: number; title?: string }) {
  if (!count) return null;
  return (
    <span className="badge badge-warn" title={title ?? `${count} overlapping booking(s)`}>
      Conflict ×{count}
    </span>
  );
}
