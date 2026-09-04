"use client";
import type { Conflict } from "@/lib/conflicts";
import { fmtDate } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Rendered only when conflicts exist — warns staff before saving an overlap. */
export function ConflictConfirmDialog({
  conflicts,
  onConfirm,
  onCancel,
  pending,
}: {
  conflicts: Conflict[];
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title={`Overlaps with ${conflicts.length} booking${conflicts.length === 1 ? "" : "s"}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" loading={pending} onClick={onConfirm}>
            Save anyway
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        The system stays flexible — you can save anyway, but both sides will be
        flagged with a <span className="badge badge-warn">Conflict</span> pill
        until you resolve it (swap vehicle, shorten dates, or cancel).
      </p>
      <ul className="space-y-1.5 rounded-lg border border-border p-2 text-sm">
        {conflicts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">
                <a className="link font-mono text-xs" href={`/bookings/${c.id}`} target="_blank" rel="noreferrer">
                  #{c.refNumber}
                </a>{" "}
                · {c.customerName}
              </div>
              <div className="text-xs text-muted">
                {fmtDate(c.startAt)} → {fmtDate(c.endAt)}
              </div>
            </div>
            <span className="badge badge-info">{c.status}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
