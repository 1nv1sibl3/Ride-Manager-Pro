import { cn } from "@/lib/utils";

// Fleet composition as a horizontal stacked bar. Status colors (matching the
// badges used across the app) with 2px surface gaps, and every segment is
// direct-labeled below with count + share — identity never rides on color alone.

const SEGMENTS = [
  { key: "available", label: "Available", cls: "bg-success" },
  { key: "rented", label: "Rented", cls: "bg-warn" },
  { key: "maintenance", label: "Maintenance", cls: "bg-danger" },
  { key: "retired", label: "Retired", cls: "bg-surface-3" },
] as const;

export type FleetCounts = Record<(typeof SEGMENTS)[number]["key"], number>;

export function FleetStatus({ counts, className }: { counts: FleetCounts; className?: string }) {
  const total = SEGMENTS.reduce((s, seg) => s + counts[seg.key], 0);

  return (
    <div className={cn("card", className)}>
      <div className="mb-3">
        <h2 className="font-medium">Fleet</h2>
        <p className="text-xs text-muted">{total} vehicle{total === 1 ? "" : "s"} in total</p>
      </div>

      {total === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No vehicles yet.</p>
      ) : (
        <>
          <div
            className="flex h-5 w-full gap-[2px] overflow-hidden rounded-md"
            role="img"
            aria-label={SEGMENTS.map((s) => `${s.label}: ${counts[s.key]}`).join(", ")}
          >
            {SEGMENTS.filter((s) => counts[s.key] > 0).map((s) => (
              <div
                key={s.key}
                className={cn("h-full", s.cls)}
                style={{ width: `${(counts[s.key] / total) * 100}%` }}
                title={`${s.label}: ${counts[s.key]}`}
              />
            ))}
          </div>

          <div className="mt-3 space-y-1.5">
            {SEGMENTS.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", s.cls)} aria-hidden />
                <span className="flex-1 text-muted">{s.label}</span>
                <span className="font-medium">{counts[s.key]}</span>
                <span className="w-10 text-right text-muted-2">
                  {Math.round((counts[s.key] / total) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
