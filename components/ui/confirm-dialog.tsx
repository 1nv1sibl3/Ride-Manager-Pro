"use client";

import { Dialog } from "./dialog";
import { Button } from "./button";

/** Styled replacement for native confirm() — use for destructive or blocking confirmations. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      {description && <p className="text-sm text-muted">{description}</p>}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant={tone} loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
